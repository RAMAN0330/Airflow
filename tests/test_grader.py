"""End-to-end tests for the grading pipeline and the exercise suites."""
from pathlib import Path

import pytest

from grader.run import grade

ROOT = Path(__file__).resolve().parents[1]
LINREG = ROOT / "exercises" / "linear_regression_gd"
ATTN = ROOT / "exercises" / "self_attention_head"
ACT = ROOT / "exercises" / "activation_functions"
ALL_EXERCISES = sorted(p.parent for p in (ROOT / "exercises").glob("*/exercise.json"))
EX = ROOT / "exercises"

EXPECTED_KEYS = {"exercise_id", "status", "passed_tests", "total_tests", "score", "tests",
                 "stdout", "stderr", "duration_ms", "error_tags", "remediation"}


@pytest.mark.parametrize("exercise", ALL_EXERCISES, ids=lambda p: p.name)
def test_reference_solution_passes_everything(exercise):
    r = grade((exercise / "solution.py").read_text(), exercise)
    assert set(r) == EXPECTED_KEYS
    assert r["status"] == "passed", r
    assert r["passed_tests"] == r["total_tests"] > 0


@pytest.mark.parametrize("exercise", ALL_EXERCISES, ids=lambda p: p.name)
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
    assert len(ALL_EXERCISES) == 11
    for ex in ALL_EXERCISES:
        hints = json.loads((ex / "exercise.json").read_text())["hints"]
        tree = ast.parse((ex / "tests_hidden.py").read_text())
        names = {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}
        assert names == set(hints), f"{ex.name}: hint keys out of sync with tests"



def _failed(code, exercise):
    r = grade(code, exercise)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def test_sql_wrong_grain_is_caught():
    # COUNT(*) over a join counts order lines, not orders.
    code = (EX / "sql_analytics_queries" / "solution.py").read_text().replace(
        "COUNT(DISTINCT o.order_id) AS orders", "COUNT(*) AS orders")
    _, failed = _failed(code, EX / "sql_analytics_queries")
    assert failed == {"test_monthly_revenue"}


def test_non_atomic_transfer_is_caught():
    code = (EX / "sql_indexes_transactions" / "solution.py").read_text().replace(
        "    with conn:  # commit on success, roll back on any exception", "    if True:")
    _, failed = _failed(code, EX / "sql_indexes_transactions")
    assert "test_failure_midway_is_atomic" in failed


def test_plain_insert_is_not_idempotent():
    code = (EX / "etl_pipeline" / "solution.py").read_text().replace(
        'f"ON CONFLICT (order_id) DO UPDATE SET {updates}"', '""').replace(
        "INSERT INTO fact_orders", "INSERT OR IGNORE INTO fact_orders")
    _, failed = _failed(code, EX / "etl_pipeline")
    assert "test_rerun_applies_corrections" in failed


def test_watermark_reset_on_empty_batch_is_caught():
    code = (EX / "data_quality_checks" / "solution.py").read_text().replace(
        'return batch, (batch[-1]["updated_at"] if batch else watermark)',
        'return batch, (batch[-1]["updated_at"] if batch else None)')
    _, failed = _failed(code, EX / "data_quality_checks")
    assert failed == {"test_incremental_no_new_rows_keeps_watermark"}


def test_upstream_failure_not_propagated_is_caught():
    code = (EX / "dag_scheduler" / "solution.py").read_text().replace(
        'if any(result[u]["state"] != "success" for u in dag[t]):', "if False:")
    _, failed = _failed(code, EX / "dag_scheduler")
    assert "test_failure_propagates_downstream" in failed


def test_promotion_without_archiving_is_caught():
    code = (EX / "model_registry" / "solution.py").read_text().replace(
        'self._models[name][current]["stage"] = "Archived"\n            if current != version:',
        'pass\n            if current != version:')
    _, failed = _failed(code, EX / "model_registry")
    assert "test_promotion_archives_previous_production" in failed


def test_psi_without_eps_clip_is_caught():
    code = (EX / "drift_detection" / "solution.py").read_text().replace(
        "np.clip(np.histogram(cur, edges)[0] / cur.size, eps, None)", "np.histogram(cur, edges)[0] / cur.size")
    _, failed = _failed(code, EX / "drift_detection")
    assert "test_psi_constant_reference_is_finite" in failed


def test_leaky_latest_value_join_is_caught():
    code = (EX / "point_in_time_join" / "solution.py").read_text().replace(
        'i = bisect_right(stamps, label["event_ts"]) - 1', "i = len(stamps) - 1")
    _, failed = _failed(code, EX / "point_in_time_join")
    assert {"test_never_uses_future_features", "test_joins_latest_feature_at_or_before_event"} <= failed


def test_quadratic_join_is_too_slow():
    code = """
def point_in_time_join(labels, features, ttl=None):
    out = []
    for label in labels:
        best = None
        for f in features:
            if f["entity_id"] == label["entity_id"] and f["feature_ts"] <= label["event_ts"]:
                if best is None or f["feature_ts"] >= best["feature_ts"]:
                    best = f
        if best is not None and ttl is not None and label["event_ts"] - best["feature_ts"] > ttl:
            best = None
        out.append({**label, "feature_ts": best and best["feature_ts"],
                    "features": best and {k: v for k, v in best.items() if k not in ("entity_id", "feature_ts")}})
    return out


def detect_leakage(rows):
    return [i for i, r in enumerate(rows) if r.get("feature_ts") is not None and r["feature_ts"] > r["event_ts"]]
"""
    r = grade(code, EX / "point_in_time_join")
    assert r["status"] == "timeout", "an O(n·m) join should exhaust the sandbox CPU budget"
