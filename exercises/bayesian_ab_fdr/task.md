# Bayesian A/B Tests and Many Comparisons

The product manager doesn't want a p-value. They want to know "what's the chance B is better, and what
do we lose if we're wrong?" The Bayesian view answers that directly. Meanwhile the analytics team is
testing 15 metrics at once and checking the dashboard every morning. Both habits manufacture false
wins. You'll build the tools to answer the PM and to keep the team honest.

## 1. `beta_posterior(successes, trials, prior_a=1.0, prior_b=1.0)`

With a `Beta(prior_a, prior_b)` prior on a conversion rate and Binomial data, the posterior is

```
Beta(prior_a + successes, prior_b + trials − successes)
```

Return the two parameters as floats. `Beta(1, 1)` is the uniform prior. Raise `ValueError` unless
`0 <= successes <= trials` and both prior parameters are positive.

## 2. `bayesian_ab(conv_a, n_a, conv_b, n_b, n_samples=100_000, seed=0, prior=(1.0, 1.0))`

Sample both posteriors with one seeded generator, **A first, then B**:

```python
rng = np.random.default_rng(seed)
sa = rng.beta(alpha_a, beta_a, n_samples)
sb = rng.beta(alpha_b, beta_b, n_samples)
```

Return:

| key | value |
|---|---|
| `"prob_b_better"` | `mean(sb > sa)`, the posterior probability that B's rate is higher |
| `"expected_loss_a"` | `mean(max(sb − sa, 0))`, the conversion rate you expect to give up by choosing A |
| `"expected_loss_b"` | `mean(max(sa − sb, 0))`, the same for choosing B |

A common decision rule ships B once `expected_loss_b` drops below a "threshold of caring".

## 3. `bonferroni(pvalues, alpha=0.05)`

With `m` tests, reject test `i` when `pᵢ <= alpha / m`. This controls the chance of **any** false
positive (the family-wise error rate). Return a boolean NumPy array in input order.

## 4. `bh_adjusted(pvalues)` and `benjamini_hochberg(pvalues, alpha=0.05)`

Benjamini–Hochberg controls the **false discovery rate**, the expected share of false positives among
your rejections. Adjusted p-values:

1. Sort: `p_(1) <= ... <= p_(m)`.
2. Scale: `p_(i) · m / i`.
3. **Enforce monotonicity**: take a running minimum from the largest rank down, so a smaller p-value
   never gets a larger adjusted value than a bigger one.
4. Cap at 1 and put the values back in the original order.

`benjamini_hochberg` rejects where the adjusted p-value is `<= alpha`. Both functions raise `ValueError`
for p-values outside `[0, 1]`. An empty input returns an empty array.

## 5. `peeking_simulation(n_sims=2000, n_looks=10, n_per_look=200, rate=0.1, alpha=0.05, seed=0)`

Simulate `n_sims` **A/A tests** (both arms have the same true `rate`, so every "win" is a false positive).
Each test gets `n_per_look` new users per arm per look:

```python
rng = np.random.default_rng(seed)
conv_a = np.cumsum(rng.binomial(n_per_look, rate, size=(n_sims, n_looks)), axis=1)
conv_b = np.cumsum(rng.binomial(n_per_look, rate, size=(n_sims, n_looks)), axis=1)
```

At each look, run the pooled two-proportion z-test (use `z = 0` where the SE is 0) and compare `|z|` with
`NormalDist().inv_cdf(1 − alpha/2)`. Return:

- `"fixed_horizon"`: the share of simulations that reject at the **last** look only.
- `"peeking"`: the share that reject at **any** look, as if you stopped at the first significant result.

## Rules

NumPy and the standard library only. Don't modify inputs, and accept lists as well as arrays.

## Example

```python
>>> beta_posterior(3, 10)
(4.0, 8.0)
>>> bh_adjusted([0.02, 0.021])
array([0.021, 0.021])
```
