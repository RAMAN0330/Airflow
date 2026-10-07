"""Principal component analysis from scratch: covariance, eigendecomposition and SVD. NumPy only."""
import numpy as np


def center(X):
    """Return (X_centered, mean) where mean has shape (d,). Do not modify X."""
    raise NotImplementedError


def covariance_matrix(X):
    """Sample covariance (d, d) of the rows of X, dividing by n - 1. ValueError if n < 2."""
    raise NotImplementedError


def flip_signs(components):
    """Return a copy where each row's largest-magnitude entry is positive."""
    raise NotImplementedError


def pca_eigh(X, n_components=None):
    """PCA via np.linalg.eigh of the covariance. Returns (components (k, d), explained_variance (k,)), largest first."""
    raise NotImplementedError


def pca_svd(X, n_components=None):
    """PCA via SVD of the centered data. Same outputs and sign convention as pca_eigh."""
    raise NotImplementedError


def choose_k(explained_variance_ratio, threshold):
    """Smallest k whose cumulative explained variance ratio reaches threshold (0 < threshold <= 1)."""
    raise NotImplementedError


class PCA:
    def __init__(self, n_components=None):
        self.n_components = n_components

    def fit(self, X):
        """Set mean_, components_, explained_variance_, explained_variance_ratio_. Return self."""
        raise NotImplementedError

    def transform(self, X):
        """Project X onto the components: (n, d) -> (n, k)."""
        raise NotImplementedError

    def inverse_transform(self, Z):
        """Map scores back to feature space: (n, k) -> (n, d)."""
        raise NotImplementedError
