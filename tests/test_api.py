"""API tests: sequential unlocking, lessons/quizzes, submissions, plans, progress and leaderboard."""
import json
import shutil
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api.catalog import Catalog
from api.config import Settings
from api.main import create_app

ROOT = Path(__file__).resolve().parents[1]
EX = ROOT / "exercises"
LESSONS = ROOT / "lessons"
H = {"X-User-Id": "test-user-0001"}
H2 = {"X-User-Id": "test-user-0002"}


def solution(eid):
    return (EX / eid / "solution.py").read_text()


def correct_answers(lesson_id):
    qs = json.loads((LESSONS / lesson_id / "quiz.json").read_text())["questions"]
    return {q["id"]: q["answer"] for q in qs}


def make_client(tmp_path, **overrides):
    settings = Settings(exercises_dir=EX, lessons_dir=LESSONS, database_path=tmp_path / "t.db",
                        max_concurrent_runs=2, **overrides)
    return TestClient(create_app(settings))


@pytest.fixture
def client(tmp_path):
    with make_client(tmp_path) as c:
        yield c


def pass_lesson(client, lesson_id, headers=H):
    r = client.post(f"/api/lessons/{lesson_id}/attempts", headers=headers, json={"answers": correct_answers(lesson_id)})
    assert r.status_code == 200, r.text
    return r.json()


def pass_exercise(client, eid, headers=H):
    r = client.post(f"/api/exercises/{eid}/submissions", headers=headers, json={"code": solution(eid)})
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "passed"
    return r.json()


def statuses(client, headers=H):
    out = {}
    for c in client.get("/api/courses", headers=headers).json():
        out[c["id"]] = c["status"]
        for m in c["modules"]:
            for kind in ("lesson", "exercise"):
                if m[kind]:
                    out[m[kind]["id"]] = m[kind]["status"]
    return out


# ------------------------------------------------------------------ identity

def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_user_id_is_required_and_validated(client):
    assert client.get("/api/courses").status_code == 422
    assert client.get("/api/courses", headers={"X-User-Id": "bad id!"}).status_code == 400


def test_me_defaults_and_rename(client):
    me = client.get("/api/me", headers=H).json()
    assert me["plan"] == "free" and me["xp"] == 0 and me["rank"] is None
    assert len(me["display_name"].split()) == 3  # e.g. "Curious Otter 42"
    assert client.get("/api/me", headers=H).json()["display_name"] == me["display_name"], "name must be stable"

    r = client.patch("/api/me", headers=H, json={"display_name": "  Ada   Lovelace "})
    assert r.json()["display_name"] == "Ada Lovelace"
    assert client.patch("/api/me", headers=H, json={"display_name": "<script>"}).status_code == 422
    assert client.patch("/api/me", headers=H, json={"display_name": "x"}).status_code == 422


# ------------------------------------------------------------------ sequencing

def test_fresh_learner_sees_only_first_lesson_unlocked(client):
    courses = client.get("/api/courses", headers=H).json()
    assert [c["id"] for c in courses] == ["classical-ml", "deep-learning", "genai-llms"]
    assert [c["position"] for c in courses] == [1, 2, 3]
    assert statuses(client) == {
        "classical-ml": "available",
        "gradient_descent_intuition": "available",
        "linear_regression_gd": "locked",
        "deep-learning": "locked",
        "activations_and_backprop": "locked",
        "activation_functions": "locked",
        "genai-llms": "upgrade_required",
        "attention_intuition": "locked",
        "self_attention_head": "locked",
    }
    ex = courses[0]["modules"][0]["exercise"]
    assert ex["lock_reason"]["kind"] == "previous_step"
    assert ex["lock_reason"]["target"]["id"] == "gradient_descent_intuition"
    assert courses[1]["lock_reason"]["kind"] == "previous_course"
    assert courses[2]["lock_reason"]["kind"] == "plan"
    assert courses[0]["modules"][1]["coming_soon"] is True
    assert courses[0]["total_steps"] == 2 and courses[0]["total_xp"] == 125


def test_exercise_locked_until_lesson_passed(client):
    r = client.post("/api/exercises/linear_regression_gd/submissions", headers=H, json={"code": solution("linear_regression_gd")})
    assert r.status_code == 403
    assert "Gradient Descent, From the Loss Up" in r.json()["detail"]

    detail = client.get("/api/exercises/linear_regression_gd", headers=H).json()
    assert detail["status"] == "locked"
    assert "def predict" in detail["starter_code"], "sequence-locked exercises stay previewable"
    assert detail["lesson"]["id"] == "gradient_descent_intuition"
    assert detail["next"]["id"] == "activations_and_backprop"
    assert detail["course"] == {"id": "classical-ml", "title": "Classical Machine Learning", "tier": "free"}


def test_quiz_grading_hides_answers_until_correct(client):
    lesson = client.get("/api/lessons/gradient_descent_intuition", headers=H).json()
    assert lesson["status"] == "available" and lesson["completed_at"] is None
    assert all(set(q) == {"id", "prompt", "options"} for q in lesson["questions"]), "answers must not leak"
    assert lesson["next"]["id"] == "linear_regression_gd" and lesson["next"]["status"] == "locked"

    answers = correct_answers("gradient_descent_intuition")
    wrong = {**answers, "q2": (answers["q2"] + 1) % 4}
    r = client.post("/api/lessons/gradient_descent_intuition/attempts", headers=H, json={"answers": wrong}).json()
    assert r["passed"] is False and r["newly_completed"] is False and r["xp_earned"] == 0 and r["unlocked"] == []
    by_id = {x["id"]: x for x in r["results"]}
    assert by_id["q2"] == {"id": "q2", "correct": False, "explanation": None}
    assert by_id["q1"]["correct"] and by_id["q1"]["explanation"]

    missing = client.post("/api/lessons/gradient_descent_intuition/attempts", headers=H, json={"answers": {"q1": 1}})
    assert missing.status_code == 422

    r = pass_lesson(client, "gradient_descent_intuition")
    assert r["passed"] and r["newly_completed"] and r["xp_earned"] == 25
    assert [u["id"] for u in r["unlocked"]] == ["linear_regression_gd"]
    assert pass_lesson(client, "gradient_descent_intuition")["newly_completed"] is False


def test_locked_lesson_rejects_attempts(client):
    r = client.post("/api/lessons/activations_and_backprop/attempts", headers=H,
                    json={"answers": correct_answers("activations_and_backprop")})
    assert r.status_code == 403
    assert "Classical Machine Learning" in r.json()["detail"]


def test_completing_a_course_unlocks_the_next(client):
    pass_lesson(client, "gradient_descent_intuition")

    starter = client.get("/api/exercises/linear_regression_gd", headers=H).json()["starter_code"]
    failed = client.post("/api/exercises/linear_regression_gd/submissions", headers=H, json={"code": starter}).json()
    assert failed["status"] == "failed" and not failed["newly_completed"] and failed["xp_earned"] == 0
    assert any(t["hint"] for t in failed["result"]["tests"] if t["outcome"] == "failed")
    assert statuses(client)["linear_regression_gd"] == "in_progress"
    assert statuses(client)["classical-ml"] == "in_progress"

    passed = pass_exercise(client, "linear_regression_gd")
    assert passed["newly_completed"] and passed["xp_earned"] == 100
    assert [u["id"] for u in passed["unlocked"]] == ["activations_and_backprop"]
    s = statuses(client)
    assert s["classical-ml"] == "completed" and s["deep-learning"] == "available"
    assert s["activation_functions"] == "locked"

    again = pass_exercise(client, "linear_regression_gd")
    assert again["newly_completed"] is False and again["xp_earned"] == 0 and again["unlocked"] == []

    history = client.get("/api/exercises/linear_regression_gd/submissions", headers=H).json()
    assert [h["status"] for h in history] == ["passed", "passed", "failed"]
    assert history[-1]["code"] == starter


def test_pro_course_requires_plan_and_demo_checkout(client):
    for lesson, ex in (("gradient_descent_intuition", "linear_regression_gd"), ("activations_and_backprop", "activation_functions")):
        pass_lesson(client, lesson)
        pass_exercise(client, ex)
    s = statuses(client)
    assert s["deep-learning"] == "completed" and s["genai-llms"] == "upgrade_required"
    r = client.post("/api/lessons/attention_intuition/attempts", headers=H, json={"answers": correct_answers("attention_intuition")})
    assert r.status_code == 403 and "Pro" in r.json()["detail"]

    # Pro content is withheld from free learners; sequence-locked content is still previewable.
    paywalled = client.get("/api/lessons/attention_intuition", headers=H).json()
    assert paywalled["markdown"] == "" and paywalled["questions"] == []
    ex = client.get("/api/exercises/self_attention_head", headers=H).json()
    assert ex["task_markdown"] == "" and ex["starter_code"] == ""

    me = client.post("/api/billing/checkout", headers=H, json={"plan": "pro", "interval": "year"}).json()
    assert me["plan"] == "pro" and me["billing_mode"] == "demo"
    s = statuses(client)
    assert s["genai-llms"] == "available" and s["attention_intuition"] == "available"

    pass_lesson(client, "attention_intuition")
    done = pass_exercise(client, "self_attention_head")
    assert done["xp_earned"] == 200 and done["unlocked"] == []
    assert statuses(client)["genai-llms"] == "completed"

    # Downgrading keeps completed work; the Pro course locks again.
    assert client.post("/api/billing/cancel", headers=H).json()["plan"] == "free"
    s = statuses(client)
    assert s["genai-llms"] == "upgrade_required" and s["self_attention_head"] == "completed"


def test_billing_disabled_returns_501(tmp_path):
    with make_client(tmp_path, billing_mode="disabled") as c:
        assert c.post("/api/billing/checkout", headers=H, json={}).status_code == 501
        assert c.get("/api/me", headers=H).json()["billing_mode"] == "disabled"


# ------------------------------------------------------------------ progress & leaderboard

def test_progress(client):
    pass_lesson(client, "gradient_descent_intuition")
    pass_exercise(client, "linear_regression_gd")
    p = client.get("/api/progress", headers=H).json()
    assert (p["xp"], p["rank"]) == (125, 1)
    assert (p["exercises_completed"], p["total_exercises"]) == (1, 3)
    assert (p["lessons_completed"], p["total_lessons"]) == (1, 3)
    assert p["total_submissions"] == 1 and p["pass_rate"] == 1.0
    assert p["next_up"] == {"kind": "lesson", "id": "activations_and_backprop", "title": p["next_up"]["title"],
                            "status": "available", "course_id": "deep-learning"}
    assert [c["status"] for c in p["courses"]] == ["completed", "available", "upgrade_required"]
    assert p["recent"][0]["code"] is None and p["activity"][0]["submissions"] == 1

    fresh = client.get("/api/progress", headers=H2).json()
    assert fresh["xp"] == 0 and fresh["rank"] is None and fresh["next_up"]["id"] == "gradient_descent_intuition"


def test_leaderboard_ranks_by_xp(client):
    client.patch("/api/me", headers=H, json={"display_name": "Ada"})
    client.patch("/api/me", headers=H2, json={"display_name": "Grace"})
    pass_lesson(client, "gradient_descent_intuition", H)
    pass_exercise(client, "linear_regression_gd", H)
    pass_lesson(client, "gradient_descent_intuition", H2)

    board = client.get("/api/leaderboard", headers=H2).json()
    assert board["total_learners"] == 2
    assert [(e["rank"], e["display_name"], e["xp"], e["is_me"]) for e in board["entries"]] == [
        (1, "Ada", 125, False), (2, "Grace", 25, True)]
    assert board["me"]["rank"] == 2 and board["me"]["lessons_completed"] == 1
    assert "user_id" not in json.dumps(board), "learner ids must not leak"

    week = client.get("/api/leaderboard?period=week", headers=H).json()
    assert week["period"] == "week" and week["entries"][0]["xp"] == 125

    nobody = client.get("/api/leaderboard", headers={"X-User-Id": "lurker-00003"}).json()
    assert nobody["me"] is None
    assert client.get("/api/leaderboard?period=year", headers=H).status_code == 422
    assert client.get("/api/me", headers=H2).json()["rank"] == 2


def test_code_size_limit(client):
    pass_lesson(client, "gradient_descent_intuition")
    r = client.post("/api/exercises/linear_regression_gd/submissions", headers=H, json={"code": "x" * 100_001})
    assert r.status_code == 422


def test_unknown_content_404(client):
    assert client.get("/api/exercises/nope", headers=H).status_code == 404
    assert client.get("/api/lessons/nope", headers=H).status_code == 404
    assert client.get("/api/courses/nope", headers=H).status_code == 404


# ------------------------------------------------------------------ catalog validation

def _copy_content(tmp_path):
    shutil.copytree(EX, tmp_path / "ex")
    shutil.copytree(LESSONS, tmp_path / "lessons")
    return tmp_path / "ex", tmp_path / "lessons"


def test_catalog_rejects_unreferenced_content(tmp_path):
    ex, lessons = _copy_content(tmp_path)
    cur = json.loads((ex / "curriculum.json").read_text())
    cur["courses"][0]["modules"][0]["lesson"] = None
    (ex / "curriculum.json").write_text(json.dumps(cur))
    with pytest.raises(ValueError, match="not referenced"):
        Catalog(ex, lessons)


def test_catalog_rejects_duplicate_steps(tmp_path):
    ex, lessons = _copy_content(tmp_path)
    cur = json.loads((ex / "curriculum.json").read_text())
    cur["courses"][1]["modules"][1]["exercise"] = "linear_regression_gd"
    (ex / "curriculum.json").write_text(json.dumps(cur))
    with pytest.raises(ValueError, match="more than once"):
        Catalog(ex, lessons)
