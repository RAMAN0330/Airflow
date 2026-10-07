"""Logistic regression and a linear SVM trained with (sub)gradient descent, plus an RBF kernel. NumPy only."""
import numpy as np


def sigmoid(z):
    """Return 1 / (1 + exp(-z)) element-wise, without overflow warnings for any finite z.

    Accepts a scalar or an array; returns a float for scalar input, an array otherwise.
    """
    # TODO: branch on the sign of z so np.exp only ever sees non-positive numbers.
    raise NotImplementedError


def predict_proba(X, w, b):
    """Return P(y = 1 | x) for every row of X, shape (m,)."""
    raise NotImplementedError


def bce_loss(X, y, w, b, lam=0.0):
    """Return mean binary cross-entropy + (lam / 2m) * ||w||^2 as a float. y holds 0/1 labels."""
    # TODO: use log(1 + e^z) - y*z with z = X @ w + b (np.logaddexp is your friend).
    raise NotImplementedError


def bce_gradients(X, y, w, b, lam=0.0):
    """Return (dw, db): dw = (1/m) X^T (p - y) + (lam/m) w, db = mean(p - y). Do not regularize b."""
    raise NotImplementedError


def fit_logistic(X, y, lr=0.1, n_iters=1000, lam=0.0):
    """Batch gradient descent from w = 0, b = 0 for exactly n_iters steps. Returns (w, b)."""
    raise NotImplementedError


def svm_subgradient(X, y, w, b, lam=0.01):
    """Subgradient of (lam/2)||w||^2 + mean(max(0, 1 - y (X @ w + b))). y holds -1/+1 labels.

    Only examples with margin y*(x.w + b) strictly below 1 contribute. Returns (dw, db).
    """
    raise NotImplementedError


def fit_linear_svm(X, y, lr=0.1, n_iters=1000, lam=0.01):
    """Full-batch subgradient descent from w = 0, b = 0 for n_iters steps. Returns (w, b).

    Raises ValueError if y contains anything other than -1 and +1.
    """
    raise NotImplementedError


def rbf_kernel(A, B, gamma=1.0):
    """Return K with K[i, j] = exp(-gamma * ||A[i] - B[j]||^2), shape (len(A), len(B)). No Python loops."""
    raise NotImplementedError
