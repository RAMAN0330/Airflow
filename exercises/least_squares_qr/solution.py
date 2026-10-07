"""Least squares three ways: normal equations, Householder QR by hand, and projections, plus conditioning. NumPy only."""
import numpy as np


def _check_tall(A):
    A = np.asarray(A, dtype=float)
    if A.ndim != 2 or A.shape[0] < A.shape[1] or A.shape[1] == 0:
        raise ValueError(f"expected a 2-D matrix with m >= n >= 1, got shape {A.shape}")
    return A


def vandermonde(t, degree):
    """Columns 1, t, t², …, t^degree. Shape (len(t), degree + 1)."""
    t = np.asarray(t, dtype=float)
    return t[:, None] ** np.arange(degree + 1)


def normal_equations(A, b):
    """Least-squares x from (AᵀA) x = Aᵀb."""
    A = _check_tall(A)
    b = np.asarray(b, dtype=float)
    return np.linalg.solve(A.T @ A, A.T @ b)


def householder_qr(A):
    """Thin QR by Householder reflections. Returns Q (m, n) with orthonormal columns and upper-triangular R (n, n)."""
    A = _check_tall(A)
    m, n = A.shape
    R = A.copy()
    vs = []
    for k in range(n):
        x = R[k:, k]
        normx = np.linalg.norm(x)
        if normx == 0.0:
            vs.append(None)
            continue
        # Reflect x onto -sign(x0)·‖x‖·e1 so that v[0] = x0 + sign(x0)‖x‖ never cancels.
        alpha = -np.copysign(normx, x[0])
        v = x.copy()
        v[0] -= alpha
        v /= np.linalg.norm(v)
        R[k:, k:] -= 2.0 * np.outer(v, v @ R[k:, k:])
        R[k + 1:, k] = 0.0
        vs.append(v)
    Q = np.eye(m, n)
    for k in reversed(range(n)):
        v = vs[k]
        if v is not None:
            Q[k:, :] -= 2.0 * np.outer(v, v @ Q[k:, :])
    return Q, np.triu(R[:n, :])


def back_substitution(R, y):
    """Solve R x = y for upper-triangular R, from the last row up. ValueError on a zero pivot."""
    R = np.asarray(R, dtype=float)
    y = np.asarray(y, dtype=float)
    if R.ndim != 2 or R.shape[0] != R.shape[1] or y.shape[:1] != R.shape[:1]:
        raise ValueError("R must be square and match y")
    if np.any(np.diag(R) == 0.0):
        raise ValueError("R is singular (zero on the diagonal)")
    n = R.shape[0]
    x = np.zeros(n)
    for i in reversed(range(n)):
        x[i] = (y[i] - R[i, i + 1:] @ x[i + 1:]) / R[i, i]
    return x


def qr_least_squares(A, b):
    """Least-squares x via A = QR, then R x = Qᵀb."""
    Q, R = householder_qr(A)
    return back_substitution(R, Q.T @ np.asarray(b, dtype=float))


def projection_matrix(A):
    """Orthogonal projector onto the column space of A: P = Q Qᵀ."""
    Q, _ = householder_qr(A)
    return Q @ Q.T


def condition_number(A):
    """2-norm condition number σ_max / σ_min (inf when σ_min is 0)."""
    s = np.linalg.svd(np.asarray(A, dtype=float), compute_uv=False)
    return float(np.inf) if s[-1] == 0.0 else float(s[0] / s[-1])
