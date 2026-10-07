"""Bug-injection checks for the mlops content group: each realistic bug must be caught by a specific hidden test."""
import ast
import json
from pathlib import Path

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
GATES = EX / "ml_cicd_gates"


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(old, new):
    src = (GATES / "solution.py").read_text()
    buggy = src.replace(old, new)
    assert buggy != src, f"mutation {old!r} did not apply"
    return buggy


def test_ml_cicd_gates_solution_passes_and_starter_fails():
    r = grade((GATES / "solution.py").read_text(), GATES)
    assert r["status"] == "passed" and r["passed_tests"] == r["total_tests"]
    r = grade((GATES / "starter.py").read_text(), GATES)
    assert r["status"] == "failed" and r["passed_tests"] == 0


def test_ml_cicd_gates_hints_match_tests():
    meta = json.loads((GATES / "exercise.json").read_text())
    tree = ast.parse((GATES / "tests_hidden.py").read_text())
    names = {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}
    assert set(meta["hints"]) == names


def test_python_hash_routing_is_caught():
    buggy = _mutate(
        'digest = hashlib.sha256(str(request_id).encode("utf-8")).digest()\n    return int.from_bytes(digest[:8], "big") % buckets',
        "return hash(str(request_id)) % buckets",
    )
    r, failed = _failed(buggy, GATES)
    assert r["status"] == "failed"
    assert "test_bucket_is_stable_sha256" in failed


def test_ignored_slice_regressions_are_caught():
    buggy = _mutate('failures.append(f"slice_regression:{name}")', "pass")
    r, failed = _failed(buggy, GATES)
    assert r["status"] == "failed"
    assert "test_gate_catches_slice_regression" in failed


def test_deciding_with_too_few_samples_is_caught():
    buggy = _mutate('return "continue"', "pass")
    r, failed = _failed(buggy, GATES)
    assert r["status"] == "failed"
    assert "test_canary_waits_for_min_samples" in failed


def test_batching_that_reorders_is_caught():
    # "Run the valid batch, then append the errors" puts results in the wrong slots.
    buggy = _mutate("        return results\n", '        return [r for r in results if r["ok"]] + [r for r in results if not r["ok"]]\n')
    r, failed = _failed(buggy, GATES)
    assert r["status"] == "failed"
    assert "test_server_batches_preserve_order" in failed


def test_interpolated_percentile_is_caught():
    buggy = _mutate("return float(data[rank - 1])", "return float(np.percentile(data, q))")
    r, failed = _failed(buggy, GATES)
    assert r["status"] == "failed"
    assert {"test_percentile_nearest_rank", "test_gate_latency_budget_uses_percentile"} <= failed
