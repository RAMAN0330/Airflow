"""Hidden validation suite for linear_regression_gd.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import re
from pathlib import Path

import numpy as np
import pytest

import submission as sub


def _make_data(seed, m=200, n=3, noise=0.1):
    rng = np.random.default_rng(seed)
    X = rng.standard_normal((m, n))
    w_true = rng.uniform(-3, 3, size=n)
    b_true = rng.uniform(-2, 2)
    y = X @ w_true + b_true + noise * rng.standard_normal(m)
    return X, y


def _closed_form(X, y):
    Xa = np.hstack([X, np.ones((X.shape[0], 1))])
    theta, *_ = np.linalg.lstsq(Xa, y, rcond=None)
    return theta[:-1], theta[-1]


# ---------------------------------------------------------------- shapes

def test_predict_shape():
    X, _ = _make_data(0, m=17, n=4)
    y_hat = sub.predict(X, np.ones(4), 0.5)
    assert np.shape(y_hat) == (17,), f"predict returned shape {np.shape(y_hat)}, expected (17,)"


def test_gradient_shapes_and_types():
    X, y = _make_data(1, m=30, n=5)
    dw, db = sub.compute_gradients(X, y, np.zeros(5), 0.0)
    assert np.shape(dw) == (5,), f"dw has shape {np.shape(dw)}, expected (5,)"
    assert np.ndim(db) == 0, f"db should be a scalar, got shape {np.shape(db)}"


# ---------------------------------------------------------------- cost

def test_cost_known_value():
    X = np.array([[1.0], [2.0], [3.0]])
    y = np.array([2.0, 4.0, 6.0])
    # w=1, b=0 -> residuals [-1,-2,-3] -> sum sq 14 -> 14/6
    cost = sub.compute_cost(X, y, np.array([1.0]), 0.0)
    assert isinstance(cost, float), f"compute_cost should return float, got {type(cost).__name__}"
    assert cost == pytest.approx(14 / 6, rel=1e-9)


def test_cost_with_l2_penalty():
    X = np.array([[1.0], [2.0], [3.0]])
    y = np.array([2.0, 4.0, 6.0])
    cost = sub.compute_cost(X, y, np.array([1.0]), 0.0, lam=3.0)
    assert cost == pytest.approx(14 / 6 + 3.0 * 1.0 / 6, rel=1e-9)


# ---------------------------------------------------------------- gradients

@pytest.mark.parametrize("lam", [0.0, 0.5])
def test_gradients_match_finite_differences(lam):
    X, y = _make_data(2, m=40, n=3)
    rng = np.random.default_rng(3)
    w, b = rng.standard_normal(3), 0.7
    dw, db = sub.compute_gradients(X, y, w, b, lam)

    eps = 1e-6
    num_dw = np.zeros_like(w)
    for j in range(len(w)):
        e = np.zeros_like(w)
        e[j] = eps
        num_dw[j] = (sub.compute_cost(X, y, w + e, b, lam) - sub.compute_cost(X, y, w - e, b, lam)) / (2 * eps)
    num_db = (sub.compute_cost(X, y, w, b + eps, lam) - sub.compute_cost(X, y, w, b - eps, lam)) / (2 * eps)

    np.testing.assert_allclose(dw, num_dw, rtol=1e-5, atol=1e-7, err_msg="dw disagrees with numerical gradient")
    assert db == pytest.approx(num_db, rel=1e-5, abs=1e-7), "db disagrees with numerical gradient"


def test_bias_is_not_regularized():
    X, y = _make_data(4, m=25, n=2)
    w = np.array([1.5, -2.0])
    _, db0 = sub.compute_gradients(X, y, w, 0.3, lam=0.0)
    _, db1 = sub.compute_gradients(X, y, w, 0.3, lam=10.0)
    assert db0 == pytest.approx(db1), "lam must not affect the bias gradient"


# ---------------------------------------------------------------- training

def test_converges_to_closed_form():
    X, y = _make_data(5)
    w, b, _ = sub.gradient_descent(X, y, lr=0.1, n_iters=2000)
    w_star, b_star = _closed_form(X, y)
    assert np.shape(w) == (3,), f"returned w has shape {np.shape(w)}, expected (3,)"
    np.testing.assert_allclose(w, w_star, atol=1e-3, err_msg="weights did not converge to least-squares solution")
    assert b == pytest.approx(b_star, abs=1e-3), "bias did not converge to least-squares solution"


def test_cost_history_length_and_monotonic():
    X, y = _make_data(6)
    _, _, hist = sub.gradient_descent(X, y, lr=0.05, n_iters=300)
    hist = np.asarray(hist, dtype=float)
    assert hist.shape == (300,), f"cost_history has {hist.size} entries, expected 300"
    assert np.all(np.isfinite(hist)), "cost_history contains NaN/inf — learning rate or gradient sign?"
    assert np.all(np.diff(hist) <= 1e-12), "cost increased during descent"


def test_ridge_shrinks_weights():
    X, y = _make_data(7, m=60)
    w0, _, _ = sub.gradient_descent(X, y, lr=0.1, n_iters=1500, lam=0.0)
    w1, _, _ = sub.gradient_descent(X, y, lr=0.1, n_iters=1500, lam=30.0)
    assert np.linalg.norm(w1) < np.linalg.norm(w0), "L2 penalty should shrink ||w||"


# ---------------------------------------------------------------- purity

def test_inputs_not_mutated():
    X, y = _make_data(8, m=20)
    X_copy, y_copy = X.copy(), y.copy()
    sub.gradient_descent(X, y, lr=0.1, n_iters=10, lam=1.0)
    np.testing.assert_array_equal(X, X_copy, err_msg="X was modified in place")
    np.testing.assert_array_equal(y, y_copy, err_msg="y was modified in place")


def test_no_forbidden_solvers():
    src = Path(sub.__file__).read_text()
    banned = re.findall(r"\b(sklearn|scipy|lstsq|linalg\.solve|linalg\.inv|linalg\.pinv)\b", src)
    assert not banned, f"forbidden API used: {sorted(set(banned))}"
