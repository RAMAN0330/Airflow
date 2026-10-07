# Sampling, Estimation & the Bootstrap

Every number on a dashboard is computed from a **sample**: this week's orders, the users in an
experiment, a thousand labeled examples. Run the week again and you'd get a different number. Estimation
is about reporting the number together with how much it would wobble, so nobody mistakes noise for news.

## Estimators and the n − 1

The sample mean `x̄ = Σ xᵢ / n` estimates the population mean. For spread you want the sample variance

```
s² = Σ (xᵢ − x̄)² / (n − 1)
```

Why `n − 1`? The deviations are measured from `x̄`, which was fitted to this very sample, so they come out
slightly too small. Dividing by `n − 1` (Bessel's correction) makes `s²` unbiased. NumPy defaults to
`ddof=0` (divide by `n`), so write `np.var(x, ddof=1)`. With `n = 5` the default understates the variance by 20%.

## Standard error and the normal interval

The **standard error** is the standard deviation of the estimator itself, not of the data:

```
SE(x̄) = s / √n
```

Quadruple the sample and the SE halves. By the central limit theorem, `x̄` is roughly normal for
moderate `n`, which gives the familiar interval

```
x̄ ± z · SE        z = Φ⁻¹(0.5 + conf/2) ≈ 1.96 for 95%
```

"95% confidence" describes the **procedure**: if you repeated the sampling many times, about 95% of
intervals built this way would contain the true mean. Any single interval either contains it or doesn't.
For small `n` the t distribution's wider critical value is the textbook fix, which is what the NIST
handbook uses. You'll see the z-interval under-cover at `n = 4` in the exercise.

## The bootstrap

What's the SE of a **median**? Or of a trimmed mean, or a ratio of two metrics? Often there's no tidy
formula. Efron's 1979 idea: treat the sample as a stand-in for the population, and sample from *it*.

1. Draw `n` values **with replacement** from your data. That's one bootstrap resample.
2. Compute the statistic on it.
3. Repeat `B` times (1,000 to 10,000 is typical). The spread of the `B` replicates approximates the
   estimator's sampling distribution.

The **percentile interval** reads the answer straight off the replicates: for 95%, the 2.5th and 97.5th
percentiles. Lower first. Swap them and you get an "interval" with `lo > hi`.

In NumPy you can draw every resample at once as an index matrix, with no Python loop:

```python
rng = np.random.default_rng(seed)               # seeded: same seed, same answer
idx = rng.integers(0, n, size=(B, n))           # row b = indices of resample b
reps = np.median(x[idx], axis=1)                # B replicates
lo, hi = np.quantile(reps, [0.025, 0.975])
```

Seed the generator so a rerun reproduces the report exactly. Make sure every row really is a fresh
resample, because reusing one draw `B` times gives zero spread and a fake-precise interval.

## Comparing two groups

For a difference between independent groups A and B, resample **each group separately** (keeping its own
size), compute `stat(B*) − stat(A*)` per replicate, and take percentiles. If the 95% interval excludes 0,
the data are hard to explain by sampling noise alone. This works for medians, where the normal formula
doesn't directly apply.

## Checking your intervals: coverage

The honest test of an interval method is a simulation: generate many datasets from a known truth, build
an interval for each, and count how often the truth lands inside. A 95% method should cover about 95% of
the time. The percentile bootstrap is approximate too, and it can under-cover for small samples and
skewed statistics, so "it's a bootstrap" doesn't excuse you from checking.

In the exercise you'll build the normal interval, a vectorized seeded bootstrap, a two-group bootstrap,
and a coverage simulator that shows when the normal approximation breaks down.
