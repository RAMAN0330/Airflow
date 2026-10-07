"""A/B test analysis without SciPy: z-test, lift CI, sample size, SRM check and a ship decision."""
import math


def norm_cdf(z):
    # 0.5 * (1 + erf(z / sqrt 2)), written with erfc = 1 - erf to keep precision in the lower tail.
    return 0.5 * math.erfc(-z / math.sqrt(2.0))


def norm_ppf(p, tol=1e-12):
    if not 0.0 < p < 1.0:
        raise ValueError("p must be strictly between 0 and 1")
    lo, hi = -40.0, 40.0
    while hi - lo > tol:
        mid = (lo + hi) / 2
        if norm_cdf(mid) < p:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def _check(conv, n):
    if n <= 0 or not 0 <= conv <= n:
        raise ValueError("need n > 0 and 0 <= conversions <= n")


def two_proportion_ztest(conv_a, n_a, conv_b, n_b):
    _check(conv_a, n_a)
    _check(conv_b, n_b)
    p_a, p_b = conv_a / n_a, conv_b / n_b
    pooled = (conv_a + conv_b) / (n_a + n_b)
    se = math.sqrt(pooled * (1 - pooled) * (1 / n_a + 1 / n_b))
    z = (p_b - p_a) / se if se > 0 else 0.0
    p_value = math.erfc(abs(z) / math.sqrt(2.0))
    return {"p_a": p_a, "p_b": p_b, "diff": p_b - p_a, "z": z, "p_value": p_value}


def lift_ci(conv_a, n_a, conv_b, n_b, conf=0.95):
    _check(conv_a, n_a)
    _check(conv_b, n_b)
    p_a, p_b = conv_a / n_a, conv_b / n_b
    se = math.sqrt(p_a * (1 - p_a) / n_a + p_b * (1 - p_b) / n_b)
    z = norm_ppf(0.5 + conf / 2)
    diff = p_b - p_a
    return diff, diff - z * se, diff + z * se


def sample_size_per_arm(baseline, mde, alpha=0.05, power=0.8):
    p1, p2 = baseline, baseline + mde
    if not (0 < p1 < 1 and 0 < p2 < 1) or mde == 0:
        raise ValueError("baseline and baseline + mde must be in (0, 1), mde != 0")
    z = norm_ppf(1 - alpha / 2) + norm_ppf(power)
    return math.ceil(z * z * (p1 * (1 - p1) + p2 * (1 - p2)) / (mde * mde))


def srm_check(n_a, n_b, expected_ratio=0.5, threshold=0.001):
    total = n_a + n_b
    exp_a = total * expected_ratio
    exp_b = total - exp_a
    chi2 = (n_a - exp_a) ** 2 / exp_a + (n_b - exp_b) ** 2 / exp_b
    p_value = math.erfc(math.sqrt(chi2 / 2.0))
    return {"chi2": chi2, "p_value": p_value, "srm": p_value < threshold}


def decide(conv_a, n_a, conv_b, n_b, alpha=0.05, expected_ratio=0.5, srm_threshold=0.001):
    if srm_check(n_a, n_b, expected_ratio, srm_threshold)["srm"]:
        return "invalid_srm"
    test = two_proportion_ztest(conv_a, n_a, conv_b, n_b)
    if test["p_value"] >= alpha:
        return "inconclusive"
    return "ship" if test["diff"] > 0 else "dont_ship"
