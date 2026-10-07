"""Hidden validation suite for bayesian_ab_fdr."""
from math import exp, lgamma, log

import numpy as np
import pytest

import submission as sub


def lbeta(a, b):
    return lgamma(a) + lgamma(b) - lgamma(a + b)


def closed_form_prob_b_better(a_a, b_a, a_b, b_b):
    """Exact P(p_B > p_A) for Beta posteriors with integer a_b (Evan Miller's formula)."""
    return sum(exp(lbeta(a_a + i, b_a + b_b) - log(b_b + i) - lbeta(1 + i, b_b) - lbeta(a_a, b_a))
               for i in range(int(a_b)))


def ref_bh(p):
    p = np.asarray(p, float)
    m = p.size
    ranks = np.argsort(np.argsort(p, kind="stable"), kind="stable") + 1
    srt = np.sort(p)
    out = np.empty(m)
    for i in range(m):
        r = ranks[i]
        out[i] = min(1.0, min(srt[j] * m / (j + 1) for j in range(r - 1, m)))
    return out


# 15 p-values: Bonferroni rejects 3, BH rejects 4 at alpha = 0.05.
BH_EXAMPLE = [0.0001, 0.0004, 0.0019, 0.0095, 0.0201, 0.0278, 0.0298, 0.0344,
              0.0459, 0.3240, 0.4262, 0.5719, 0.6528, 0.7590, 1.0000]


def test_beta_posterior_adds_prior():
    assert sub.beta_posterior(3, 10) == pytest.approx((4.0, 8.0))
    assert sub.beta_posterior(0, 0) == pytest.approx((1.0, 1.0))
    assert sub.beta_posterior(30, 100, prior_a=2.0, prior_b=18.0) == pytest.approx((32.0, 88.0))
    for bad in ((11, 10), (-1, 10)):
        with pytest.raises(ValueError):
            sub.beta_posterior(*bad)


def test_bayesian_ab_matches_reference():
    got = sub.bayesian_ab(120, 1000, 145, 1000, n_samples=50_000, seed=4)
    rng = np.random.default_rng(4)
    sa = rng.beta(121, 881, 50_000)
    sb = rng.beta(146, 856, 50_000)
    assert got["prob_b_better"] == pytest.approx(np.mean(sb > sa), abs=1e-12)
    assert got["expected_loss_a"] == pytest.approx(np.mean(np.maximum(sb - sa, 0)), rel=1e-9)
    assert got["expected_loss_b"] == pytest.approx(np.mean(np.maximum(sa - sb, 0)), rel=1e-9)
    assert sub.bayesian_ab(120, 1000, 145, 1000, n_samples=50_000, seed=4) == got


def test_prob_b_better_matches_closed_form():
    for (ca, na, cb, nb) in ((3, 10, 7, 12), (40, 400, 55, 410), (0, 5, 1, 5)):
        exact = closed_form_prob_b_better(1 + ca, 1 + na - ca, 1 + cb, 1 + nb - cb)
        got = sub.bayesian_ab(ca, na, cb, nb, n_samples=200_000, seed=1)["prob_b_better"]
        assert got == pytest.approx(exact, abs=0.005)
    same = sub.bayesian_ab(50, 500, 50, 500, n_samples=200_000, seed=2)["prob_b_better"]
    assert same == pytest.approx(0.5, abs=0.005)


def test_expected_loss_properties():
    r = sub.bayesian_ab(40, 400, 55, 410, n_samples=200_000, seed=3)
    assert r["expected_loss_a"] >= 0 and r["expected_loss_b"] >= 0
    assert r["expected_loss_b"] < r["expected_loss_a"]
    mean_diff = 56 / 412 - 41 / 402  # posterior means of B and A
    assert r["expected_loss_a"] - r["expected_loss_b"] == pytest.approx(mean_diff, abs=1e-3)
    # More data with the same rates shrinks the risk of choosing B.
    big = sub.bayesian_ab(400, 4000, 550, 4100, n_samples=200_000, seed=3)
    assert big["expected_loss_b"] < r["expected_loss_b"] / 10


def test_bonferroni_threshold():
    rej = np.asarray(sub.bonferroni(BH_EXAMPLE, alpha=0.05))
    assert rej.dtype == bool and rej.shape == (15,)
    assert rej.sum() == 3 and rej[:3].all()
    assert list(sub.bonferroni([0.01, 0.02, 0.03, 0.04], alpha=0.05)) == [True, False, False, False]
    assert list(sub.bonferroni([0.04], alpha=0.05)) == [True]


def test_bh_adjusted_matches_reference():
    rng = np.random.default_rng(0)
    for m in (1, 2, 7, 40):
        p = rng.uniform(0, 1, m) ** 3
        np.testing.assert_allclose(sub.bh_adjusted(p), ref_bh(p), rtol=1e-12)
    # Raw ratios p*m/rank are [0.04, 0.021]; the step-up rule makes both 0.021.
    np.testing.assert_allclose(sub.bh_adjusted([0.02, 0.021]), [0.021, 0.021])


def test_bh_adjusted_is_monotone_and_capped():
    p = np.array([0.5, 0.01, 0.04, 0.03, 0.9, 0.02, 0.6])
    adj = np.asarray(sub.bh_adjusted(p))
    order = np.argsort(p)
    assert np.all(np.diff(adj[order]) >= -1e-15)
    assert np.all(adj >= p) and np.all(adj <= 1.0)
    assert sub.bh_adjusted([0.9, 0.95])[1] == pytest.approx(0.95)
    assert np.asarray(sub.bh_adjusted([])).shape == (0,)


def test_benjamini_hochberg_known_example():
    rej = np.asarray(sub.benjamini_hochberg(BH_EXAMPLE, alpha=0.05))
    assert rej.dtype == bool
    assert rej.sum() == 4 and rej[:4].all()
    perm = np.random.default_rng(5).permutation(15)
    shuffled = np.asarray(BH_EXAMPLE)[perm]
    np.testing.assert_array_equal(sub.benjamini_hochberg(shuffled, alpha=0.05), rej[perm])
    # BH is never more conservative than Bonferroni.
    assert np.all(rej >= np.asarray(sub.bonferroni(BH_EXAMPLE, alpha=0.05)))
    with pytest.raises(ValueError):
        sub.benjamini_hochberg([0.2, 1.3])


def test_peeking_inflates_false_positives():
    r = sub.peeking_simulation(n_sims=2000, n_looks=10, n_per_look=200, rate=0.1, alpha=0.05, seed=0)
    assert 0.03 <= r["fixed_horizon"] <= 0.07
    assert r["peeking"] > 2.5 * r["fixed_horizon"]
    assert sub.peeking_simulation(n_sims=500, seed=1) == sub.peeking_simulation(n_sims=500, seed=1)
    one = sub.peeking_simulation(n_sims=500, n_looks=1, seed=2)
    assert one["peeking"] == one["fixed_horizon"]


def test_inputs_not_mutated():
    p = np.array([0.3, 0.01, 0.2, 0.04])
    p0 = p.copy()
    sub.bh_adjusted(p)
    sub.benjamini_hochberg(p)
    sub.bonferroni(p)
    np.testing.assert_array_equal(p, p0)
    assert len(sub.bh_adjusted([0.3, 0.01, 0.2])) == 3
