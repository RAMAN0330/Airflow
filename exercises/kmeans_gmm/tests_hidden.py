"""Hidden validation suite for kmeans_gmm."""
import numpy as np
import pytest

import submission as sub


def brute_sq_dists(X, C):
    return np.array([[float(np.sum((x - c) ** 2)) for c in C] for x in X])


def ref_kmeans_pp(X, k, seed):
    rng = np.random.default_rng(seed)
    n = len(X)
    idx = [int(rng.integers(n))]
    d2 = ((X - X[idx[0]]) ** 2).sum(1)
    for _ in range(1, k):
        total = d2.sum()
        i = int(rng.integers(n)) if total <= 0 else int(rng.choice(n, p=d2 / total))
        idx.append(i)
        d2 = np.minimum(d2, ((X - X[i]) ** 2).sum(1))
    return X[idx]


def ref_log_gauss(X, means, variances):
    out = np.zeros((len(X), len(means)))
    for j in range(len(means)):
        out[:, j] = -0.5 * np.sum(np.log(2 * np.pi * variances[j]) + (X - means[j]) ** 2 / variances[j], axis=1)
    return out


def blobs(seed, centers, n_per=60, scale=0.5):
    rng = np.random.default_rng(seed)
    centers = np.asarray(centers, float)
    X = np.vstack([c + scale * rng.standard_normal((n_per, centers.shape[1])) for c in centers])
    return X, np.repeat(np.arange(len(centers)), n_per)


CENTERS = [[0.0, 0.0], [8.0, 0.0], [0.0, 8.0]]


def test_pairwise_sq_dists_matches_brute_force():
    rng = np.random.default_rng(0)
    X, C = rng.normal(size=(40, 5)), rng.normal(size=(7, 5))
    D = sub.pairwise_sq_dists(X, C)
    assert D.shape == (40, 7)
    np.testing.assert_allclose(D, brute_sq_dists(X, C), rtol=1e-9, atol=1e-9)
    self_d = sub.pairwise_sq_dists(X, X)
    assert np.all(self_d >= 0)
    np.testing.assert_allclose(np.diag(self_d), 0.0, atol=1e-9)


def test_pairwise_sq_dists_rectangular_shapes():
    rng = np.random.default_rng(1)
    for n, k, d in [(1, 4, 3), (9, 1, 2), (25, 6, 1), (6, 25, 4)]:
        X, C = rng.normal(size=(n, d)), rng.normal(size=(k, d))
        D = sub.pairwise_sq_dists(X, C)
        assert D.shape == (n, k)
        np.testing.assert_allclose(D, brute_sq_dists(X, C), rtol=1e-9, atol=1e-9)


def test_kmeans_pp_matches_reference_and_is_seeded():
    X, _ = blobs(2, CENTERS)
    for seed in (0, 1, 7):
        C = sub.kmeans_pp_init(X, 3, seed=seed)
        assert C.shape == (3, 2)
        np.testing.assert_array_equal(C, ref_kmeans_pp(X, 3, seed))
        np.testing.assert_array_equal(C, sub.kmeans_pp_init(X, 3, seed=seed))
    C = sub.kmeans_pp_init(X, 3, seed=0)
    C[:] = 1e9
    assert np.all(X < 1e8), "returned centroids must be a copy, not a view of X"
    with pytest.raises(ValueError):
        sub.kmeans_pp_init(X, len(X) + 1)


def test_kmeans_pp_degenerate_data_has_no_nan():
    X = np.ones((10, 2))
    C = sub.kmeans_pp_init(X, 3, seed=0)
    assert C.shape == (3, 2) and np.all(np.isfinite(C))
    np.testing.assert_array_equal(C, ref_kmeans_pp(X, 3, 0))


def test_update_centroids_handles_empty_cluster():
    X = np.array([[0.0, 0.0], [2.0, 0.0], [10.0, 0.0], [10.0, 2.0], [10.0, 30.0]])
    labels = np.array([0, 0, 1, 1, 1])
    C2 = sub.update_centroids(X, labels, 2)
    np.testing.assert_allclose(C2, [[1.0, 0.0], [10.0, 32.0 / 3.0]])
    C3 = sub.update_centroids(X, labels, 3)
    assert C3.shape == (3, 2) and np.all(np.isfinite(C3))
    np.testing.assert_allclose(C3[:2], C2)
    np.testing.assert_allclose(C3[2], [10.0, 30.0])  # the point farthest from its own centroid
    C4 = sub.update_centroids(X, labels, 4)
    assert np.all(np.isfinite(C4))
    assert not np.allclose(C4[2], C4[3]), "two empty clusters must not take the same point"


def test_kmeans_recovers_blobs():
    X, y = blobs(3, CENTERS)
    X0 = X.copy()
    C, labels, inertia = sub.kmeans(X, 3, seed=0)
    np.testing.assert_array_equal(X, X0)
    assert C.shape == (3, 2) and labels.shape == (len(X),)
    assert isinstance(inertia, float)
    np.testing.assert_array_equal(labels, np.argmin(brute_sq_dists(X, C), axis=1))
    assert inertia == pytest.approx(brute_sq_dists(X, C).min(axis=1).sum(), rel=1e-9)
    for j in range(3):
        np.testing.assert_allclose(C[j], X[labels == j].mean(axis=0), atol=1e-6)
        assert len(set(y[labels == j])) == 1
    found = C[np.lexsort((C[:, 1], C[:, 0]))]
    np.testing.assert_allclose(found, sorted(CENTERS), atol=0.3)
    C2, labels2, inertia2 = sub.kmeans(X, 3, seed=0)
    np.testing.assert_array_equal(C, C2)


def test_kmeans_far_init_leaves_no_empty_cluster():
    X, _ = blobs(4, [[0.0, 0.0], [6.0, 6.0]], n_per=50)
    init = np.array([[0.0, 0.0], [6.0, 6.0], [100.0, 100.0]])
    C, labels, inertia = sub.kmeans(X, 3, init=init)
    assert np.all(np.isfinite(C)) and np.isfinite(inertia)
    assert np.all(np.bincount(labels, minlength=3) > 0)
    np.testing.assert_array_equal(init[2], [100.0, 100.0])
    _, _, inertia2 = sub.kmeans(X, 2, init=init[:2])
    assert inertia < inertia2


def test_e_step_is_stable_in_log_space():
    big = np.array([[1000.0, 1001.0, 999.0], [-1e4, -1e4 + 1, -2e4]])
    np.testing.assert_allclose(sub.logsumexp(big, axis=1),
                               [1001 + np.log(np.exp(-1) + 1 + np.exp(-2)), -1e4 + 1 + np.log(1 + np.exp(-1))])
    X = np.array([[0.0, 0.0], [1.0, -1.0], [500.0, 500.0], [-800.0, 3.0]])
    w = np.array([0.3, 0.7])
    means = np.array([[0.0, 0.0], [2.0, 1.0]])
    var = np.array([[1.0, 1.0], [0.5, 2.0]])
    np.testing.assert_allclose(sub.log_gaussian_diag(X, means, var), ref_log_gauss(X, means, var), rtol=1e-10)
    resp, ll = sub.gmm_e_step(X, w, means, var)
    assert resp.shape == (4, 2) and np.all(np.isfinite(resp)), "responsibilities contain NaN/inf"
    np.testing.assert_allclose(resp.sum(axis=1), 1.0)
    log_r = np.log(w) + ref_log_gauss(X, means, var)
    m = log_r.max(1, keepdims=True)
    lse = (m + np.log(np.exp(log_r - m).sum(1, keepdims=True)))[:, 0]
    np.testing.assert_allclose(resp, np.exp(log_r - lse[:, None]), atol=1e-12)
    assert ll == pytest.approx(lse.sum(), rel=1e-10) and np.isfinite(ll)


def test_m_step_matches_reference():
    rng = np.random.default_rng(5)
    X = rng.normal(size=(50, 3))
    resp = rng.random((50, 4))
    resp /= resp.sum(1, keepdims=True)
    w, mu, var = sub.gmm_m_step(X, resp, reg=1e-6)
    nk = resp.sum(0)
    np.testing.assert_allclose(w, nk / 50)
    assert w.sum() == pytest.approx(1.0)
    ref_mu = np.array([(resp[:, j:j + 1] * X).sum(0) / nk[j] for j in range(4)])
    ref_var = np.array([(resp[:, j:j + 1] * (X - ref_mu[j]) ** 2).sum(0) / nk[j] for j in range(4)]) + 1e-6
    np.testing.assert_allclose(mu, ref_mu, rtol=1e-9)
    np.testing.assert_allclose(var, ref_var, rtol=1e-7)


def test_fit_gmm_increases_log_likelihood():
    rng = np.random.default_rng(6)
    X = np.vstack([rng.normal([-5.0, 0.0], [1.0, 0.5], (150, 2)), rng.normal([5.0, 3.0], [0.5, 1.5], (100, 2))])
    X0 = X.copy()
    out = sub.fit_gmm(X, 2, seed=0)
    np.testing.assert_array_equal(X, X0)
    ll = np.asarray(out["log_likelihood"])
    assert len(ll) >= 2 and np.all(np.isfinite(ll))
    assert np.all(np.diff(ll) >= -1e-8), "EM must never decrease the log-likelihood"
    order = np.argsort(out["means"][:, 0])
    np.testing.assert_allclose(out["means"][order], [[-5.0, 0.0], [5.0, 3.0]], atol=0.3)
    np.testing.assert_allclose(out["weights"][order], [0.6, 0.4], atol=0.02)
    np.testing.assert_allclose(np.sqrt(out["variances"][order]), [[1.0, 0.5], [0.5, 1.5]], atol=0.25)
    np.testing.assert_allclose(out["resp"].sum(axis=1), 1.0)
    again = sub.fit_gmm(X, 2, seed=0)
    np.testing.assert_array_equal(out["means"], again["means"])
