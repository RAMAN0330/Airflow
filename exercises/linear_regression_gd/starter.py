"""Linear & Ridge Regression with batch gradient descent.

Fill in each function. Use NumPy only.
"""
import numpy as np


def predict(X, w, b):
    """Return predictions X @ w + b, shape (m,)."""
    # TODO: one line of matrix-vector arithmetic.
    raise NotImplementedError


def compute_cost(X, y, w, b, lam=0.0):
    """Return J(w, b) = (1/2m) * sum((y_hat - y)^2) + (lam/2m) * ||w||^2 as a float."""
    # TODO: compute the residual, then the two terms.
    raise NotImplementedError


def compute_gradients(X, y, w, b, lam=0.0):
    """Return (dw, db): dw has shape (n,), db is a float. Do not regularize b."""
    # TODO: dw = (1/m) X^T (y_hat - y) + (lam/m) w ; db = mean(y_hat - y)
    raise NotImplementedError


def gradient_descent(X, y, lr=0.01, n_iters=1000, lam=0.0):
    """Run batch gradient descent from w = 0, b = 0.

    Returns (w, b, cost_history) where cost_history[i] is the cost after update i.
    """
    # TODO: initialize parameters, loop n_iters times, update w and b together,
    # and record the cost after each step.
    raise NotImplementedError
