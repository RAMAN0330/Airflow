# Least Squares by Hand: Normal Equations vs Householder QR

You have more equations than unknowns: 60 noisy measurements and a degree-10 polynomial to fit. There is
no exact solution, so you want the `x` that minimises `‖Ax − b‖²`. The textbook formula solves the
**normal equations** `AᵀA x = Aᵀb`. Numerical analysts reach for **QR** instead. In this exercise you'll
implement both, build Householder QR yourself, and measure why the second one wins.

NumPy only. `np.linalg.solve` (for the normal equations) and `np.linalg.svd` (for the condition number)
are allowed. `np.linalg.qr`, `np.linalg.lstsq` and `np.linalg.pinv` are **not**: the tests replace them
with functions that raise.

## 1. `vandermonde(t, degree)`

Columns `1, t, t², …, t^degree`, shape `(len(t), degree + 1)`.

## 2. `normal_equations(A, b)`

Return `np.linalg.solve(A.T @ A, A.T @ b)`. Raise `ValueError` unless `A` is 2-D with `m >= n >= 1`.

## 3. `householder_qr(A)`: thin QR

Return `Q` of shape `(m, n)` with orthonormal columns and an upper-triangular `R` of shape `(n, n)` with
`Q @ R == A`. For each column `k`:

1. `x = R[k:, k]`. If `‖x‖ == 0`, skip the column (leave a zero on the diagonal).
2. `α = −sign(x[0])·‖x‖` (treat `sign(0)` as `+1`), `v = x − α·e₁`, then normalise `v`.
3. Reflect the trailing block: `R[k:, k:] −= 2·v·(vᵀ R[k:, k:])`.

Build `Q` by applying the stored reflectors, last to first, to the first `n` columns of the identity.
The sign of `α` matters. With the other sign, `x[0] − ‖x‖` cancels whenever `x` already points along
`+e₁`, and you get garbage or NaN. With this sign, `R[k, k] = α`, so the diagonal of `R` can be negative.
Same raising rules as `normal_equations`.

## 4. `back_substitution(R, y)`

Solve `R x = y` for upper-triangular `R`, starting from the **last** row. Raise `ValueError` if `R` is not
square, if `y` has the wrong length, or if any diagonal entry is exactly zero.

## 5. `qr_least_squares(A, b)`

`Q, R = householder_qr(A)`, then `back_substitution(R, Q.T @ b)`. A rank-deficient `A` (for example one
with an all-zero column) ends up as a zero pivot, which raises `ValueError`.

## 6. `projection_matrix(A)`

The orthogonal projector onto the column space of `A`, shape `(m, m)`. Use `Q @ Q.T` from your QR. It must
be symmetric and idempotent (`P @ P == P`), and `P @ b` equals `A @ x̂`, the least-squares fit.

## 7. `condition_number(A)`

`σ_max / σ_min` from the singular values, as a Python `float`. Return `inf` if `σ_min == 0`.

## Example

```python
t = np.linspace(0, 1, 60)
V = vandermonde(t, 10)          # condition number ~2e7
y = V @ np.ones(11)
normal_equations(V, y)          # off by ~1e-2: κ(VᵀV) = κ(V)² ≈ 4e14
qr_least_squares(V, y)          # off by ~1e-9
```

Never modify the input arrays.
