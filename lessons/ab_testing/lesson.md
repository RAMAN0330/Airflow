# Hypothesis Tests & A/B Testing

An A/B test randomly splits users between the current product (A, control) and a change (B, treatment),
then compares a metric. Randomization is what makes it powerful: any systematic difference between the
arms has to come from the change. Chance can still produce differences, though. A hypothesis test asks
how surprising the observed difference would be if the change did nothing.

## The two-proportion z-test

For a conversion rate, arm A has `conv_a` successes out of `n_a` users, and likewise for B. The null
hypothesis H0 says both arms share one true rate. Under H0 the best estimate of that rate **pools** both arms:

```
p̂ = (conv_a + conv_b) / (n_a + n_b)
SE₀ = √( p̂ (1 − p̂) (1/n_a + 1/n_b) )
z = (p̂_b − p̂_a) / SE₀
```

The **p-value** is the probability, under H0, of a difference at least this extreme in *either*
direction: `p = 2 · (1 − Φ(|z|))`. A one-tailed `1 − Φ(z)` halves the p-value for wins and gives nonsense
for losses. If `p < α` (usually 0.05) you reject H0. That doesn't make B good: a significantly *negative*
result is also a result.

`Φ` needs no SciPy: `Φ(z) = ½ (1 + erf(z/√2))`, and `math.erf` is in the standard library. For the
inverse `Φ⁻¹` (critical values), bisection works because `Φ` is strictly increasing. Halve a bracket
like `[−40, 40]` about 50 times and you have it to 1e-12.

## How big is the effect?

A p-value says nothing about size. Report a confidence interval for the lift `p_b − p_a`. Here you're not
assuming H0, so each arm keeps its own variance (the **unpooled** SE):

```
SE = √( p̂_a(1 − p̂_a)/n_a + p̂_b(1 − p̂_b)/n_b )        diff ± z_{1−α/2} · SE
```

Pooled for the test, unpooled for the interval. Mixing them up changes `z` noticeably when the arms
differ in size.

## Before you start: sample size

Decide the **minimum detectable effect** (MDE) worth shipping, then compute users per arm:

```
n = (z_{1−α/2} + z_{power})² · (p₁(1 − p₁) + p₂(1 − p₂)) / MDE²
```

With a 10% baseline, a 2-point MDE, α = 0.05 and 80% power, that's 3,839 users per arm. Halve the MDE and
you need about 4× the users. Fixing `n` up front is also what keeps the p-value honest. Stopping as soon
as it dips below 0.05 inflates false positives (next lesson).

## Trust first: sample ratio mismatch

If you designed a 50/50 split and got 50,000 vs 51,500 users, something is broken: a redirect that drops
some users, a bot filter that hits one arm, a logging bug. Kohavi and colleagues call this a **sample
ratio mismatch** (SRM). Fabijan et al. report SRMs in roughly 6% of experiments at Microsoft, traced to
dozens of different root causes. Check it with a chi-square goodness-of-fit test on the counts:

```
χ² = Σ (observed − expected)² / expected          p = erfc(√(χ²/2))   (1 degree of freedom)
```

Use a strict threshold (such as 0.001), because this check runs on every experiment. If it fires, the
metric comparison is **invalid**. Don't read it at all, however good the lift looks.

## The decision

1. SRM? → invalid, debug the experiment.
2. `p ≥ α` → inconclusive (not "no effect", just not enough evidence).
3. Significant and positive → ship. Significant and negative → don't ship.

In the exercise you'll build each piece from `math.erf` up and wire them into that decision.
