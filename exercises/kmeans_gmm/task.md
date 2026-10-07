# K-Means and Gaussian Mixtures from Scratch

You have unlabeled customer embeddings and want segments. K-means gives every point one hard label. A
Gaussian mixture gives every point a probability of belonging to each segment. Both are built from the
same parts: a distance matrix, an assignment step and an update step, repeated until nothing moves.
Build them with NumPy only.

## 1. `pairwise_sq_dists(X, C)`

`X` is `(n, d)` points, `C` is `(k, d)` centroids. Return the `(n, k)` matrix of squared Euclidean
distances **without Python loops over points**:

```
||x − c||² = ||x||² − 2·x·c + ||c||²      # (n, 1) − 2·(n, k) + (1, k)
```

Round-off can push a true 0 slightly negative, so clip the result at 0. It must work for any `n` and `k`,
not just `n == k`.

## 2. `kmeans_pp_init(X, k, seed=0)`: k-means++ seeding

Use a single `rng = np.random.default_rng(seed)` and exactly this sequence of draws:

1. First centre: index `rng.integers(n)`.
2. Let `d2[i]` be point `i`'s squared distance to its **nearest** chosen centre.
3. Next centre: index `rng.choice(n, p=d2 / d2.sum())`. If `d2.sum()` is 0 (all points already
   coincide with a centre), use `rng.integers(n)` instead.
4. Repeat 2–3 until there are `k` centres.

Return `X[indices].copy()`, shape `(k, d)`. Raise `ValueError` unless `1 <= k <= n`.

## 3. `update_centroids(X, labels, k)`

Return the `(k, d)` mean of each cluster. An **empty cluster** must not become `NaN`: for each empty
cluster `j` in increasing order, move it to the point with the largest squared distance to its own
cluster's new mean, then exclude that point so a second empty cluster picks a different one.

## 4. `kmeans(X, k, seed=0, max_iter=100, tol=1e-8, init=None)`: Lloyd's algorithm

Start from `init` (a `(k, d)` array; copy it) or, if `None`, from `kmeans_pp_init(X, k, seed)`. Then repeat
at most `max_iter` times:

1. `labels = argmin` over the distance matrix.
2. `new = update_centroids(X, labels, k)`.
3. Stop once `sum((new − old)²) <= tol`.

Return `(centroids, labels, inertia)`, where `labels` and `inertia` (a Python `float`: the sum of each
point's squared distance to its nearest centroid) are computed from the **final** centroids.

## 5. Diagonal Gaussian mixture with EM

Each component `j` has a weight `π_j`, a mean `μ_j` and per-feature variances `σ²_j` (all `(k, d)` arrays).

| Function | Returns |
|---|---|
| `logsumexp(a, axis=-1)` | `log Σ exp(a)` along `axis`, stable for values like ±1e4 |
| `log_gaussian_diag(X, means, variances)` | `(n, k)` of `−½ Σ_d [log(2π σ²_jd) + (x_d − μ_jd)² / σ²_jd]` |
| `gmm_e_step(X, weights, means, variances)` | `(resp (n, k), log_likelihood float)` |
| `gmm_m_step(X, resp, reg=1e-6)` | `(weights (k,), means (k, d), variances (k, d))` |
| `fit_gmm(X, k, seed=0, max_iter=200, tol=1e-6, reg=1e-6)` | `dict`, see below |

**E-step in log space:** `log_r = log π_j + log N(x_i | μ_j, σ²_j)`, then
`resp = exp(log_r − logsumexp(log_r, axis=1)[:, None])`. The log-likelihood is the sum of the row
logsumexps. A point 500 units from every mean must still get finite responsibilities that sum to 1.

**M-step:** `N_j = Σ_i r_ij`, `π_j = N_j / n`, `μ_j = Σ_i r_ij x_i / N_j`,
`σ²_j = Σ_i r_ij (x_i − μ_j)² / N_j + reg`.

**`fit_gmm`:** initialize means with `kmeans_pp_init(X, k, seed)`, every variance row with
`X.var(axis=0) + reg`, and uniform weights. Each iteration runs an E-step, appends its log-likelihood to a
list, stops if it improved by less than `tol` over the previous one, and otherwise runs an M-step. Return
`{"weights", "means", "variances", "resp", "log_likelihood"}`, where `log_likelihood` is that list.
EM never decreases it.

Never modify the input arrays.
