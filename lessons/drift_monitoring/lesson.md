# Monitoring Models: Data Drift & Dataset Shift

A deployed model doesn't crash when the world changes. It just quietly gets worse. A churn model trained
before a pricing change, or a fraud model facing a new attack pattern, will keep returning confident
predictions. Rabanser et al. argue ML systems should **fail loudly** instead, by detecting when
deployment data no longer resembles training data.

## Kinds of shift

| Shift | What changes | Example |
|---|---|---|
| **Covariate shift** | input distribution `P(x)` | a marketing campaign brings in younger users |
| **Prior / label shift** | outcome rates `P(y)` | fraud rate doubles during the holidays |
| **Concept drift** | the relationship `P(y \| x)` | the same behavior now means something else |
| **Training/serving skew** | pipeline differences | a feature is computed differently online than offline |

Labels often arrive weeks later, if at all, while **inputs are available immediately**. Watching input
distributions is the earliest signal you get. The ML Test Score rubric's monitoring section includes
checking that serving inputs keep the data invariants seen in training.

## Population Stability Index (PSI)

PSI bins one feature and compares the share of data in each bin:

1. **Bin on the reference data's quantiles**, so each bin holds about the same share of training data.
   Extend the outer edges to −∞ and +∞ so every current value lands somewhere.
2. Compute proportions `r` (reference) and `c` (current) per bin.
3. `PSI = Σ (c − r) · ln(c / r)`

An empty bin would give `ln(0)`, so **clip proportions to a small ε** (e.g. 1e-6) first. PSI is 0 for
identical proportions and grows as mass moves between bins.

> Widely used rule of thumb (not a statistical test): PSI < 0.1 means little change, 0.1–0.25 moderate,
> ≥ 0.25 a major shift worth investigating.

Quantile bins can collapse when many values repeat (a constant feature has a single quantile). Taking
`np.unique` of the edges keeps the binning valid.

## Kolmogorov–Smirnov (KS) distance

For continuous features, KS compares **cumulative** distributions without binning:

```
D = max_x | F_ref(x) − F_cur(x) |      where F(x) = fraction of the sample ≤ x
```

It's 0 for identical samples and 1 when the samples don't overlap at all. With sorted samples, each
empirical CDF at any point is one `np.searchsorted(..., side="right")` away. `scipy.stats.ks_2samp`
computes the same statistic plus a p-value. With production-sized samples almost everything becomes
"significant", so teams often alert on the distance itself.

## From statistics to action

A drift report lists each feature with its PSI and KS, and flags those over a threshold. Then:

- **One feature drifted sharply?** Suspect an upstream data bug before blaming the world.
- **Many features drifted gradually?** The population changed, so consider retraining.
- **Nothing drifted but performance fell?** Look for concept drift once labels arrive.

Tune thresholds on your own history: alert fatigue makes a monitoring system useless just as surely as
silence does.
