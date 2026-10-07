"""K-means (with k-means++ seeding) and a diagonal Gaussian mixture fitted by EM. NumPy only."""
import numpy as np


def pairwise_sq_dists(X, C):
    X = np.asarray(X, dtype=float)
    C = np.asarray(C, dtype=float)
    x2 = (X ** 2).sum(axis=1)[:, None]
    c2 = (C ** 2).sum(axis=1)[None, :]
    D = x2 - 2.0 * X @ C.T + c2
    return np.maximum(D, 0.0)


def kmeans_pp_init(X, k, seed=0):
    X = np.asarray(X, dtype=float)
    n = X.shape[0]
    if not 1 <= k <= n:
        raise ValueError(f"k must be between 1 and n={n}, got {k}")
    rng = np.random.default_rng(seed)
    idx = [int(rng.integers(n))]
    d2 = pairwise_sq_dists(X, X[idx[0]:idx[0] + 1])[:, 0]
    for _ in range(1, k):
        total = d2.sum()
        if total <= 0:
            i = int(rng.integers(n))
        else:
            i = int(rng.choice(n, p=d2 / total))
        idx.append(i)
        d2 = np.minimum(d2, pairwise_sq_dists(X, X[i:i + 1])[:, 0])
    return X[idx].copy()


def update_centroids(X, labels, k):
    X = np.asarray(X, dtype=float)
    labels = np.asarray(labels)
    counts = np.bincount(labels, minlength=k)
    sums = np.zeros((k, X.shape[1]))
    np.add.at(sums, labels, X)
    C = sums / np.maximum(counts, 1)[:, None]
    empty = np.flatnonzero(counts == 0)
    if empty.size:
        dist = ((X - C[labels]) ** 2).sum(axis=1)
        for j in empty:
            i = int(np.argmax(dist))
            C[j] = X[i]
            dist[i] = -1.0
    return C


def kmeans(X, k, seed=0, max_iter=100, tol=1e-8, init=None):
    X = np.asarray(X, dtype=float)
    if init is None:
        C = kmeans_pp_init(X, k, seed)
    else:
        C = np.array(init, dtype=float)
        if C.shape != (k, X.shape[1]):
            raise ValueError(f"init must have shape {(k, X.shape[1])}, got {C.shape}")
    for _ in range(max_iter):
        labels = np.argmin(pairwise_sq_dists(X, C), axis=1)
        new_C = update_centroids(X, labels, k)
        shift = float(((new_C - C) ** 2).sum())
        C = new_C
        if shift <= tol:
            break
    D = pairwise_sq_dists(X, C)
    labels = np.argmin(D, axis=1)
    inertia = float(D[np.arange(X.shape[0]), labels].sum())
    return C, labels, inertia


def logsumexp(a, axis=-1):
    a = np.asarray(a, dtype=float)
    m = np.max(a, axis=axis, keepdims=True)
    m = np.where(np.isfinite(m), m, 0.0)
    out = np.log(np.sum(np.exp(a - m), axis=axis, keepdims=True)) + m
    return np.squeeze(out, axis=axis)


def log_gaussian_diag(X, means, variances):
    X = np.asarray(X, dtype=float)
    means = np.asarray(means, dtype=float)
    variances = np.asarray(variances, dtype=float)
    d = X.shape[1]
    maha = (((X[:, None, :] - means[None, :, :]) ** 2) / variances[None, :, :]).sum(axis=2)
    return -0.5 * (d * np.log(2 * np.pi) + np.log(variances).sum(axis=1)[None, :] + maha)


def gmm_e_step(X, weights, means, variances):
    log_r = np.log(np.asarray(weights, dtype=float))[None, :] + log_gaussian_diag(X, means, variances)
    log_norm = logsumexp(log_r, axis=1)
    resp = np.exp(log_r - log_norm[:, None])
    return resp, float(log_norm.sum())


def gmm_m_step(X, resp, reg=1e-6):
    X = np.asarray(X, dtype=float)
    resp = np.asarray(resp, dtype=float)
    nk = resp.sum(axis=0)
    weights = nk / X.shape[0]
    means = resp.T @ X / nk[:, None]
    diff2 = (X[:, None, :] - means[None, :, :]) ** 2
    variances = (resp[:, :, None] * diff2).sum(axis=0) / nk[:, None] + reg
    return weights, means, variances


def fit_gmm(X, k, seed=0, max_iter=200, tol=1e-6, reg=1e-6):
    X = np.asarray(X, dtype=float)
    means = kmeans_pp_init(X, k, seed)
    variances = np.tile(X.var(axis=0) + reg, (k, 1))
    weights = np.full(k, 1.0 / k)
    history = []
    for _ in range(max_iter):
        resp, ll = gmm_e_step(X, weights, means, variances)
        history.append(ll)
        if len(history) > 1 and history[-1] - history[-2] < tol:
            break
        weights, means, variances = gmm_m_step(X, resp, reg)
    return {"weights": weights, "means": means, "variances": variances,
            "resp": resp, "log_likelihood": history}
