# Bayesian A/B & Multiple Testing

The z-test answers "how surprising is this data if nothing changed?" Stakeholders usually want something
else: "how likely is B better, and how much do we risk by shipping it?" This lesson covers the Bayesian
way to answer that, and then two habits that quietly break *any* test: running many comparisons at once,
and peeking at a test while it runs.

## Beta-Binomial: the posterior in one line

Put a `Beta(α, β)` prior on a conversion rate. After `s` conversions out of `n` users, the posterior is

```
Beta(α + s, β + n − s)
```

The Beta is **conjugate** to the Binomial, so updating is just adding counts. `Beta(1, 1)` is uniform.
You can read `α` and `β` as "pseudo-conversions" and "pseudo-non-conversions" seen before the test. Don't
forget the prior: with 3/10 conversions the posterior is `Beta(4, 8)`, not `Beta(3, 7)`. That gap matters
most when data are scarce, which is exactly when people look at Bayesian results.

## Probability B beats A, and expected loss

Draw many samples from each posterior and compare them:

```python
rng = np.random.default_rng(seed)
sa = rng.beta(1 + conv_a, 1 + n_a - conv_a, 100_000)
sb = rng.beta(1 + conv_b, 1 + n_b - conv_b, 100_000)
p_b_better = np.mean(sb > sa)
loss_if_ship_b = np.mean(np.maximum(sa - sb, 0))   # rate you give up if B is actually worse
```

Evan Miller gives a closed form for `P(B > A)` when the parameters are integers, which is useful for
checking the simulation. "94% chance B is better" can still hide a large downside. **Expected loss**
weighs how bad you'd be when wrong. Stucchio's VWO whitepaper ships the variant once its expected loss
drops below a small "threshold of caring". Seed the generator so the report is reproducible.

## Many tests at once

Test 20 metrics at α = 0.05 when nothing changed, and you expect one "significant" result by luck.

**Bonferroni** controls the family-wise error rate (the chance of *any* false positive): reject when
`p ≤ α / m`. Divide, don't multiply. It's simple and safe, but harsh when `m` is large.

**Benjamini–Hochberg (1995)** controls the **false discovery rate**: the expected share of false
positives among the results you call significant. Sort the p-values and find the largest `i` with
`p_(i) ≤ i · α / m`, then reject the `i` smallest. Equivalently, compute adjusted p-values:

```
adj_(i) = min over j ≥ i of ( p_(j) · m / j ),   capped at 1
```

The running minimum is the step people skip. Without it, `[0.02, 0.021]` adjusts to `[0.04, 0.021]`.
The smaller p-value would then look *less* significant, and comparing to α would disagree with the
step-up rule. With the minimum, both become 0.021. BH rejects at least as much as Bonferroni and often
far more, which is why it's the usual choice for metric scorecards.

## Peeking

A p-value assumes you looked once, at a sample size fixed in advance. If you check after every batch and
stop at the first `p < 0.05`, you get many chances to cross the line by luck. Evan Miller's "How Not To
Run an A/B Test" shows the false positive rate climbing far above the nominal 5%. You can see it yourself
with **A/A tests** (both arms identical, so every win is false):

| Analysis | False positive rate (10 looks) |
|---|---|
| Look once at the end | ≈ 5% |
| Stop at the first significant look | ≈ 19% |

Fixes: commit to a sample size (previous lesson), or use methods built for continuous monitoring, such as
the always-valid p-values Johari et al. deployed at Optimizely. Bayesian summaries aren't automatically
immune either, so decide your stopping rule before the data arrive.

In the exercise you'll compute posteriors, `P(B > A)` and expected loss with seeded Monte Carlo, implement
Bonferroni and Benjamini–Hochberg (with adjusted p-values), and run the peeking simulation.
