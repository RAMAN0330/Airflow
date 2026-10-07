"""A/B test analysis without SciPy: z-test, lift CI, sample size, SRM check and a ship decision."""
import math


def norm_cdf(z):
    """Standard normal CDF via math.erf."""
    raise NotImplementedError


def norm_ppf(p, tol=1e-12):
    """Inverse standard normal CDF by bisection on norm_cdf. ValueError unless 0 < p < 1."""
    raise NotImplementedError


def two_proportion_ztest(conv_a, n_a, conv_b, n_b):
    """Pooled two-proportion z-test. Return {"p_a", "p_b", "diff", "z", "p_value"} (two-sided p)."""
    raise NotImplementedError


def lift_ci(conv_a, n_a, conv_b, n_b, conf=0.95):
    """Return (p_b - p_a, lower, upper) using the unpooled standard error."""
    raise NotImplementedError


def sample_size_per_arm(baseline, mde, alpha=0.05, power=0.8):
    """Users needed per arm to detect an absolute change of mde from baseline (two-sided test)."""
    raise NotImplementedError


def srm_check(n_a, n_b, expected_ratio=0.5, threshold=0.001):
    """Chi-square (1 dof) sample-ratio-mismatch check. Return {"chi2", "p_value", "srm"}."""
    raise NotImplementedError


def decide(conv_a, n_a, conv_b, n_b, alpha=0.05, expected_ratio=0.5, srm_threshold=0.001):
    """Return "invalid_srm", "ship", "dont_ship" or "inconclusive"."""
    raise NotImplementedError
