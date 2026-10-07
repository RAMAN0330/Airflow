"""Hidden validation suite for least_squares_qr."""
import numpy as np
import pytest

import submission as sub

rng = np.random.default_rng(7)


def _forbid_numpy_solvers(monkeypatch):
    def boom(*args, **kwargs):
        raise AssertionError("np.linalg.qr / lstsq / pinv are not allowed here: implement Householder QR by hand")
    for name in ("qr", "lstsq", "pinv"):
        monkeypatch.setattr(np.linalg, name, boom)


def _ref_lstsq(A, b):
    # Independent reference: SVD pseudo-inverse.
    U, s, Vt = np.linalg.svd(A, full_matrices=False)
    return Vt.T @ ((U.T @ b) / s)


def test_householder_qr_reconstructs():
    for m, n in [(5, 5), (8, 3), (20, 6), (4, 1)]:
        A = rng.normal(size=(m, n))
        Q, R = sub.householder_qr(A)
        assert Q.shape == (m, n) and R.shape == (n, n)
        np.testing.assert_allclose(Q @ R, A, atol=1e-12)
        np.testing.assert_allclose(Q.T @ Q, np.eye(n), atol=1e-12)
        assert np.all(np.tril(R, -1) == 0), "R must be exactly upper triangular"


def test_householder_nearly_triangular_input():
    # A column already pointing along +e1 is where the wrong reflection sign cancels catastrophically.
    T = np.triu(rng.uniform(1.0, 2.0, size=(6, 4)))
    for A in (T, T + 1e-9 * rng.normal(size=T.shape), np.eye(5, 3)):
        Q, R = sub.householder_qr(A)
        assert np.all(np.isfinite(Q)) and np.all(np.isfinite(R))
        np.testing.assert_allclose(Q @ R, A, atol=1e-13)
        np.testing.assert_allclose(Q.T @ Q, np.eye(A.shape[1]), atol=1e-13)
    # The standard sign choice makes R[k, k] = -sign(x0)·‖x‖, so a positive diagonal comes back negative.
    _, R = sub.householder_qr(T)
    np.testing.assert_allclose(np.abs(np.diag(R)), np.abs(np.diag(T)), rtol=1e-12)
    assert np.all(np.diag(R) < 0)


def test_qr_does_not_call_numpy_solvers(monkeypatch):
    _forbid_numpy_solvers(monkeypatch)
    A = rng.normal(size=(12, 4))
    b = rng.normal(size=12)
    Q, R = sub.householder_qr(A)
    np.testing.assert_allclose(Q @ R, A, atol=1e-12)
    x = sub.qr_least_squares(A, b)
    P = sub.projection_matrix(A)
    assert x.shape == (4,) and P.shape == (12, 12)


def test_back_substitution_known_system():
    R = np.array([[2.0, 1.0, -1.0], [0.0, 3.0, 2.0], [0.0, 0.0, 4.0]])
    x_true = np.array([1.0, -2.0, 0.5])
    np.testing.assert_allclose(sub.back_substitution(R, R @ x_true), x_true, atol=1e-14)
    R = np.triu(rng.normal(size=(7, 7))) + 5 * np.eye(7)
    x_true = rng.normal(size=7)
    np.testing.assert_allclose(sub.back_substitution(R, R @ x_true), x_true, atol=1e-12)


def test_invalid_inputs_raise():
    with pytest.raises(ValueError):
        sub.back_substitution(np.array([[1.0, 2.0], [0.0, 0.0]]), np.array([1.0, 1.0]))
    with pytest.raises(ValueError):
        sub.householder_qr(np.ones((2, 3)))
    with pytest.raises(ValueError):
        sub.normal_equations(np.ones((2, 3)), np.ones(2))
    A = rng.normal(size=(6, 3))
    A[:, 1] = 0.0  # rank-deficient: no unique least-squares solution
    with pytest.raises(ValueError):
        sub.qr_least_squares(A, np.ones(6))


def test_least_squares_matches_reference():
    for m, n in [(10, 3), (30, 5), (6, 6)]:
        A = rng.normal(size=(m, n))
        b = rng.normal(size=m)
        ref = _ref_lstsq(A, b)
        np.testing.assert_allclose(sub.normal_equations(A, b), ref, atol=1e-9)
        x = sub.qr_least_squares(A, b)
        np.testing.assert_allclose(x, ref, atol=1e-11)
        # The residual is orthogonal to every column: Aᵀ(b − Ax) = 0.
        np.testing.assert_allclose(A.T @ (b - A @ x), 0.0, atol=1e-11)


def test_projection_matrix_properties():
    A = rng.normal(size=(9, 3))
    b = rng.normal(size=9)
    P = sub.projection_matrix(A)
    np.testing.assert_allclose(P @ P, P, atol=1e-12)          # idempotent
    np.testing.assert_allclose(P, P.T, atol=1e-12)            # symmetric
    np.testing.assert_allclose(P @ A, A, atol=1e-12)          # fixes the column space
    assert np.trace(P) == pytest.approx(3.0, abs=1e-12)       # trace = rank
    ref = A @ np.linalg.solve(A.T @ A, A.T)
    np.testing.assert_allclose(P, ref, atol=1e-10)
    np.testing.assert_allclose(P @ b, A @ sub.qr_least_squares(A, b), atol=1e-12)


def test_condition_number():
    A = rng.normal(size=(8, 4))
    s = np.linalg.svd(A, compute_uv=False)
    got = sub.condition_number(A)
    assert isinstance(got, float)
    assert got == pytest.approx(s[0] / s[-1], rel=1e-12)
    assert sub.condition_number(np.eye(3)) == pytest.approx(1.0)
    assert sub.condition_number(np.diag([1e3, 1.0, 1e-3])) == pytest.approx(1e6, rel=1e-12)
    # Forming AᵀA squares the condition number.
    assert sub.condition_number(A.T @ A) == pytest.approx(got ** 2, rel=1e-8)
    assert sub.condition_number(np.array([[1.0, 2.0], [2.0, 4.0], [0.0, 0.0]])) > 1e15


def test_qr_beats_normal_equations_on_vandermonde():
    t = np.linspace(0.0, 1.0, 60)
    V = sub.vandermonde(t, 10)
    assert V.shape == (60, 11)
    np.testing.assert_allclose(V[:, 0], 1.0)
    np.testing.assert_allclose(V[:, 3], t ** 3)
    assert sub.condition_number(V) > 1e7
    c = np.ones(11)
    y = V @ c
    err_ne = np.max(np.abs(sub.normal_equations(V, y) - c))
    err_qr = np.max(np.abs(sub.qr_least_squares(V, y) - c))
    assert err_qr < 1e-6
    assert err_qr < 1e-3 * err_ne


def test_inputs_not_mutated():
    A = rng.normal(size=(7, 3))
    b = rng.normal(size=7)
    R = np.triu(rng.normal(size=(3, 3))) + 3 * np.eye(3)
    y = rng.normal(size=3)
    copies = [a.copy() for a in (A, b, R, y)]
    sub.householder_qr(A)
    sub.qr_least_squares(A, b)
    sub.normal_equations(A, b)
    sub.projection_matrix(A)
    sub.back_substitution(R, y)
    for orig, cp in zip((A, b, R, y), copies):
        np.testing.assert_array_equal(orig, cp)
