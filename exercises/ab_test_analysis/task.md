# Analyze an A/B Test Like an Experimentation Platform

The checkout team changed the "Buy" button and split traffic 50/50. After two weeks the dashboard says
B converts better. Your job is to write the analysis the experimentation platform runs before anyone
ships: is the difference real, how big is it, was the test big enough, and can the data be trusted at all?
SciPy isn't available, so you'll build the normal distribution yourself from `math.erf`.

## 1. `norm_cdf(z)` and `norm_ppf(p, tol=1e-12)`

- `norm_cdf(z) = 0.5 · (1 + erf(z / √2))`. (`0.5 · erfc(−z / √2)` is the same thing and more accurate for very negative `z`.)
- `norm_ppf(p)` inverts it by **bisection**. `Φ` is strictly increasing, so start with `[−40, 40]`, keep the
  half where `Φ(mid)` brackets `p`, and stop when the bracket is narrower than `tol`. Raise `ValueError`
  unless `0 < p < 1`. Check: `norm_ppf(0.975) ≈ 1.959964`.

## 2. `two_proportion_ztest(conv_a, n_a, conv_b, n_b)`

The null hypothesis says both arms share one conversion rate, so the test uses the **pooled** rate:

```
p = (conv_a + conv_b) / (n_a + n_b)
SE_pooled = √( p (1 − p) (1/n_a + 1/n_b) )
z = (p_b − p_a) / SE_pooled
p_value = 2 · (1 − Φ(|z|))            # two-sided
```

Return `{"p_a", "p_b", "diff", "z", "p_value"}` with `diff = p_b − p_a`. If `SE_pooled` is 0 (no
conversions at all, or all users converted), return `z = 0.0` and `p_value = 1.0`. Raise `ValueError` if
any `n <= 0` or a conversion count is outside `[0, n]`.

## 3. `lift_ci(conv_a, n_a, conv_b, n_b, conf=0.95)`

A confidence interval for the absolute lift `p_b − p_a`. Here you don't assume the null, so use the
**unpooled** SE `√(p_a(1 − p_a)/n_a + p_b(1 − p_b)/n_b)` and `z = norm_ppf(0.5 + conf/2)`.
Return `(diff, lower, upper)`.

## 4. `sample_size_per_arm(baseline, mde, alpha=0.05, power=0.8)`

Users per arm needed to detect an absolute change `mde` (so `p2 = baseline + mde`) with a two-sided test:

```
n = (z_{1−α/2} + z_{power})² · (p1(1 − p1) + p2(1 − p2)) / mde²
```

Round up and return an `int`. `sample_size_per_arm(0.10, 0.02) == 3839`. Raise `ValueError` if
`baseline` or `baseline + mde` falls outside `(0, 1)`, or `mde == 0`.

## 5. `srm_check(n_a, n_b, expected_ratio=0.5, threshold=0.001)`

**Sample ratio mismatch**: did the arms get the share of users the design promised? Expected counts are
`total · expected_ratio` for A and the rest for B. Run a chi-square goodness-of-fit test with 1 degree of
freedom:

```
chi2 = Σ (observed − expected)² / expected
p_value = erfc(√(chi2 / 2))          # chi-square(1) survival function
```

Return `{"chi2", "p_value", "srm": p_value < threshold}`.

## 6. `decide(conv_a, n_a, conv_b, n_b, alpha=0.05, expected_ratio=0.5, srm_threshold=0.001)`

1. If `srm_check` flags a mismatch, return `"invalid_srm"`. Don't even look at the metric.
2. If the z-test's `p_value >= alpha`, return `"inconclusive"`.
3. Otherwise return `"ship"` if B is better, or `"dont_ship"` if B is worse.

## Example

```python
>>> two_proportion_ztest(200, 2000, 250, 2000)["p_value"]
0.01235...
>>> decide(5000, 50000, 6000, 52000)      # great lift, but 50,000 vs 52,000 on a 50/50 split
'invalid_srm'
```
