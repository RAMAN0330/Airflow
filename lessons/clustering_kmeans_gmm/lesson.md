# Clustering with K-Means & Gaussian Mixtures

Clustering finds groups in data that has no labels. K-means and Gaussian mixture models (GMMs) are the
two classics, and they share one loop: **assign** each point to clusters, then **update** each cluster
from its points, and repeat until nothing moves.

## Everything starts with a distance matrix

Both algorithms need the distance from every point to every centre: an `(n, k)` matrix. A double loop
over points and centres is slow. Expand the square instead:

```
||x − c||² = ||x||² − 2·x·c + ||c||²
D = (X**2).sum(1)[:, None] − 2 * X @ C.T + (C**2).sum(1)[None, :]    # (n,1) + (n,k) + (1,k)
```

The `[:, None]` and `[None, :]` matter. Drop the first and NumPy tries to add an `(n,)` vector to an
`(n, k)` matrix. That raises an error when `n ≠ k` and silently computes nonsense when `n == k`.
Round-off can also make a true zero come out as `-1e-15`, so clip at 0.

## K-means: Lloyd's algorithm

K-means minimizes **inertia**, the sum of squared distances from each point to its centroid:

1. **Assign:** `labels = D.argmin(axis=1)`.
2. **Update:** each centroid becomes the mean of its points.
3. Stop when the centroids stop moving.

Neither step can increase inertia, so the loop always converges, but only to a *local* minimum. Where
you start matters.

**k-means++ seeding** (Arthur & Vassilvitskii) picks the first centre uniformly at random, then picks
each next centre with probability proportional to its squared distance from the nearest centre
already chosen. Far-away points are likely picks, so the centres start spread out. It provably gets
within O(log k) of the optimum in expectation. Seed the random generator so results are reproducible.

**Empty clusters.** If a centroid ends up with no points, its mean is `0/0 = NaN`, and that NaN spreads
through the next distance matrix. A standard fix is to move the empty centroid onto the point that is
farthest from its current centroid, which is the point the model currently explains worst.

## Gaussian mixtures: soft k-means

A GMM says each point came from one of `k` Gaussians. Component `j` has weight `π_j`, mean `μ_j` and
(here) a diagonal covariance `σ²_j`. Instead of a hard label, each point gets a **responsibility**
`r_ij`, the probability that component `j` generated it. EM (Dempster, Laird & Rubin) alternates:

- **E-step:** `r_ij ∝ π_j · N(x_i | μ_j, σ²_j)`, normalized over `j`.
- **M-step:** `N_j = Σ_i r_ij`, then `π_j = N_j / n`, `μ_j = Σ r_ij x_i / N_j` and
  `σ²_j = Σ r_ij (x_i − μ_j)² / N_j`, plus a small `reg` to keep variances away from 0.

Each EM iteration never decreases the log-likelihood. Plot it as a free bug detector: if it ever goes
down, something is wrong. With tiny variances and hard 0/1 responsibilities, EM turns into k-means.

## Do the E-step in log space

A point 40 standard deviations from a mean has density around `exp(−800)`, which underflows to 0. If
that happens for every component, normalizing gives `0 / 0 = NaN`. Work with logs and use the same
max-subtraction trick as a stable softmax:

```
log_r = log(π) + log_gauss                        # (n, k)
log_norm = logsumexp(log_r, axis=1)               # m + log Σ exp(log_r − m), with m = row max
resp = exp(log_r − log_norm[:, None])             # rows sum to 1, never NaN
log_likelihood = log_norm.sum()
```

## Which one to use

| | K-means | GMM |
|---|---|---|
| Assignment | hard label | probability per cluster |
| Cluster shape | round, similar size | per-feature spread, unequal weights |
| Cost per iteration | cheap | a bit more |
| Typical use | fast segmentation, vector quantization | soft membership, density estimation |

In the exercise you'll build both from the distance matrix up: vectorized distances, k-means++, Lloyd's
loop with empty-cluster repair, and a diagonal GMM with a log-space E-step.
