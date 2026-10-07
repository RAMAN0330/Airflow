"""Bug-injection tests for the classical ML content (logistic regression / SVM, trees / forests).

Each test mutates a reference solution with a realistic mistake and checks that a specific
hidden test catches it.
"""
from pathlib import Path

import pytest

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
LOGSVM = EX / "logistic_regression_svm"
TREES = EX / "decision_tree_forest"


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(ex, old, new):
    src = (ex / "solution.py").read_text()
    buggy = src.replace(old, new)
    assert buggy != src, f"mutation {old!r} did not apply"
    return buggy


@pytest.mark.parametrize("ex", [LOGSVM, TREES], ids=lambda p: p.name)
def test_hints_cover_exactly_the_hidden_tests(ex):
    import json
    import re
    names = set(re.findall(r"^def (test_\w+)\(", (ex / "tests_hidden.py").read_text(), re.M))
    hints = set(json.loads((ex / "exercise.json").read_text())["hints"])
    assert names == hints


# ---------------------------------------------------------------- logistic_regression_svm

def test_unstable_sigmoid_is_caught():
    buggy = _mutate(LOGSVM, "ez = np.exp(z[~pos])\n    out[~pos] = ez / (1.0 + ez)",
                    "out[~pos] = 1.0 / (1.0 + np.exp(-z[~pos]))")
    r, failed = _failed(buggy, LOGSVM)
    assert r["status"] == "failed"
    assert "test_sigmoid_is_overflow_safe" in failed
    assert "test_sigmoid_values_and_symmetry" not in failed
    assert "NaNInSoftmax" in r["error_tags"]


def test_missing_mean_in_gradient_is_caught():
    buggy = _mutate(LOGSVM, "dw = X.T @ residual / m +", "dw = X.T @ residual +")
    r, failed = _failed(buggy, LOGSVM)
    assert r["status"] == "failed"
    assert "test_bce_gradients_match_finite_differences" in failed


def test_regularized_bias_is_caught():
    buggy = _mutate(LOGSVM, "db = float(residual.mean())", "db = float(residual.mean() + (lam / m) * b)")
    r, failed = _failed(buggy, LOGSVM)
    assert r["status"] == "failed"
    assert "test_bias_is_not_regularized" in failed


def test_inclusive_hinge_margin_is_caught():
    buggy = _mutate(LOGSVM, "active = margins < 1", "active = margins <= 1")
    r, failed = _failed(buggy, LOGSVM)
    assert r["status"] == "failed"
    assert "test_svm_subgradient_known_values" in failed


# ---------------------------------------------------------------- decision_tree_forest

def test_unweighted_child_impurity_is_caught():
    buggy = _mutate(TREES, "child = (n_left * impurity(y[left]) + (n - n_left) * impurity(y[~left])) / n",
                    "child = (impurity(y[left]) + impurity(y[~left])) / 2")
    r, failed = _failed(buggy, TREES)
    assert r["status"] == "failed"
    assert "test_best_split_weights_children_by_size" in failed


def test_strict_threshold_in_predict_is_caught():
    buggy = _mutate(TREES, 'node["left"] if x[node["feature"]] <= node["threshold"]',
                    'node["left"] if x[node["feature"]] < node["threshold"]')
    r, failed = _failed(buggy, TREES)
    assert r["status"] == "failed"
    assert "test_threshold_ties_go_left" in failed


def test_natural_log_entropy_is_caught():
    buggy = _mutate(TREES, "np.log2(p)", "np.log(p)")
    r, failed = _failed(buggy, TREES)
    assert r["status"] == "failed"
    assert "test_impurity_known_values" in failed


def test_bootstrap_without_replacement_is_caught():
    buggy = _mutate(TREES, "rng.integers(0, n, size=n)", "rng.permutation(n)")
    r, failed = _failed(buggy, TREES)
    assert r["status"] == "failed"
    assert "test_forest_bootstrap_is_seeded" in failed
