"""Logistic regression and a linear SVM trained with (sub)gradient descent, plus an RBF kernel. NumPy only."""
import numpy as np


def sigmoid(z):
    z = np.asarray(z, dtype=float)
    out = np.empty_like(z)
    pos = z >= 0
    out[pos] = 1.0 / (1.0 + np.exp(-z[pos]))
    ez = np.exp(z[~pos])
    out[~pos] = ez / (1.0 + ez)
    return out if out.ndim else float(out)


def predict_proba(X, w, b):
    return sigmoid(X @ w + b)


def bce_loss(X, y, w, b, lam=0.0):
    m = X.shape[0]
    z = X @ w + b
    # log(1 + e^z) - y*z equals -[y log p + (1 - y) log(1 - p)] without ever forming log(0).
    data = np.mean(np.logaddexp(0.0, z) - y * z)
    return float(data + lam * (w @ w) / (2 * m))


def bce_gradients(X, y, w, b, lam=0.0):
    m = X.shape[0]
    residual = predict_proba(X, w, b) - y
    dw = X.T @ residual / m + (lam / m) * w
    db = float(residual.mean())
    return dw, db


def fit_logistic(X, y, lr=0.1, n_iters=1000, lam=0.0):
    w = np.zeros(X.shape[1])
    b = 0.0
    for _ in range(n_iters):
        dw, db = bce_gradients(X, y, w, b, lam)
        w = w - lr * dw
        b = b - lr * db
    return w, b


def svm_subgradient(X, y, w, b, lam=0.01):
    m = X.shape[0]
    margins = y * (X @ w + b)
    active = margins < 1
    dw = lam * w - (X[active].T @ y[active]) / m
    db = float(-y[active].sum() / m)
    return dw, db


def fit_linear_svm(X, y, lr=0.1, n_iters=1000, lam=0.01):
    y = np.asarray(y, dtype=float)
    if not np.all(np.isin(y, (-1.0, 1.0))):
        raise ValueError("SVM labels must be -1 or +1")
    w = np.zeros(X.shape[1])
    b = 0.0
    for _ in range(n_iters):
        dw, db = svm_subgradient(X, y, w, b, lam)
        w = w - lr * dw
        b = b - lr * db
    return w, b


def rbf_kernel(A, B, gamma=1.0):
    A = np.asarray(A, dtype=float)
    B = np.asarray(B, dtype=float)
    sq = (A * A).sum(axis=1)[:, None] + (B * B).sum(axis=1)[None, :] - 2.0 * A @ B.T
    return np.exp(-gamma * np.maximum(sq, 0.0))
