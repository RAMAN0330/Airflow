"""Principal component analysis from scratch: covariance, eigendecomposition and SVD. NumPy only."""
import numpy as np


def center(X):
    X = np.asarray(X, dtype=float)
    mean = X.mean(axis=0)
    return X - mean, mean


def covariance_matrix(X):
    X = np.asarray(X, dtype=float)
    n = X.shape[0]
    if n < 2:
        raise ValueError("need at least 2 samples to estimate a covariance")
    Xc, _ = center(X)
    return Xc.T @ Xc / (n - 1)


def flip_signs(components):
    components = np.array(components, dtype=float)
    idx = np.argmax(np.abs(components), axis=1)
    signs = np.sign(components[np.arange(components.shape[0]), idx])
    signs[signs == 0] = 1.0
    return components * signs[:, None]


def _check_k(n_components, d):
    k = d if n_components is None else int(n_components)
    if not 1 <= k <= d:
        raise ValueError(f"n_components must be between 1 and {d}, got {n_components}")
    return k


def pca_eigh(X, n_components=None):
    X = np.asarray(X, dtype=float)
    k = _check_k(n_components, X.shape[1])
    evals, evecs = np.linalg.eigh(covariance_matrix(X))
    order = np.argsort(evals)[::-1]
    evals, evecs = evals[order], evecs[:, order]
    return flip_signs(evecs.T[:k]), np.maximum(evals[:k], 0.0)


def pca_svd(X, n_components=None):
    X = np.asarray(X, dtype=float)
    n, d = X.shape
    if n < 2:
        raise ValueError("need at least 2 samples")
    k = _check_k(n_components, min(n, d))
    Xc, _ = center(X)
    _, S, Vt = np.linalg.svd(Xc, full_matrices=False)
    return flip_signs(Vt[:k]), S[:k] ** 2 / (n - 1)


def choose_k(explained_variance_ratio, threshold):
    if not 0 < threshold <= 1:
        raise ValueError("threshold must be in (0, 1]")
    cum = np.cumsum(np.asarray(explained_variance_ratio, dtype=float))
    k = int(np.searchsorted(cum, threshold - 1e-12) + 1)
    return min(k, cum.size)


class PCA:
    def __init__(self, n_components=None):
        self.n_components = n_components

    def fit(self, X):
        X = np.asarray(X, dtype=float)
        self.mean_ = X.mean(axis=0)
        self.components_, self.explained_variance_ = pca_svd(X, self.n_components)
        total = float(np.trace(covariance_matrix(X)))
        self.explained_variance_ratio_ = self.explained_variance_ / total if total > 0 else np.zeros_like(self.explained_variance_)
        return self

    def transform(self, X):
        return (np.asarray(X, dtype=float) - self.mean_) @ self.components_.T

    def inverse_transform(self, Z):
        return np.asarray(Z, dtype=float) @ self.components_ + self.mean_
