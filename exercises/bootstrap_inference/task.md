# Bootstrap Confidence Intervals from Scratch

Your team reports "average order value went up 4%" from one week of data. How sure should anyone be?
A point estimate without an interval is half an answer. Here you'll build the interval two ways: the
textbook normal approximation, and Efron's bootstrap, which works for statistics that have no handy
formula (like the median).

## 1. `mean_and_variance(x)` and `standard_error(x)`

- `mean_and_variance` returns `(mean, variance)` as Python floats, with the **unbiased** variance
  `s² = Σ (xᵢ − x̄)² / (n − 1)` (`ddof=1`).
- `standard_error` returns `s / √n`, the standard deviation of the sample mean.
- Both raise `ValueError` for fewer than 2 values.

## 2. `normal_ci(x, conf=0.95)`

`mean ± z · SE`, with `z = NormalDist().inv_cdf(0.5 + conf / 2)` from the standard library
(`statistics.NormalDist`). For 95% that's `z ≈ 1.96`. Return `(lower, upper)`.

## 3. `bootstrap_distribution(x, stat=np.mean, n_boot=2000, seed=0)`

Resample `x` with replacement `n_boot` times and compute the statistic on each resample.
Do it in **one vectorized draw**, in exactly this order, so results are reproducible:

```python
rng = np.random.default_rng(seed)
idx = rng.integers(0, n, size=(n_boot, n))   # row i = indices of resample i
replicates = stat(x[idx], axis=1)            # shape (n_boot,)
```

`stat` is any NumPy reducer that takes `axis` (`np.mean`, `np.median`, ...).

## 4. `percentile_ci(boot, conf=0.95)` and `bootstrap_ci(x, stat, conf, n_boot, seed)`

The percentile interval is the `alpha/2` and `1 − alpha/2` quantiles of the replicates, where
`alpha = 1 − conf` (use `np.quantile` defaults). `bootstrap_ci` chains the two functions.

## 5. `bootstrap_diff_ci(a, b, stat=np.mean, conf=0.95, n_boot=2000, seed=0)`

Bootstrap a difference between two independent groups. Use **one** generator, draw `a`'s index matrix
`(n_boot, len(a))` first, then `b`'s `(n_boot, len(b))`. Each replicate is
`stat(b_resample) − stat(a_resample)`. Return `(stat(b) − stat(a), lower, upper)`.

## 6. Coverage

- `coverage_rate(lows, highs, true_value)`: the fraction of intervals with `low <= true_value <= high`.
- `simulate_normal_ci_coverage(mu, sigma, n, n_sims=2000, conf=0.95, seed=0)`: draw
  `rng.normal(mu, sigma, size=(n_sims, n))`, build a `normal_ci` for every row (vectorized), and return
  the coverage of `mu`. A correct 95% procedure covers about 95% of the time. With tiny `n` the z-interval
  covers less than that, because it ignores the extra uncertainty in `s`.

## Rules

- NumPy and the standard library only. Never modify the inputs; lists must work as well as arrays.
- Return Python floats (tuples of floats for intervals), except `bootstrap_distribution`, which returns an array.

## Example

```python
>>> mean_and_variance([2, 4, 4, 4, 5, 5, 7, 9])
(5.0, 4.571428571428571)
>>> lo, hi = bootstrap_ci(x, stat=np.median, n_boot=1000, seed=5)   # lo < hi
```
