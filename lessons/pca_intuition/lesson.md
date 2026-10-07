# Principal Component Analysis: Directions of Variance

Real datasets have many features that move together: height and weight, or a dozen sensors on the same
machine. PCA rotates the coordinate system so the first axis points along the direction of greatest
variance, the second along the greatest remaining variance at right angles to the first, and so on.
Keep the first few axes and you've compressed the data while losing as little variance as possible.

## Step 1: center

PCA describes variation *around the mean*, so subtract each column's mean first:

```
mean = X.mean(axis=0)
Xc = X - mean
```

Skip this and the first "component" mostly points from the origin to the data's mean. Shift the data
by 1000 and the answer changes completely. A correct PCA is **shift-invariant**.

## Step 2: the covariance matrix

```
C = Xc.T @ Xc / (n − 1)        # (d, d), matches np.cov(X, rowvar=False)
```

`C[i, j]` is how features `i` and `j` vary together, and the diagonal holds each feature's variance.
Dividing by `n − 1` (Bessel's correction) gives the unbiased sample estimate. Dividing by `n` scales
every variance down by `(n − 1)/n`, so your numbers won't match `np.cov` or scikit-learn.

## Step 3: eigendecomposition

The variance of the data projected onto a unit vector `w` is `wᵀ C w`. The `w` that maximizes it is the
eigenvector of `C` with the largest eigenvalue, and that eigenvalue *is* the variance along it.
`C` is symmetric, so use `np.linalg.eigh` (not `eig`): it's faster, more accurate, and returns real
values. It has two traps:

- Eigenvalues come back in **ascending** order. PCA wants largest first, so reverse both arrays.
- Eigenvectors are the **columns** of the result. Transpose to get one component per row.

```
evals, evecs = np.linalg.eigh(C)
order = np.argsort(evals)[::-1]
components = evecs[:, order].T          # (d, d), row i = i-th principal axis
```

## Step 4 (alternative): SVD of the data

You don't need to form `C`. Take the thin SVD of the centered data, `Xc = U S Vᵀ`. Then
`C = V S² Vᵀ / (n − 1)`, so:

- the rows of `Vᵀ` are the principal components, already sorted largest first
- `S² / (n − 1)` are the explained variances

SVD avoids squaring the condition number, so it's what scikit-learn's PCA uses. Both routes give the
same answer up to the **sign** of each component, since `v` and `−v` are equally valid eigenvectors.
To make results reproducible, pick a convention, for example "the largest-magnitude entry of each
component is positive".

## Using the components

| Quantity | Formula |
|---|---|
| Scores (projection) | `Z = (X − mean) @ components[:k].T`, shape `(n, k)` |
| Reconstruction | `X̂ = Z @ components[:k] + mean` |
| Explained variance ratio | `λ_i / Σ_all λ = λ_i / trace(C)` |
| Choosing k | smallest k with cumulative ratio ≥ 0.95 (or whatever you need) |

The reconstruction error is exactly the variance you threw away: `||X − X̂||² = (n − 1)·Σ_{i>k} λ_i`.
Transform new data with the **training** mean, not the new data's own mean.

PCA only captures linear structure and is sensitive to feature scale. A column measured in grams will
dominate one measured in kilograms, so standardize features first when their units differ.

In the exercise you'll implement PCA both ways, make the signs deterministic, check that the two agree,
and add projection, reconstruction and a variance-threshold rule for choosing k.
