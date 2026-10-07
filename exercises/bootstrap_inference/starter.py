"""Sampling statistics, normal-approximation CIs and the percentile bootstrap. NumPy only."""
from statistics import NormalDist

import numpy as np


def mean_and_variance(x):
    """Return (sample mean, unbiased sample variance with ddof=1) as floats. ValueError if n < 2."""
    raise NotImplementedError


def standard_error(x):
    """Standard error of the mean: s / sqrt(n), with s the ddof=1 standard deviation."""
    raise NotImplementedError


def normal_ci(x, conf=0.95):
    """Normal-approximation CI for the mean: mean ± z * SE, z = NormalDist().inv_cdf(0.5 + conf / 2)."""
    raise NotImplementedError


def bootstrap_distribution(x, stat=np.mean, n_boot=2000, seed=0):
    """n_boot bootstrap replicates of stat(sample, axis=1), resampled in one vectorized draw."""
    raise NotImplementedError


def percentile_ci(boot, conf=0.95):
    """(lower, upper) percentile interval of an array of bootstrap replicates."""
    raise NotImplementedError


def bootstrap_ci(x, stat=np.mean, conf=0.95, n_boot=2000, seed=0):
    """Percentile bootstrap CI for stat(x)."""
    raise NotImplementedError


def bootstrap_diff_ci(a, b, stat=np.mean, conf=0.95, n_boot=2000, seed=0):
    """Return (stat(b) - stat(a), lower, upper) from independent bootstrap resamples of a and b."""
    raise NotImplementedError


def coverage_rate(lows, highs, true_value):
    """Fraction of intervals [low, high] (inclusive) that contain true_value."""
    raise NotImplementedError


def simulate_normal_ci_coverage(mu, sigma, n, n_sims=2000, conf=0.95, seed=0):
    """Draw n_sims normal samples of size n, build a normal CI for each, return the coverage rate."""
    raise NotImplementedError
