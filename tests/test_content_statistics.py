"""Bug-injection checks for the statistics content group: each realistic bug must be caught by a specific hidden test."""
import ast
import json
from pathlib import Path

import pytest

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
EXERCISES = ["bootstrap_inference", "ab_test_analysis", "bayesian_ab_fdr"]


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(ex, old, new):
    src = (EX / ex / "solution.py").read_text()
    buggy = src.replace(old, new)
    assert buggy != src, f"mutation {old!r} did not apply"
    return buggy


@pytest.mark.parametrize("ex", EXERCISES)
def test_solution_passes_and_starter_fails(ex):
    r = grade((EX / ex / "solution.py").read_text(), EX / ex)
    assert r["status"] == "passed" and r["passed_tests"] == r["total_tests"]
    r = grade((EX / ex / "starter.py").read_text(), EX / ex)
    assert r["status"] == "failed" and r["passed_tests"] == 0


@pytest.mark.parametrize("ex", EXERCISES)
def test_hints_match_tests(ex):
    meta = json.loads((EX / ex / "exercise.json").read_text())
    tree = ast.parse((EX / ex / "tests_hidden.py").read_text())
    names = {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}
    assert set(meta["hints"]) == names
    assert meta["id"] == ex


BUGS = [
    # bootstrap_inference
    ("bootstrap_inference", "np.var(x, ddof=1)", "np.var(x)", "test_mean_and_variance_uses_ddof_1"),
    ("bootstrap_inference", "np.std(x, ddof=1) / np.sqrt(x.size)", "np.std(x) / np.sqrt(x.size)", "test_standard_error"),
    ("bootstrap_inference",
     "rng = np.random.default_rng(seed)\n    idx = rng.integers(0, x.size, size=(n_boot, x.size))",
     "rng = np.random.default_rng()\n    idx = rng.integers(0, x.size, size=(n_boot, x.size))",
     "test_bootstrap_is_seeded_and_reproducible"),
    ("bootstrap_inference",
     "idx = rng.integers(0, x.size, size=(n_boot, x.size))",
     "idx = np.tile(rng.integers(0, x.size, size=x.size), (n_boot, 1))",
     "test_bootstrap_is_seeded_and_reproducible"),
    ("bootstrap_inference", "[alpha / 2, 1 - alpha / 2]", "[1 - alpha / 2, alpha / 2]", "test_percentile_ci_order_and_values"),
    # ab_test_analysis
    ("ab_test_analysis", "p_value = math.erfc(abs(z) / math.sqrt(2.0))", "p_value = 0.5 * math.erfc(z / math.sqrt(2.0))",
     "test_p_value_is_two_sided"),
    ("ab_test_analysis", "se = math.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))",
     "se = math.sqrt(p_a * (1 - p_a) / n_a + p_b * (1 - p_b) / n_b)", "test_ztest_uses_pooled_se"),
    ("ab_test_analysis", 'if srm_check(n_a, n_b, expected_ratio, srm_threshold)["srm"]:', "if False:",
     "test_decide_checks_srm_first"),
    # bayesian_ab_fdr
    ("bayesian_ab_fdr", "    scaled = np.minimum.accumulate(scaled[::-1])[::-1]\n", "", "test_bh_adjusted_matches_reference"),
    ("bayesian_ab_fdr", "return float(prior_a + successes), float(prior_b + trials - successes)",
     "return float(successes), float(trials - successes)", "test_beta_posterior_adds_prior"),
    ("bayesian_ab_fdr", "return p <= alpha / m", "return p <= alpha * m", "test_bonferroni_threshold"),
]


@pytest.mark.parametrize("ex,old,new,test_name", BUGS, ids=[b[3] + ":" + b[2][:30] for b in BUGS])
def test_bug_is_caught(ex, old, new, test_name):
    r, failed = _failed(_mutate(ex, old, new), EX / ex)
    assert r["status"] == "failed"
    assert test_name in failed
