"""Hidden validation suite for pca_from_scratch."""
import numpy as np
import pytest

import submission as sub


def correlated_data(seed, n=200, scales=(5.0, 2.0, 1.0, 0.3), offset=0.0):
    rng = np.random.default_rng(seed)
    d = len(scales)
    Q, _ = np.linalg.qr(rng.normal(size=(d, d)))
    return (rng.normal(size=(n, d)) * np.asarray(scales)) @ Q.T + offset


def ref_pca(X):
    Xc = X - X.mean(0)
    cov = Xc.T @ Xc / (len(X) - 1)
    w, V = np.linalg.eigh(cov)
    w, V = w[::-1], V[:, ::-1].T
    idx = np.argmax(np.abs(V), axis=1)
    V = V * np.sign(V[np.arange(len(V)), idx])[:, None]
    return V, w


X = correlated_data(0, offset=np.array([10.0, -3.0, 50.0, 7.0]))


def test_center_and_covariance_match_numpy():
    Xc, mean = sub.center(X)
    np.testing.assert_allclose(mean, X.mean(axis=0))
    np.testing.assert_allclose(Xc.mean(axis=0), 0.0, atol=1e-10)
    np.testing.assert_allclose(Xc, X - X.mean(axis=0))
    C = sub.covariance_matrix(X)
    assert C.shape == (4, 4)
    np.testing.assert_allclose(C, np.cov(X, rowvar=False), rtol=1e-10)
    np.testing.assert_allclose(sub.covariance_matrix([[1.0, 2.0], [3.0, 6.0]]), [[2.0, 4.0], [4.0, 8.0]])


def test_covariance_requires_two_samples():
    with pytest.raises(ValueError):
        sub.covariance_matrix(np.array([[1.0, 2.0, 3.0]]))


def test_pca_eigh_sorted_descending():
    comps, var = sub.pca_eigh(X)
    assert comps.shape == (4, 4) and var.shape == (4,)
    assert np.all(np.diff(var) <= 0), "explained variance must be sorted largest first"
    np.testing.assert_allclose(var, ref_pca(X)[1], rtol=1e-9)
    Xc = X - X.mean(0)
    proj_var = ((Xc @ comps[0]) ** 2).sum() / (len(X) - 1)
    assert proj_var == pytest.approx(var[0], rel=1e-9)


def test_pca_eigh_components_and_sign_convention():
    comps, var = sub.pca_eigh(X, n_components=2)
    assert comps.shape == (2, 4) and var.shape == (2,)
    ref_c, ref_v = ref_pca(X)
    np.testing.assert_allclose(comps, ref_c[:2], atol=1e-9)
    np.testing.assert_allclose(comps @ comps.T, np.eye(2), atol=1e-10)
    rows = np.arange(2)
    assert np.all(comps[rows, np.argmax(np.abs(comps), axis=1)] > 0)
    flipped = sub.flip_signs(-comps)
    np.testing.assert_allclose(flipped, comps)
    with pytest.raises(ValueError):
        sub.pca_eigh(X, n_components=5)


def test_pca_is_shift_invariant():
    base = correlated_data(1)
    for shift in (100.0, -1e3):
        for fn in (sub.pca_eigh, sub.pca_svd):
            c0, v0 = fn(base)
            c1, v1 = fn(base + shift)
            np.testing.assert_allclose(v1, v0, rtol=1e-6)
            np.testing.assert_allclose(c1, c0, atol=1e-6)


def test_pca_svd_matches_eigh():
    for seed in (2, 3):
        D = correlated_data(seed, n=120, scales=(3.0, 2.5, 1.0, 0.5, 0.1), offset=4.0)
        ce, ve = sub.pca_eigh(D, n_components=3)
        cs, vs = sub.pca_svd(D, n_components=3)
        assert cs.shape == (3, 5) and vs.shape == (3,)
        np.testing.assert_allclose(vs, ve, rtol=1e-8)
        np.testing.assert_allclose(cs, ce, atol=1e-8)


def test_explained_variance_ratio():
    full = sub.PCA().fit(X)
    assert full.explained_variance_ratio_.sum() == pytest.approx(1.0)
    two = sub.PCA(n_components=2).fit(X)
    total = np.var(X, axis=0, ddof=1).sum()
    np.testing.assert_allclose(two.explained_variance_ratio_, ref_pca(X)[1][:2] / total, rtol=1e-9)
    np.testing.assert_allclose(two.mean_, X.mean(axis=0))
    assert two.components_.shape == (2, 4)


def test_transform_inverse_roundtrip():
    full = sub.PCA().fit(X)
    Z = full.transform(X)
    assert Z.shape == (200, 4)
    np.testing.assert_allclose(Z.mean(axis=0), 0.0, atol=1e-9)
    np.testing.assert_allclose(np.cov(Z, rowvar=False), np.diag(full.explained_variance_), atol=1e-8)
    np.testing.assert_allclose(full.inverse_transform(Z), X, atol=1e-9)
    two = sub.PCA(n_components=2).fit(X)
    recon = two.inverse_transform(two.transform(X))
    sse = ((X - recon) ** 2).sum()
    assert sse == pytest.approx((len(X) - 1) * ref_pca(X)[1][2:].sum(), rel=1e-8)
    x_new = X[:3] + 1.0
    np.testing.assert_allclose(two.transform(x_new), (x_new - X.mean(0)) @ two.components_.T)


def test_choose_k():
    assert sub.choose_k([0.5, 0.3, 0.2], 0.8) == 2
    assert sub.choose_k([0.5, 0.3, 0.2], 0.81) == 3
    assert sub.choose_k([0.5, 0.3, 0.2], 0.5) == 1
    assert sub.choose_k([0.5, 0.3, 0.2], 1.0) == 3
    assert sub.choose_k([0.9, 0.05, 0.05], 0.1) == 1
    ratio = sub.PCA().fit(X).explained_variance_ratio_
    assert sub.choose_k(ratio, 0.95) == int(np.argmax(np.cumsum(ratio) >= 0.95)) + 1
    for bad in (0.0, 1.5, -0.1):
        with pytest.raises(ValueError):
            sub.choose_k([0.5, 0.5], bad)


def test_inputs_not_mutated():
    D = correlated_data(4, offset=3.0)
    D0 = D.copy()
    sub.center(D)
    sub.covariance_matrix(D)
    sub.pca_eigh(D)
    sub.pca_svd(D)
    p = sub.PCA(2).fit(D)
    p.inverse_transform(p.transform(D))
    np.testing.assert_array_equal(D, D0)
    comps, _ = sub.pca_eigh(D)
    c0 = comps.copy()
    sub.flip_signs(-comps)
    np.testing.assert_array_equal(comps, c0)
