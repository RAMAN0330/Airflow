"""Hidden validation suite for bootstrap_inference."""
import math

import numpy as np
import pytest

import submission as sub

rng = np.random.default_rng(7)
X = rng.exponential(2.0, 120)


def ref_boot(x, stat, n_boot, seed):
    x = np.asarray(x, float)
    idx = np.random.default_rng(seed).integers(0, x.size, size=(n_boot, x.size))
    return stat(x[idx], axis=1)


def test_mean_and_variance_uses_ddof_1():
    m, v = sub.mean_and_variance([2, 4, 4, 4, 5, 5, 7, 9])
    assert isinstance(m, float) and isinstance(v, float)
    assert m == pytest.approx(5.0)
    assert v == pytest.approx(32 / 7)
    m, v = sub.mean_and_variance(X)
    assert v == pytest.approx(np.sum((X - X.mean()) ** 2) / (X.size - 1), rel=1e-12)
    with pytest.raises(ValueError):
        sub.mean_and_variance([3.0])


def test_standard_error():
    assert sub.standard_error([2, 4, 4, 4, 5, 5, 7, 9]) == pytest.approx(math.sqrt(32 / 7) / math.sqrt(8))
    assert sub.standard_error(X) == pytest.approx(X.std(ddof=1) / math.sqrt(X.size), rel=1e-12)
    big = rng.normal(0, 1, 4 * X.size)
    assert sub.standard_error(big) < sub.standard_error(big[: X.size])


def test_normal_ci_known_values():
    lo, hi = sub.normal_ci(X)
    se = X.std(ddof=1) / math.sqrt(X.size)
    assert lo == pytest.approx(X.mean() - 1.959963984540054 * se, rel=1e-9)
    assert hi == pytest.approx(X.mean() + 1.959963984540054 * se, rel=1e-9)
    lo90, hi90 = sub.normal_ci(X, conf=0.90)
    assert hi90 - lo90 == pytest.approx(2 * 1.6448536269514722 * se, rel=1e-9)
    assert lo < lo90 < hi90 < hi


def test_bootstrap_distribution_matches_reference():
    for stat, n_boot, seed in ((np.mean, 500, 0), (np.median, 300, 11)):
        got = np.asarray(sub.bootstrap_distribution(X, stat=stat, n_boot=n_boot, seed=seed))
        assert got.shape == (n_boot,)
        np.testing.assert_allclose(got, ref_boot(X, stat, n_boot, seed), rtol=1e-12)


def test_bootstrap_is_seeded_and_reproducible():
    a = np.asarray(sub.bootstrap_distribution(X, n_boot=400, seed=3))
    b = np.asarray(sub.bootstrap_distribution(X, n_boot=400, seed=3))
    c = np.asarray(sub.bootstrap_distribution(X, n_boot=400, seed=4))
    np.testing.assert_array_equal(a, b)
    assert not np.array_equal(a, c)
    # Replicates must differ from one another (each row is a fresh resample).
    assert np.unique(a).size > 300
    # The spread of bootstrap means approximates the standard error.
    big = np.asarray(sub.bootstrap_distribution(X, n_boot=20000, seed=1))
    assert big.std() == pytest.approx(X.std(ddof=0) / math.sqrt(X.size), rel=0.05)


def test_percentile_ci_order_and_values():
    boot = rng.normal(10, 2, 5000)
    lo, hi = sub.percentile_ci(boot, conf=0.9)
    assert lo < hi
    assert lo == pytest.approx(np.quantile(boot, 0.05))
    assert hi == pytest.approx(np.quantile(boot, 0.95))
    lo99, hi99 = sub.percentile_ci(boot, conf=0.99)
    assert lo99 < lo < hi < hi99


def test_bootstrap_ci_matches_reference():
    lo, hi = sub.bootstrap_ci(X, stat=np.median, conf=0.95, n_boot=1000, seed=5)
    boot = ref_boot(X, np.median, 1000, 5)
    assert (lo, hi) == pytest.approx(tuple(np.quantile(boot, [0.025, 0.975])))
    lo, hi = sub.bootstrap_ci(X, n_boot=2000, seed=0)
    assert lo < X.mean() < hi


def test_bootstrap_diff_ci():
    a = rng.normal(10.0, 3.0, 200)
    b = rng.normal(11.5, 3.0, 150)
    est, lo, hi = sub.bootstrap_diff_ci(a, b, n_boot=1500, seed=9)
    r = np.random.default_rng(9)
    ia = r.integers(0, a.size, size=(1500, a.size))
    ib = r.integers(0, b.size, size=(1500, b.size))
    d = b[ib].mean(axis=1) - a[ia].mean(axis=1)
    assert est == pytest.approx(b.mean() - a.mean())
    assert (lo, hi) == pytest.approx(tuple(np.quantile(d, [0.025, 0.975])))
    assert 0 < lo < est < hi
    est0, lo0, hi0 = sub.bootstrap_diff_ci(a, a.copy(), stat=np.median, n_boot=800, seed=2)
    assert est0 == 0.0 and lo0 < 0 < hi0


def test_coverage_helpers():
    assert sub.coverage_rate([0, 1, 2, 5], [2, 3, 4, 6], 2.0) == pytest.approx(0.75)
    cov = sub.simulate_normal_ci_coverage(5.0, 2.0, n=60, n_sims=2000, conf=0.95, seed=0)
    assert 0.93 <= cov <= 0.965
    small = sub.simulate_normal_ci_coverage(5.0, 2.0, n=4, n_sims=4000, conf=0.95, seed=1)
    assert small < 0.92  # z instead of t under-covers for tiny n


def test_inputs_not_mutated():
    x = rng.normal(0, 1, 50)
    y = rng.normal(0, 1, 40)
    x0, y0 = x.copy(), y.copy()
    sub.mean_and_variance(x)
    sub.bootstrap_ci(x, stat=np.median, n_boot=200, seed=0)
    sub.bootstrap_diff_ci(x, y, n_boot=200, seed=0)
    np.testing.assert_array_equal(x, x0)
    np.testing.assert_array_equal(y, y0)
    assert len(sub.bootstrap_distribution(list(x), n_boot=10, seed=0)) == 10
