"""Sampling statistics, normal-approximation CIs and the percentile bootstrap. NumPy only."""
from statistics import NormalDist

import numpy as np


def _as_sample(x):
    x = np.asarray(x, dtype=float)
    if x.ndim != 1 or x.size < 2:
        raise ValueError("need a 1-D sample with at least 2 values")
    return x


def mean_and_variance(x):
    x = _as_sample(x)
    return float(np.mean(x)), float(np.var(x, ddof=1))


def standard_error(x):
    x = _as_sample(x)
    return float(np.std(x, ddof=1) / np.sqrt(x.size))


def normal_ci(x, conf=0.95):
    mean, _ = mean_and_variance(x)
    z = NormalDist().inv_cdf(0.5 + conf / 2)
    se = standard_error(x)
    return mean - z * se, mean + z * se


def bootstrap_distribution(x, stat=np.mean, n_boot=2000, seed=0):
    x = _as_sample(x)
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, x.size, size=(n_boot, x.size))
    return np.asarray(stat(x[idx], axis=1), dtype=float)


def percentile_ci(boot, conf=0.95):
    boot = np.asarray(boot, dtype=float)
    alpha = 1 - conf
    lo, hi = np.quantile(boot, [alpha / 2, 1 - alpha / 2])
    return float(lo), float(hi)


def bootstrap_ci(x, stat=np.mean, conf=0.95, n_boot=2000, seed=0):
    return percentile_ci(bootstrap_distribution(x, stat, n_boot, seed), conf)


def bootstrap_diff_ci(a, b, stat=np.mean, conf=0.95, n_boot=2000, seed=0):
    a, b = _as_sample(a), _as_sample(b)
    rng = np.random.default_rng(seed)
    idx_a = rng.integers(0, a.size, size=(n_boot, a.size))
    idx_b = rng.integers(0, b.size, size=(n_boot, b.size))
    diffs = stat(b[idx_b], axis=1) - stat(a[idx_a], axis=1)
    lo, hi = percentile_ci(diffs, conf)
    return float(stat(b) - stat(a)), lo, hi


def coverage_rate(lows, highs, true_value):
    lows, highs = np.asarray(lows, dtype=float), np.asarray(highs, dtype=float)
    return float(np.mean((lows <= true_value) & (true_value <= highs)))


def simulate_normal_ci_coverage(mu, sigma, n, n_sims=2000, conf=0.95, seed=0):
    rng = np.random.default_rng(seed)
    samples = rng.normal(mu, sigma, size=(n_sims, n))
    means = samples.mean(axis=1)
    se = samples.std(axis=1, ddof=1) / np.sqrt(n)
    z = NormalDist().inv_cdf(0.5 + conf / 2)
    return coverage_rate(means - z * se, means + z * se, mu)
