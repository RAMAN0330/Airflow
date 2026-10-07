"""K-means (with k-means++ seeding) and a diagonal Gaussian mixture fitted by EM. NumPy only."""
import numpy as np


def pairwise_sq_dists(X, C):
    """Squared Euclidean distances, shape (n, k), from X (n, d) and C (k, d). No Python loops over points."""
    raise NotImplementedError


def kmeans_pp_init(X, k, seed=0):
    """k-means++ seeding with np.random.default_rng(seed). Returns a (k, d) copy of chosen rows of X."""
    raise NotImplementedError


def update_centroids(X, labels, k):
    """Mean of each cluster, shape (k, d). An empty cluster takes the point farthest from its centroid."""
    raise NotImplementedError


def kmeans(X, k, seed=0, max_iter=100, tol=1e-8, init=None):
    """Lloyd's algorithm. Returns (centroids (k, d), labels (n,), inertia float)."""
    raise NotImplementedError


def logsumexp(a, axis=-1):
    """log(sum(exp(a), axis)) computed without overflow or underflow."""
    raise NotImplementedError


def log_gaussian_diag(X, means, variances):
    """log N(x_i | mean_j, diag(variances_j)) for every point and component, shape (n, k)."""
    raise NotImplementedError


def gmm_e_step(X, weights, means, variances):
    """Responsibilities (n, k), computed in log space, and the total log-likelihood (float)."""
    raise NotImplementedError


def gmm_m_step(X, resp, reg=1e-6):
    """Re-estimate (weights (k,), means (k, d), variances (k, d)) from responsibilities."""
    raise NotImplementedError


def fit_gmm(X, k, seed=0, max_iter=200, tol=1e-6, reg=1e-6):
    """Run EM. Returns dict with weights, means, variances, resp and log_likelihood (list per E-step)."""
    raise NotImplementedError
