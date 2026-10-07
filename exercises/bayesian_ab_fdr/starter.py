"""Bayesian A/B testing with Beta posteriors, multiple-testing corrections and a peeking simulation."""
from statistics import NormalDist

import numpy as np


def beta_posterior(successes, trials, prior_a=1.0, prior_b=1.0):
    """Return the Beta posterior (alpha, beta) for a Binomial likelihood and a Beta(prior_a, prior_b) prior."""
    raise NotImplementedError


def bayesian_ab(conv_a, n_a, conv_b, n_b, n_samples=100_000, seed=0, prior=(1.0, 1.0)):
    """Monte Carlo summary: {"prob_b_better", "expected_loss_a", "expected_loss_b"}."""
    raise NotImplementedError


def bonferroni(pvalues, alpha=0.05):
    """Boolean rejections: p <= alpha / m."""
    raise NotImplementedError


def bh_adjusted(pvalues):
    """Benjamini-Hochberg adjusted p-values (monotone, capped at 1), in the input order."""
    raise NotImplementedError


def benjamini_hochberg(pvalues, alpha=0.05):
    """Boolean rejections controlling the false discovery rate at alpha."""
    raise NotImplementedError


def peeking_simulation(n_sims=2000, n_looks=10, n_per_look=200, rate=0.1, alpha=0.05, seed=0):
    """Simulate A/A tests checked after every batch. Return {"fixed_horizon", "peeking"} false positive rates."""
    raise NotImplementedError
