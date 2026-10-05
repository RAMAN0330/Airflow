"""API tests: catalog, DAG locking, submissions and progress."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.catalog import Catalog
from api.config import Settings
from api.main import create_app

ROOT = Path(__file__).resolve().parents[1]
EX = ROOT / "exercises"
H = {"X-User-Id": "test-user-0001"}


def solution(eid):
    return (EX / eid / "solution.py").read_text()


@pytest.fixture
def client(tmp_path):
    app = create_app(Settings(exercises_dir=EX, database_path=tmp_path / "t.db", max_concurrent_runs=2))
    with TestClient(app) as c:
        yield c


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_user_id_is_required_and_validated(client):
    assert client.get("/api/curriculum").status_code == 422
    assert client.get("/api/curriculum", headers={"X-User-Id": "bad id!"}).status_code == 400


def test_fresh_user_curriculum(client):
    data = client.get("/api/curriculum", headers=H).json()
    assert [p["id"] for p in data["phases"]] == [1, 2, 3]
    by_id = {m["exercise"]["id"]: m["exercise"]["status"]
             for p in data["phases"] for m in p["modules"] if m["exercise"]}
    assert by_id == {"linear_regression_gd": "available",
                     "activation_functions": "locked",
                     "self_attention_head": "locked"}
    coming_soon = [m for p in data["phases"] for m in p["modules"] if m["exercise"] is None]
    assert len(coming_soon) >= 5


def test_exercise_detail(client):
    d = client.get("/api/exercises/activation_functions", headers=H).json()
    assert d["status"] == "locked"
    assert "def relu" in d["starter_code"]
    assert d["task_markdown"].startswith("# Activation")
    assert d["prerequisite_details"] == [
        {"id": "linear_regression_gd", "title": "Linear & Ridge Regression with Gradient Descent", "status": "available"}]
    assert [u["id"] for u in d["unlocks"]] == ["self_attention_head"]
    assert "np.maximum(x, 0.0)" not in json.dumps(d), "reference solution leaked"
    assert client.get("/api/exercises/nope", headers=H).status_code == 404


def test_locked_exercise_rejects_submissions(client):
    r = client.post("/api/exercises/self_attention_head/submissions", headers=H, json={"code": solution("self_attention_head")})
    assert r.status_code == 403
    assert "activation_functions" in r.json()["detail"]


def test_failed_then_passed_submission_unlocks_next(client):
    starter = client.get("/api/exercises/linear_regression_gd", headers=H).json()["starter_code"]
    r = client.post("/api/exercises/linear_regression_gd/submissions", headers=H, json={"code": starter})
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "failed" and not body["newly_completed"] and body["unlocked"] == []
    assert any(t["hint"] for t in body["result"]["tests"] if t["outcome"] == "failed")

    detail = client.get("/api/exercises/linear_regression_gd", headers=H).json()
    assert detail["status"] == "in_progress" and detail["attempts"] == 1

    r = client.post("/api/exercises/linear_regression_gd/submissions", headers=H, json={"code": solution("linear_regression_gd")})
    body = r.json()
    assert body["status"] == "passed" and body["score"] == 1.0
    assert body["newly_completed"] is True
    assert body["unlocked"] == [{"id": "activation_functions", "title": body["unlocked"][0]["title"], "status": "available"}]

    # Passing again is not "newly" completed.
    again = client.post("/api/exercises/linear_regression_gd/submissions", headers=H, json={"code": solution("linear_regression_gd")}).json()
    assert again["newly_completed"] is False

    history = client.get("/api/exercises/linear_regression_gd/submissions", headers=H).json()
    assert [h["status"] for h in history] == ["passed", "passed", "failed"]
    assert history[-1]["code"] == starter


def test_progress_and_isolation_between_users(client):
    for eid in ("linear_regression_gd", "activation_functions"):
        assert client.post(f"/api/exercises/{eid}/submissions", headers=H, json={"code": solution(eid)}).json()["status"] == "passed"
    p = client.get("/api/progress", headers=H).json()
    assert (p["completed"], p["available"], p["total_exercises"]) == (2, 1, 3)
    assert p["total_submissions"] == 2 and p["pass_rate"] == 1.0
    assert p["next_up"]["id"] == "self_attention_head"
    assert len(p["recent"]) == 2 and p["recent"][0]["code"] is None
    assert p["activity"][0]["submissions"] == 2

    other = client.get("/api/progress", headers={"X-User-Id": "someone-else-02"}).json()
    assert other["completed"] == 0 and other["next_up"]["id"] == "linear_regression_gd"


def test_code_size_limit(client):
    r = client.post("/api/exercises/linear_regression_gd/submissions", headers=H, json={"code": "x" * 100_001})
    assert r.status_code == 422


def test_catalog_rejects_cycles(tmp_path):
    import shutil
    shutil.copytree(EX, tmp_path / "ex")
    meta_path = tmp_path / "ex" / "linear_regression_gd" / "exercise.json"
    meta = json.loads(meta_path.read_text())
    meta["prerequisites"] = ["self_attention_head"]
    meta_path.write_text(json.dumps(meta))
    with pytest.raises(ValueError, match="cycle"):
        Catalog(tmp_path / "ex")
