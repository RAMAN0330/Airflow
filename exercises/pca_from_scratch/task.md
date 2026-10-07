# PCA from Scratch: Eigendecomposition and SVD

A dataset with dozens of correlated features usually has far fewer real directions of variation. PCA
finds them: orthogonal axes ordered by how much variance they capture. You'll compute it two ways, from
the covariance matrix and from the SVD of the data, and check that they agree exactly, signs included.
NumPy only (`np.linalg.eigh` and `np.linalg.svd` are allowed).

## 1. `center(X)` and `covariance_matrix(X)`

- `center(X)` returns `(X − mean, mean)` with `mean` of shape `(d,)`.
- `covariance_matrix(X)` returns the `(d, d)` **sample** covariance: `Xc.T @ Xc / (n − 1)`. It must match
  `np.cov(X, rowvar=False)`. Raise `ValueError` if `n < 2`.

## 2. `flip_signs(components)`

An eigenvector `v` and `−v` are equally valid, so different solvers return different signs. Fix the
convention: multiply each **row** by the sign of its largest-magnitude entry, so that entry is positive.
Return a new array.

## 3. `pca_eigh(X, n_components=None)`

1. Eigendecompose the covariance with `np.linalg.eigh`, which returns eigenvalues in **ascending**
   order with eigenvectors in the **columns**.
2. Sort largest first, turn eigenvectors into rows and keep the first `k` (`None` means all `d`).
3. Apply `flip_signs`.

Return `(components, explained_variance)` with shapes `(k, d)` and `(k,)`. Raise `ValueError` unless
`1 <= k <= d`.

## 4. `pca_svd(X, n_components=None)`

Same outputs, computed from the thin SVD of the **centered** data:

```
Xc = U S Vᵀ   →   components = rows of Vᵀ,   explained_variance = S² / (n − 1)
```

Apply the same sign flip. `pca_svd` and `pca_eigh` must agree to about 1e-8. Here `k` can be at most
`min(n, d)`.

## 5. `PCA(n_components=None)`

| Member | Meaning |
|---|---|
| `fit(X)` | learns the attributes below (use `pca_svd`) and returns `self` |
| `mean_` | column means of the training data |
| `components_`, `explained_variance_` | as above |
| `explained_variance_ratio_` | each variance divided by the **total** variance (trace of the covariance), so it sums to 1 only when all components are kept |
| `transform(X)` | `(X − mean_) @ components_.T`, shape `(n, k)` |
| `inverse_transform(Z)` | `Z @ components_ + mean_`, shape `(n, d)` |

With all components kept, `inverse_transform(transform(X))` gives back `X`.

## 6. `choose_k(explained_variance_ratio, threshold)`

Return the smallest `k` whose cumulative ratio reaches `threshold`:

```python
choose_k([0.5, 0.3, 0.2], 0.8)   # 2
choose_k([0.5, 0.3, 0.2], 0.81)  # 3
```

Raise `ValueError` unless `0 < threshold <= 1`.

Never modify the input arrays.
