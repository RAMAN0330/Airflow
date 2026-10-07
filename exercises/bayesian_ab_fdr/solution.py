"""Bayesian A/B testing with Beta posteriors, multiple-testing corrections and a peeking simulation."""
from statistics import NormalDist

import numpy as np


def beta_posterior(successes, trials, prior_a=1.0, prior_b=1.0):
    if trials < 0 or not 0 <= successes <= trials or prior_a <= 0 or prior_b <= 0:
        raise ValueError("need 0 <= successes <= trials and positive prior parameters")
    return float(prior_a + successes), float(prior_b + trials - successes)


def bayesian_ab(conv_a, n_a, conv_b, n_b, n_samples=100_000, seed=0, prior=(1.0, 1.0)):
    a_a, b_a = beta_posterior(conv_a, n_a, *prior)
    a_b, b_b = beta_posterior(conv_b, n_b, *prior)
    rng = np.random.default_rng(seed)
    sa = rng.beta(a_a, b_a, n_samples)
    sb = rng.beta(a_b, b_b, n_samples)
    return {
        "prob_b_better": float(np.mean(sb > sa)),
        "expected_loss_a": float(np.mean(np.maximum(sb - sa, 0.0))),
        "expected_loss_b": float(np.mean(np.maximum(sa - sb, 0.0))),
    }


def _pvalues(pvalues):
    p = np.asarray(pvalues, dtype=float)
    if p.ndim != 1 or np.any((p < 0) | (p > 1)):
        raise ValueError("p-values must be a 1-D array in [0, 1]")
    return p


def bonferroni(pvalues, alpha=0.05):
    p = _pvalues(pvalues)
    m = max(p.size, 1)
    return p <= alpha / m


def bh_adjusted(pvalues):
    p = _pvalues(pvalues)
    m = p.size
    order = np.argsort(p, kind="stable")
    scaled = p[order] * m / np.arange(1, m + 1)
    scaled = np.minimum.accumulate(scaled[::-1])[::-1]
    adjusted = np.empty(m)
    adjusted[order] = np.minimum(scaled, 1.0)
    return adjusted


def benjamini_hochberg(pvalues, alpha=0.05):
    return bh_adjusted(pvalues) <= alpha


def peeking_simulation(n_sims=2000, n_looks=10, n_per_look=200, rate=0.1, alpha=0.05, seed=0):
    rng = np.random.default_rng(seed)
    conv_a = np.cumsum(rng.binomial(n_per_look, rate, size=(n_sims, n_looks)), axis=1)
    conv_b = np.cumsum(rng.binomial(n_per_look, rate, size=(n_sims, n_looks)), axis=1)
    n = n_per_look * np.arange(1, n_looks + 1)
    pooled = (conv_a + conv_b) / (2 * n)
    se = np.sqrt(pooled * (1 - pooled) * (2 / n))
    diff = (conv_b - conv_a) / n
    z = np.divide(diff, se, out=np.zeros_like(diff), where=se > 0)
    reject = np.abs(z) > NormalDist().inv_cdf(1 - alpha / 2)
    return {"fixed_horizon": float(reject[:, -1].mean()), "peeking": float(reject.any(axis=1).mean())}
