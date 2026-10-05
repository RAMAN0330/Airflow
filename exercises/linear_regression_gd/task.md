# Linear & Ridge Regression with Batch Gradient Descent

Implement linear regression from scratch using only NumPy. No `sklearn`, no
`np.linalg.lstsq` / `np.linalg.solve` / `np.linalg.inv` — the point is to make
gradient descent converge on its own.

## Model

For a design matrix `X` of shape `(m, n)`, weights `w` of shape `(n,)` and a
scalar bias `b`:

```
ŷ = X @ w + b
```

## Cost (MSE with optional L2 penalty)

```
J(w, b) = (1 / 2m) · Σᵢ (ŷᵢ − yᵢ)²  +  (λ / 2m) · ‖w‖²
```

The bias `b` is **not** regularized.

## Gradients

```
∂J/∂w = (1/m) · Xᵀ (ŷ − y) + (λ/m) · w
∂J/∂b = (1/m) · Σᵢ (ŷᵢ − yᵢ)
```

## What to implement (`starter.py`)

| Function | Returns |
|---|---|
| `predict(X, w, b)` | `ŷ`, shape `(m,)` |
| `compute_cost(X, y, w, b, lam=0.0)` | Python `float` |
| `compute_gradients(X, y, w, b, lam=0.0)` | `(dw, db)` — `dw` shape `(n,)`, `db` a `float` |
| `gradient_descent(X, y, lr=0.01, n_iters=1000, lam=0.0)` | `(w, b, cost_history)` |

`gradient_descent` starts from `w = zeros(n)`, `b = 0.0`, performs exactly
`n_iters` simultaneous updates, and appends the cost **after** each update, so
`len(cost_history) == n_iters`.

Your functions must not modify their input arrays.

## What the hidden tests check

1. **Shapes** – `predict`, `compute_gradients` and the returned `w` have the right shapes.
2. **Cost value** – matches the formula above, including the λ term.
3. **Gradient check** – your analytic gradients agree with a finite-difference estimate.
4. **Convergence** – on held-out synthetic data, your weights land within
   tolerance of the closed-form least-squares solution.
5. **Monotonic descent** – with a sensible learning rate, the cost never increases.
6. **Regularization** – increasing λ shrinks `‖w‖`, and leaves `b` unpenalized.
7. **Purity** – inputs are not mutated, and no forbidden solvers are imported.

## Hints

- Write it vectorized: a single `X.T @ residual` replaces the loop over features.
- If `y` arrives as `(m, 1)` and `ŷ` as `(m,)`, `ŷ − y` broadcasts to `(m, m)`.
  This is the most common bug on this exercise.
