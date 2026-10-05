"""Reference solution — never shipped to learners."""
import numpy as np


def predict(X, w, b):
    return X @ w + b


def compute_cost(X, y, w, b, lam=0.0):
    m = X.shape[0]
    residual = predict(X, w, b) - y
    return float((residual @ residual) / (2 * m) + lam * (w @ w) / (2 * m))


def compute_gradients(X, y, w, b, lam=0.0):
    m = X.shape[0]
    residual = predict(X, w, b) - y
    dw = (X.T @ residual) / m + (lam / m) * w
    db = float(residual.mean())
    return dw, db


def gradient_descent(X, y, lr=0.01, n_iters=1000, lam=0.0):
    w = np.zeros(X.shape[1])
    b = 0.0
    cost_history = []
    for _ in range(n_iters):
        dw, db = compute_gradients(X, y, w, b, lam)
        w = w - lr * dw
        b = b - lr * db
        cost_history.append(compute_cost(X, y, w, b, lam))
    return w, b, cost_history
