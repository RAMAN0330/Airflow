# Least Squares, Projections & Conditioning

Fitting a line through 60 noisy points means solving `Ax = b` with 60 equations and 2 unknowns. There's
no exact solution, so we settle for the `x` that makes `‖Ax − b‖²` as small as possible. Linear
regression, polynomial fits and the last layer of many models all reduce to this one problem.

## Least squares is a projection

`Ax` can only reach vectors in the **column space** of `A`. The closest such vector to `b` is its
orthogonal projection `p = Ax̂`, and the leftover error `e = b − Ax̂` is perpendicular to every column:

```
Aᵀ(b − Ax̂) = 0    ⟹    AᵀA x̂ = Aᵀb        # the normal equations
```

The matrix that does the projecting is `P = A(AᵀA)⁻¹Aᵀ`. Two properties identify any orthogonal
projector, and they make good unit tests:

| Property | Meaning |
|---|---|
| `P² = P` | projecting twice changes nothing |
| `Pᵀ = P` | the error is orthogonal to the subspace |
| `trace(P) = rank(A)` | the dimension of the subspace you project onto |

## Conditioning: how many digits you lose

The **condition number** `κ(A) = σ_max / σ_min` (the ratio of the largest to smallest singular value)
measures how much relative errors in the input can be amplified in the answer. In double precision you
start with about 16 significant digits and can expect to lose roughly `log₁₀ κ` of them.

The normal equations have a hidden cost: `κ(AᵀA) = κ(A)²`. A polynomial-fit matrix with columns
`1, t, t², …, t¹⁰` on `[0, 1]` has `κ ≈ 2·10⁷`, which is fine. `AᵀA` has `κ ≈ 4·10¹⁴`, and the
coefficients you get back are wrong in the second decimal place.

## QR: least squares without squaring κ

Factor `A = QR` with orthonormal columns in `Q` and upper-triangular `R`. Since `Q` preserves lengths,

```
‖Ax − b‖ minimised  ⟺  R x = Qᵀb        # solved by back-substitution, last row first
```

and `κ(R) = κ(A)`, so nothing gets squared. The projector is simply `P = QQᵀ`.

## Householder reflections

Householder QR zeroes one column at a time with a reflection `H = I − 2vvᵀ` that maps the column `x`
onto a multiple of `e₁`:

```
alpha = -np.copysign(np.linalg.norm(x), x[0])   # sign opposite to x[0]
v = x.copy(); v[0] -= alpha; v /= np.linalg.norm(v)
R[k:, k:] -= 2 * np.outer(v, v @ R[k:, k:])
```

Both signs give a valid reflection on paper. In floating point, though, the "natural" choice
`α = +‖x‖` makes `v[0] = x[0] − ‖x‖` subtract two nearly equal numbers whenever `x` already points along
`+e₁`. That **catastrophic cancellation** wipes out the significant digits, or gives `0/0 = NaN` if the
column is already triangular. Picking the opposite sign makes `v[0]` a sum of two same-sign numbers.

Back-substitution has its own trap: the last row of `R` has one unknown, so you must solve from the
bottom up. A top-down loop silently uses unknowns that are still zero.

## Why it matters for ML

Ridge regression, Gauss–Newton steps, Kalman filters and linear probes all solve least-squares problems.
Feature columns that nearly duplicate each other or sit on very different scales give a large `κ`, which
shows up as unstable coefficients. Standardising features lowers `κ`, and a QR- or SVD-based solver
(`np.linalg.lstsq` uses the SVD) keeps the digits you have.

In the exercise you'll write Householder QR and back-substitution by hand, build the projector, compute
`κ` from singular values, and compare QR against the normal equations on an ill-conditioned fit.
