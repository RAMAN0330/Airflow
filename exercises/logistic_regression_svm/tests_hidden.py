"""Hidden validation suite for logistic_regression_svm.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import math
import re
import warnings
from pathlib import Path

import numpy as np
import pytest

import submission as sub


def _logistic_data(seed, m=200, n=3):
    rng = np.random.default_rng(seed)
    X = rng.standard_normal((m, n))
    w_true = rng.uniform(-2, 2, size=n)
    p = 1.0 / (1.0 + np.exp(-(X @ w_true + 0.5)))
    y = (rng.uniform(size=m) < p).astype(float)
    return X, y


def _blobs(seed, m=80):
    rng = np.random.default_rng(seed)
    X = np.vstack([rng.normal(loc=(2.0, 2.0), scale=0.6, size=(m // 2, 2)),
                   rng.normal(loc=(-2.0, -1.5), scale=0.6, size=(m // 2, 2))])
    y = np.concatenate([np.ones(m // 2), -np.ones(m // 2)])
    return X, y


def _ref_sigmoid(z):
    return np.array([1.0 / (1.0 + math.exp(-v)) if v >= 0 else math.exp(v) / (1.0 + math.exp(v)) for v in z])


def _ref_bce(X, y, w, b, lam):
    m = len(y)
    total = 0.0
    for xi, yi in zip(X, y):
        z = float(xi @ w + b)
        # log(1 + e^z) computed stably, minus y*z
        total += (max(z, 0.0) + math.log1p(math.exp(-abs(z)))) - yi * z
    return total / m + lam * float(w @ w) / (2 * m)


# ---------------------------------------------------------------- sigmoid

def test_sigmoid_values_and_symmetry():
    s0 = sub.sigmoid(0.0)
    assert isinstance(s0, float), f"sigmoid(scalar) should return a float, got {type(s0).__name__}"
    assert s0 == pytest.approx(0.5)
    z = np.linspace(-8, 8, 33)
    s = np.asarray(sub.sigmoid(z))
    assert s.shape == z.shape, f"sigmoid changed the shape: {s.shape} vs {z.shape}"
    np.testing.assert_allclose(s, _ref_sigmoid(z), rtol=1e-12)
    np.testing.assert_allclose(np.asarray(sub.sigmoid(-z)), 1.0 - s, atol=1e-12,
                               err_msg="sigmoid(-z) should equal 1 - sigmoid(z)")


def test_sigmoid_is_overflow_safe():
    z = np.array([-1000.0, -60.0, -1.0, 0.0, 1.0, 60.0, 1000.0])
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        s = np.asarray(sub.sigmoid(z))
        s_scalar = sub.sigmoid(-1000.0)
    assert np.all(np.isfinite(s)), "sigmoid returned NaN/inf for large |z|"
    np.testing.assert_allclose(s, _ref_sigmoid(z), rtol=1e-12, atol=0.0)
    assert s_scalar == 0.0 or s_scalar < 1e-300


# ---------------------------------------------------------------- loss & gradients

@pytest.mark.parametrize("lam", [0.0, 2.0])
def test_bce_loss_matches_reference(lam):
    X, y = _logistic_data(1, m=50)
    w, b = np.array([0.4, -1.2, 0.7]), -0.3
    loss = sub.bce_loss(X, y, w, b, lam=lam)
    assert isinstance(loss, float), f"bce_loss should return float, got {type(loss).__name__}"
    assert loss == pytest.approx(_ref_bce(X, y, w, b, lam), rel=1e-10)

    # Confidently wrong predictions: loss must be large but finite and exact (no clipping).
    Xc = np.array([[1.0], [-1.0]])
    yc = np.array([0.0, 1.0])
    conf = sub.bce_loss(Xc, yc, np.array([50.0]), 0.0)
    assert math.isfinite(conf), "bce_loss overflowed for a confident wrong prediction"
    assert conf == pytest.approx(50.0, rel=1e-9), "use log(1 + e^z) - y*z rather than log of a clipped probability"


@pytest.mark.parametrize("lam", [0.0, 0.8])
def test_bce_gradients_match_finite_differences(lam):
    X, y = _logistic_data(2, m=60)
    rng = np.random.default_rng(3)
    w, b = rng.standard_normal(3), 0.4
    dw, db = sub.bce_gradients(X, y, w, b, lam)
    assert np.shape(dw) == (3,), f"dw has shape {np.shape(dw)}, expected (3,)"
    assert np.ndim(db) == 0, "db should be a scalar"

    eps = 1e-6
    num_dw = np.zeros(3)
    for j in range(3):
        e = np.zeros(3)
        e[j] = eps
        num_dw[j] = (_ref_bce(X, y, w + e, b, lam) - _ref_bce(X, y, w - e, b, lam)) / (2 * eps)
    num_db = (_ref_bce(X, y, w, b + eps, lam) - _ref_bce(X, y, w, b - eps, lam)) / (2 * eps)
    np.testing.assert_allclose(dw, num_dw, rtol=1e-5, atol=1e-7, err_msg="dw disagrees with numerical gradient")
    assert db == pytest.approx(num_db, rel=1e-5, abs=1e-7), "db disagrees with numerical gradient"


def test_bias_is_not_regularized():
    X, y = _logistic_data(4, m=40)
    w = np.array([1.0, -0.5, 0.25])
    _, db0 = sub.bce_gradients(X, y, w, 1.5, lam=0.0)
    _, db1 = sub.bce_gradients(X, y, w, 1.5, lam=25.0)
    assert db0 == pytest.approx(db1, abs=1e-12), "lam must not affect the bias gradient"


# ---------------------------------------------------------------- training

def test_fit_logistic_matches_reference_descent():
    X, y = _logistic_data(5)
    lr, n_iters, lam = 0.5, 300, 1.0
    w_ref, b_ref = np.zeros(3), 0.0
    for _ in range(n_iters):
        p = _ref_sigmoid(X @ w_ref + b_ref)
        r = p - y
        w_ref, b_ref = w_ref - lr * (X.T @ r / len(y) + lam / len(y) * w_ref), b_ref - lr * r.mean()

    w, b = sub.fit_logistic(X, y, lr=lr, n_iters=n_iters, lam=lam)
    assert np.shape(w) == (3,), f"returned w has shape {np.shape(w)}, expected (3,)"
    np.testing.assert_allclose(w, w_ref, atol=1e-8, err_msg="weights differ from batch gradient descent")
    assert b == pytest.approx(b_ref, abs=1e-8)

    p = np.asarray(sub.predict_proba(X, w, b))
    assert p.shape == (200,), f"predict_proba returned shape {p.shape}, expected (200,)"
    assert np.all((p > 0) & (p < 1))
    assert np.mean((p >= 0.5) == (y == 1)) > 0.75, "a fitted model should beat 75% training accuracy here"


def test_svm_subgradient_known_values():
    X = np.array([[2.0, 0.0], [0.5, 0.0], [-1.0, 0.0], [0.0, 3.0]])
    y = np.array([1.0, 1.0, -1.0, -1.0])
    w, b = np.array([1.0, 0.0]), 0.0
    # margins: 2.0 (inactive), 0.5 (active), 1.0 (exactly 1 -> inactive), 0.0 (active)
    dw, db = sub.svm_subgradient(X, y, w, b, lam=0.1)
    expected_dw = 0.1 * w - (1.0 * X[1] + (-1.0) * X[3]) / 4
    np.testing.assert_allclose(dw, expected_dw, atol=1e-12,
                               err_msg="only examples with margin strictly below 1 should contribute")
    assert db == pytest.approx(-(1.0 - 1.0) / 4, abs=1e-12)

    _, db2 = sub.svm_subgradient(X[:2], y[:2], w, b, lam=0.1)
    assert db2 == pytest.approx(-1.0 / 2), "db is -(1/m) * sum of y over active examples"


def test_linear_svm_separates_blobs():
    X, y = _blobs(6)
    w, b = sub.fit_linear_svm(X, y, lr=0.1, n_iters=500, lam=0.01)
    pred = np.sign(X @ w + b)
    assert np.all(pred == y), "a linear SVM should separate two well-separated blobs"
    margins = y * (X @ w + b)
    assert margins.min() > 0.5, "after training, every point should sit near or beyond the margin"

    w2, b2 = sub.fit_linear_svm(X, y, lr=0.1, n_iters=500, lam=0.01)
    np.testing.assert_array_equal(w, w2, err_msg="training must be deterministic")
    with pytest.raises(ValueError):
        sub.fit_linear_svm(X, (y > 0).astype(float), n_iters=5)


# ---------------------------------------------------------------- kernels

def test_rbf_kernel_matches_reference():
    rng = np.random.default_rng(7)
    A = rng.standard_normal((6, 3))
    B = rng.standard_normal((4, 3))
    K = np.asarray(sub.rbf_kernel(A, B, gamma=0.7))
    assert K.shape == (6, 4), f"kernel matrix has shape {K.shape}, expected (6, 4)"
    ref = np.array([[math.exp(-0.7 * float(np.sum((a - c) ** 2))) for c in B] for a in A])
    np.testing.assert_allclose(K, ref, rtol=1e-10)

    KA = np.asarray(sub.rbf_kernel(A, A, gamma=2.0))
    np.testing.assert_allclose(np.diag(KA), 1.0, atol=1e-12, err_msg="K(x, x) must be 1")
    np.testing.assert_allclose(KA, KA.T, atol=1e-12, err_msg="K(A, A) must be symmetric")
    assert np.all((KA > 0) & (KA <= 1.0 + 1e-12))
    assert np.min(np.linalg.eigvalsh(KA)) > -1e-10, "an RBF Gram matrix is positive semi-definite"


# ---------------------------------------------------------------- purity

def test_inputs_not_mutated():
    X, y = _logistic_data(8, m=30)
    Xs, ys = _blobs(9, m=20)
    copies = [a.copy() for a in (X, y, Xs, ys)]
    sub.fit_logistic(X, y, lr=0.1, n_iters=5, lam=1.0)
    sub.fit_linear_svm(Xs, ys, lr=0.1, n_iters=5)
    sub.rbf_kernel(Xs, Xs)
    for arr, ref in zip((X, y, Xs, ys), copies):
        np.testing.assert_array_equal(arr, ref, err_msg="an input array was modified in place")
    src = Path(sub.__file__).read_text()
    banned = re.findall(r"\b(sklearn|scipy|torch)\b", src)
    assert not banned, f"forbidden library used: {sorted(set(banned))}"
