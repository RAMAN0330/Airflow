# Logistic Regression & Linear SVM from Scratch

Linear regression predicts a number. Now predict a **class**. You'll build the two classic linear
classifiers with NumPy only: logistic regression, which outputs probabilities, and the linear support
vector machine, which maximizes the margin. Then you'll write the RBF kernel that lets an SVM bend its
decision boundary. No `sklearn`, `scipy` or `torch`.

## 1. `sigmoid(z)`: numerically stable

```
σ(z) = 1 / (1 + e^(−z))
```

The textbook formula overflows: `np.exp(1000)` is `inf` and NumPy warns. Branch on the sign so `np.exp`
only ever sees numbers `≤ 0`:

```
z ≥ 0:  1 / (1 + e^(−z))
z < 0:  e^z / (1 + e^z)
```

Accept a scalar or an array. Return a Python `float` for scalar input, an array of the same shape otherwise.
The tests turn every NumPy warning into an error, so `sigmoid(-1000.0)` must return `0.0` quietly.

## 2. Logistic regression (labels `y ∈ {0, 1}`)

| Function | Returns |
|---|---|
| `predict_proba(X, w, b)` | `σ(X @ w + b)`, shape `(m,)` |
| `bce_loss(X, y, w, b, lam=0.0)` | mean binary cross-entropy `+ (λ/2m)·‖w‖²`, as a `float` |
| `bce_gradients(X, y, w, b, lam=0.0)` | `(dw, db)`: `dw` shape `(n,)`, `db` a `float` |
| `fit_logistic(X, y, lr=0.1, n_iters=1000, lam=0.0)` | `(w, b)` |

With `z = x·w + b` and `p = σ(z)`, the per-example cross-entropy simplifies to

```
−[y·log p + (1 − y)·log(1 − p)]  =  log(1 + e^z) − y·z
```

Compute `log(1 + e^z)` with `np.logaddexp(0, z)`. It stays exact and finite even when the model is
confidently wrong, unlike `log(p)` with a clipped `p`. The gradients have the same form as linear regression:

```
∂J/∂w = (1/m)·Xᵀ(p − y) + (λ/m)·w
∂J/∂b = (1/m)·Σ (pᵢ − yᵢ)          # the bias is not regularized
```

`fit_logistic` starts at `w = zeros(n)`, `b = 0.0` and performs exactly `n_iters` simultaneous batch updates.

## 3. Linear SVM (labels `y ∈ {−1, +1}`)

The soft-margin SVM objective in its primal, "regularized hinge loss" form:

```
J(w, b) = (λ/2)·‖w‖² + (1/m)·Σ max(0, 1 − yᵢ(xᵢ·w + b))
```

The hinge has a kink at margin 1, so use a **subgradient**. An example is *active* when
`yᵢ(xᵢ·w + b) < 1` (strictly; at exactly 1, use the zero subgradient):

```
dw = λ·w − (1/m)·Σ_active yᵢ·xᵢ
db =      − (1/m)·Σ_active yᵢ
```

| Function | Returns |
|---|---|
| `svm_subgradient(X, y, w, b, lam=0.01)` | `(dw, db)` |
| `fit_linear_svm(X, y, lr=0.1, n_iters=1000, lam=0.01)` | `(w, b)` after `n_iters` full-batch steps from zeros with a fixed `lr` |

`fit_linear_svm` raises `ValueError` if any label is not `−1` or `+1`. (Passing 0/1 labels is a classic bug:
every "0" example then has margin 0 regardless of `w`.)

## 4. `rbf_kernel(A, B, gamma=1.0)`

```
K[i, j] = exp(−γ · ‖A[i] − B[j]‖²)          shape (len(A), len(B))
```

No Python loops. Expand `‖a − b‖² = ‖a‖² + ‖b‖² − 2·a·b` and broadcast, then clip tiny negative values
caused by rounding to 0 before exponentiating.

## Example

```python
>>> sigmoid(0.0)
0.5
>>> X = np.array([[1.0], [-1.0]]); y = np.array([0.0, 1.0])
>>> bce_loss(X, y, np.array([50.0]), 0.0)      # confidently wrong on both
50.0
>>> rbf_kernel(np.zeros((1, 2)), np.array([[1.0, 1.0]]), gamma=0.5)
array([[0.36787944]])                           # exp(-0.5 * 2)
```

## What the hidden tests check

1. **Sigmoid**: correct values, symmetry `σ(−z) = 1 − σ(z)`, and no overflow warnings at `z = ±1000`.
2. **Loss**: matches the formula, including λ and a confidently wrong prediction.
3. **Gradients**: agree with finite differences, and λ never touches `db`.
4. **Training**: `fit_logistic` matches a reference batch descent; the SVM separates two blobs.
5. **Subgradient**: only margins strictly below 1 count.
6. **Kernel**: matches a loop reference; `K(A, A)` is symmetric, has ones on the diagonal and is PSD.
7. **Purity**: inputs are not mutated and only NumPy is used.
