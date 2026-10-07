"""Hidden validation suite for ab_test_analysis."""
import math
from statistics import NormalDist

import pytest

import submission as sub

N = NormalDist()


def ref_ztest(ca, na, cb, nb):
    pa, pb = ca / na, cb / nb
    p = (ca + cb) / (na + nb)
    z = (pb - pa) / math.sqrt(p * (1 - p) * (1 / na + 1 / nb))
    return z, 2 * (1 - N.cdf(abs(z)))


def test_norm_cdf_known_values():
    assert sub.norm_cdf(0.0) == pytest.approx(0.5, abs=1e-15)
    assert sub.norm_cdf(1.959963984540054) == pytest.approx(0.975, abs=1e-12)
    for z in (-6.0, -2.5, -1.0, 0.3, 1.7, 4.0):
        assert sub.norm_cdf(z) == pytest.approx(N.cdf(z), abs=1e-12)
        assert sub.norm_cdf(z) + sub.norm_cdf(-z) == pytest.approx(1.0, abs=1e-12)


def test_norm_ppf_inverts_cdf():
    assert sub.norm_ppf(0.975) == pytest.approx(1.959963984540054, abs=1e-8)
    assert sub.norm_ppf(0.5) == pytest.approx(0.0, abs=1e-9)
    for p in (1e-6, 0.01, 0.2, 0.8, 0.95, 0.999999):
        assert sub.norm_ppf(p) == pytest.approx(N.inv_cdf(p), abs=1e-7)
    for bad in (0.0, 1.0, -0.1, 1.5):
        with pytest.raises(ValueError):
            sub.norm_ppf(bad)


def test_ztest_matches_pooled_reference():
    for ca, na, cb, nb in ((200, 2000, 250, 2000), (30, 100, 2500, 10000), (1200, 50000, 1105, 49000)):
        got = sub.two_proportion_ztest(ca, na, cb, nb)
        z, p = ref_ztest(ca, na, cb, nb)
        assert got["p_a"] == pytest.approx(ca / na) and got["p_b"] == pytest.approx(cb / nb)
        assert got["diff"] == pytest.approx(cb / nb - ca / na)
        assert got["z"] == pytest.approx(z, rel=1e-9)
        assert got["p_value"] == pytest.approx(p, rel=1e-6)
    with pytest.raises(ValueError):
        sub.two_proportion_ztest(5, 0, 1, 10)
    with pytest.raises(ValueError):
        sub.two_proportion_ztest(11, 10, 1, 10)


def test_ztest_uses_pooled_se():
    # Unequal arms and rates: pooled and unpooled SEs differ noticeably here.
    got = sub.two_proportion_ztest(30, 100, 2500, 10000)
    assert got["z"] == pytest.approx(-1.1482130826824, abs=1e-6)
    zero = sub.two_proportion_ztest(0, 500, 0, 500)
    assert zero["z"] == 0.0 and zero["p_value"] == pytest.approx(1.0)


def test_p_value_is_two_sided():
    up = sub.two_proportion_ztest(200, 2000, 250, 2000)
    down = sub.two_proportion_ztest(250, 2000, 200, 2000)
    assert up["z"] == pytest.approx(-down["z"])
    assert up["p_value"] == pytest.approx(down["p_value"])
    assert up["p_value"] == pytest.approx(0.0123509477, rel=1e-6)
    assert 0 < up["p_value"] < 1 and down["p_value"] < 0.5


def test_lift_ci_uses_unpooled_se():
    diff, lo, hi = sub.lift_ci(30, 100, 2500, 10000)
    se = math.sqrt(0.3 * 0.7 / 100 + 0.25 * 0.75 / 10000)
    assert diff == pytest.approx(-0.05)
    assert lo == pytest.approx(-0.05 - 1.959963984540054 * se, rel=1e-7)
    assert hi == pytest.approx(-0.05 + 1.959963984540054 * se, rel=1e-7)
    d90, lo90, hi90 = sub.lift_ci(200, 2000, 250, 2000, conf=0.90)
    se = math.sqrt(0.1 * 0.9 / 2000 + 0.125 * 0.875 / 2000)
    assert hi90 - lo90 == pytest.approx(2 * 1.6448536269514722 * se, rel=1e-7)
    assert lo90 < d90 < hi90


def test_sample_size_per_arm():
    n = sub.sample_size_per_arm(0.10, 0.02)
    assert isinstance(n, int) and n == 3839
    assert sub.sample_size_per_arm(0.10, 0.01) > 3 * n
    assert sub.sample_size_per_arm(0.10, 0.02, power=0.9) > n
    assert sub.sample_size_per_arm(0.10, 0.02, alpha=0.01) > n
    expected = (N.inv_cdf(0.995) + N.inv_cdf(0.9)) ** 2 * (0.05 * 0.95 + 0.055 * 0.945) / 0.005 ** 2
    assert sub.sample_size_per_arm(0.05, 0.005, alpha=0.01, power=0.9) == math.ceil(expected)
    with pytest.raises(ValueError):
        sub.sample_size_per_arm(0.95, 0.10)


def test_srm_check():
    ok = sub.srm_check(50000, 50000)
    assert ok["chi2"] == pytest.approx(0.0) and ok["p_value"] == pytest.approx(1.0) and ok["srm"] is False
    bad = sub.srm_check(50000, 51500)
    assert bad["chi2"] == pytest.approx(2 * 750 ** 2 / 50750)
    assert bad["p_value"] == pytest.approx(2 * (1 - N.cdf(math.sqrt(bad["chi2"]))), rel=1e-6)
    assert bad["srm"] is True
    assert sub.srm_check(50000, 50500)["srm"] is False
    # 20/80 split with the right expected ratio is fine; with 50/50 it is a mismatch.
    assert sub.srm_check(20000, 80000, expected_ratio=0.2)["srm"] is False
    assert sub.srm_check(20000, 80000)["srm"] is True


def test_decide_outcomes():
    assert sub.decide(1000, 10000, 1150, 10000) == "ship"
    assert sub.decide(1150, 10000, 1000, 10000) == "dont_ship"
    assert sub.decide(1000, 10000, 1030, 10000) == "inconclusive"
    assert sub.decide(1000, 10000, 1150, 10000, alpha=0.0001) == "inconclusive"


def test_decide_checks_srm_first():
    # A huge "win", but the arms got 50,000 vs 52,000 users on a 50/50 split.
    assert sub.decide(5000, 50000, 6000, 52000) == "invalid_srm"
    assert sub.decide(5000, 50000, 6000, 52000, expected_ratio=50000 / 102000) == "ship"
