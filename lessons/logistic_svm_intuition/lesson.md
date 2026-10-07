# Linear Classifiers: Logistic Regression & SVMs

Linear regression predicts a number. For classification we keep the same linear score `z = x·w + b`
and change only two things: how the score is read, and how mistakes are charged. Logistic regression reads
`z` as a probability. A support vector machine reads its sign and asks for a safety margin.

## 1. Sigmoid: from score to probability

```
σ(z) = 1 / (1 + e^(−z))          σ(0) = 0.5,   σ(−z) = 1 − σ(z)
```

`z` is the log-odds: `z = log(p / (1 − p))`. The decision boundary `p = 0.5` is where `z = 0`, a
hyperplane. Coded naively, `np.exp(-z)` overflows for `z = −1000`. Branch on the sign so `exp` only ever
sees non-positive numbers:

```python
z >= 0:  1 / (1 + exp(-z))
z <  0:  exp(z) / (1 + exp(z))
```

## 2. Binary cross-entropy

Squared error on probabilities gives a non-convex loss. Instead, maximize the likelihood of the labels,
which is the same as minimizing the **binary cross-entropy**:

```
ℓ(y, p) = −[y·log p + (1 − y)·log(1 − p)]  =  log(1 + e^z) − y·z
```

The right-hand form is the one to code (`np.logaddexp(0, z) - y * z`). It never takes `log(0)`, so a
confidently wrong prediction costs a large *finite* amount instead of `inf`.

The gradient has the same shape as linear regression's. Only `ŷ` changed from `Xw + b` to `σ(Xw + b)`:

```
∂J/∂w = (1/m)·Xᵀ(p − y) + (λ/m)·w        ∂J/∂b = mean(p − y)
```

L2 works exactly as in ridge: it shrinks `w`, and it leaves `b` alone. On perfectly separable data L2 is
not optional. Without it, the loss keeps falling as `‖w‖ → ∞` and the weights never settle.

## 3. Maximum margin

Many hyperplanes can separate two classes. The SVM picks the one with the widest gap. With labels
`y ∈ {−1, +1}`, the **functional margin** of example `i` is `yᵢ(xᵢ·w + b)`. Asking every margin to be at
least 1 and minimizing `‖w‖` maximizes the geometric gap `2/‖w‖`. Real data overlaps, so the soft-margin
SVM charges a **hinge loss** for every example inside the margin:

```
J(w, b) = (λ/2)·‖w‖² + (1/m)·Σ max(0, 1 − yᵢ(xᵢ·w + b))
```

Points with margin ≥ 1 cost nothing and contribute nothing to the gradient. The boundary is determined
by the few points on or inside the margin: the **support vectors**.

## 4. Subgradient descent

The hinge has a kink at margin 1, so use a subgradient. Only *active* examples (margin < 1) count:

```
dw = λ·w − (1/m)·Σ_active yᵢ·xᵢ          db = −(1/m)·Σ_active yᵢ
```

This is the full-batch version of Pegasos (Shalev-Shwartz et al., 2007). Two classic bugs: feeding 0/1
labels (every "0" then has margin 0 whatever `w` is), and using `≤ 1` so points exactly on the margin
keep pushing.

## 5. Kernels

A linear boundary can't separate a ring from its center. Kernels compute inner products in a richer
feature space without building it. The RBF (Gaussian) kernel is the default choice:

```
K(a, b) = exp(−γ·‖a − b‖²)
```

`K(x, x) = 1`, values decay with distance, and γ sets how local each point's influence is. Vectorize
with `‖a − b‖² = ‖a‖² + ‖b‖² − 2a·b` and clip tiny negative rounding errors to 0. A valid kernel matrix
is symmetric and positive semi-definite, and the tests check both.

## In the exercise

You'll implement the stable sigmoid, the cross-entropy loss and its gradient, gradient-descent logistic
regression with L2, the hinge subgradient and a linear SVM trainer, and the RBF kernel matrix.
