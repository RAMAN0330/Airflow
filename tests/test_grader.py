"""End-to-end tests for the grading pipeline and the exercise suites."""
from pathlib import Path

import pytest

from grader.run import grade

ROOT = Path(__file__).resolve().parents[1]
LINREG = ROOT / "exercises" / "linear_regression_gd"
ATTN = ROOT / "exercises" / "self_attention_head"
ACT = ROOT / "exercises" / "activation_functions"

EXPECTED_KEYS = {"exercise_id", "status", "passed_tests", "total_tests", "score", "tests",
                 "stdout", "stderr", "duration_ms", "error_tags", "remediation"}


@pytest.mark.parametrize("exercise", [LINREG, ACT, ATTN], ids=lambda p: p.name)
def test_reference_solution_passes_everything(exercise):
    r = grade((exercise / "solution.py").read_text(), exercise)
    assert set(r) == EXPECTED_KEYS
    assert r["status"] == "passed", r
    assert r["passed_tests"] == r["total_tests"] > 0


@pytest.mark.parametrize("exercise", [LINREG, ACT, ATTN], ids=lambda p: p.name)
def test_starter_imports_but_fails(exercise):
    r = grade((exercise / "starter.py").read_text(), exercise)
    assert r["status"] == "failed"
    assert r["total_tests"] > 0
    assert r["passed_tests"] < r["total_tests"]


def test_transpose_bug_is_tagged_as_shape_mismatch():
    buggy = (ATTN / "solution.py").read_text().replace("K.swapaxes(-1, -2)", "K.T")
    r = grade(buggy, ATTN)
    assert r["status"] == "failed"
    failed = {t["name"] for t in r["tests"] if t["outcome"] == "failed"}
    assert "test_attention_batched_matches_reference" in failed
    assert "test_attention_unbatched_matches_reference" not in failed
    assert "ShapeMismatch" in r["error_tags"]
    assert {"tag": "ShapeMismatch", "exercise": "linear_regression_gd"}.items() <= r["remediation"][0].items()
    batched = next(t for t in r["tests"] if t["name"] == "test_attention_batched_matches_reference")
    assert "swap only the last two axes" in batched["hint"].lower()


def test_missing_scale_is_caught():
    buggy = (ATTN / "solution.py").read_text().replace(" / np.sqrt(d_k)", "")
    r = grade(buggy, ATTN)
    failed = {t["name"] for t in r["tests"] if t["outcome"] == "failed"}
    assert "test_scaling_by_sqrt_dk_is_applied" in failed


def test_causal_leak_is_caught():
    buggy = (ATTN / "solution.py").read_text().replace(
        "np.tril(np.ones((T, T), dtype=bool))", "np.ones((T, T), dtype=bool)")
    r = grade(buggy, ATTN)
    failed = {t["name"] for t in r["tests"] if t["outcome"] == "failed"}
    assert {"test_causal_mask", "test_causal_head_ignores_future_tokens"} <= failed


def test_wrong_gradient_sign_is_caught():
    buggy = (LINREG / "solution.py").read_text().replace("w = w - lr * dw", "w = w + lr * dw")
    r = grade(buggy, LINREG)
    failed = {t["name"] for t in r["tests"] if t["outcome"] == "failed"}
    assert "test_cost_history_length_and_monotonic" in failed
    assert "test_converges_to_closed_form" in failed


def test_regularized_bias_is_caught():
    buggy = (LINREG / "solution.py").read_text().replace(
        "db = float(residual.mean())", "db = float(residual.mean()) + (lam / m) * b")
    r = grade(buggy, LINREG)
    failed = {t["name"] for t in r["tests"] if t["outcome"] == "failed"}
    assert "test_bias_is_not_regularized" in failed


def test_forbidden_solver_is_caught():
    cheat = (LINREG / "solution.py").read_text() + "\n_ = np.linalg.lstsq\n"
    r = grade(cheat, LINREG)
    failed = {t["name"] for t in r["tests"] if t["outcome"] == "failed"}
    assert failed == {"test_no_forbidden_solvers"}


def test_learner_stdout_is_returned():
    code = (LINREG / "solution.py").read_text().replace(
        "def predict(X, w, b):\n", "def predict(X, w, b):\n    print('debug-predict')\n")
    r = grade(code, LINREG)
    assert r["status"] == "passed"
    assert "debug-predict" in r["stdout"]


def test_syntax_error_reports_error_status():
    r = grade("def predict(X, w, b:\n    pass\n", LINREG)
    assert r["status"] == "error"
    assert r["total_tests"] == 0
    assert "SyntaxError" in r["stderr"]


def test_infinite_loop_times_out():
    code = (LINREG / "solution.py").read_text() + "\nwhile True:\n    pass\n"
    r = grade(code, LINREG, timeout=3)
    assert r["status"] == "timeout"
    assert r["duration_ms"] < 10_000


def test_cpu_limit_reports_timeout():
    r = grade("while True:\n    pass\n", LINREG, timeout=60)
    assert r["status"] == "timeout"
    assert "CPU-time limit" in r["stderr"]
    assert r["duration_ms"] < 20_000


def test_memory_bomb_is_contained():
    code = (LINREG / "solution.py").read_text().replace(
        "def predict(X, w, b):\n", "def predict(X, w, b):\n    _ = np.ones(10**10)\n")
    r = grade(code, LINREG)
    assert r["status"] == "failed"
    errors = {t["error_type"] for t in r["tests"] if t["outcome"] == "failed"}
    assert "MemoryError" in errors or "_ArrayMemoryError" in errors


def test_unstable_softmax_is_tagged_and_hinted():
    buggy = (ACT / "solution.py").read_text().replace("np.exp(x - np.max(x, axis=axis, keepdims=True))", "np.exp(x)")
    r = grade(buggy, ACT)
    failed = {t["name"]: t for t in r["tests"] if t["outcome"] == "failed"}
    assert set(failed) == {"test_softmax_is_numerically_stable"}
    assert "NaNInSoftmax" in r["error_tags"]
    assert failed["test_softmax_is_numerically_stable"]["hint"]


def test_every_hidden_test_has_a_hint():
    import ast, json
    for ex in (LINREG, ACT, ATTN):
        hints = json.loads((ex / "exercise.json").read_text())["hints"]
        tree = ast.parse((ex / "tests_hidden.py").read_text())
        names = {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}
        assert names == set(hints), f"{ex.name}: hint keys out of sync with tests"
