# Gradient Descent, From the Loss Up

Linear regression is the "hello world" of machine learning because every idea you
need later shows up here in a small form: a **model**, a **loss**, its **gradient**
and an **optimizer** that follows the gradient downhill.

## 1. The model

Given `m` examples with `n` features, stack them into a design matrix `X` of shape
`(m, n)`. A linear model predicts one number per row:

```
ŷ = X w + b          # w: (n,)   b: scalar   ŷ: (m,)
```

Each weight `wⱼ` says how much the prediction moves when feature `j` moves by one.

## 2. The loss

To measure how wrong the model is, average the squared residuals. The extra ½
cancels the 2 that differentiation produces:

```
J(w, b) = (1 / 2m) · Σᵢ (ŷᵢ − yᵢ)²
```

`J` is a bowl-shaped (convex) function of `w` and `b`, so it has a single
global minimum and no local minima for the optimizer to get stuck in.

## 3. The gradient

The gradient points in the direction of steepest *increase* of `J`. Write the
residual as `r = ŷ − y`. Applying the chain rule gives:

```
∂J/∂w = (1/m) · Xᵀ r        # shape (n,): one entry per weight
∂J/∂b = (1/m) · Σᵢ rᵢ        # a scalar: the mean residual
```

`Xᵀ r` is the vectorized form of "for each feature, sum feature × residual over
all examples". This one matrix product replaces a double loop.

## 4. The update

Take a small step **against** the gradient. The learning rate `α` sets the step
size:

```
w ← w − α · ∂J/∂w
b ← b − α · ∂J/∂b
```

Compute both gradients at the *same* point before updating either parameter.

| Learning rate | What you'll see |
|---|---|
| Too small | The cost falls, but painfully slowly |
| About right | The cost drops quickly, then flattens out |
| Too large | The cost oscillates or explodes to `inf` / `nan` |

With a sensible `α`, the cost **never increases** from one step to the next.
That makes it a great debugging signal.

## 5. Ridge regression (L2)

Large weights often mean the model is fitting noise. Ridge regression adds a
penalty on the weights, but not on the bias:

```
J(w, b) = (1 / 2m) · Σᵢ rᵢ² + (λ / 2m) · ‖w‖²
∂J/∂w   = (1/m) · Xᵀ r + (λ/m) · w
```

Increasing `λ` shrinks `‖w‖` towards zero. The bias only shifts predictions up or
down, so penalizing it would just bias your model.

## 6. How to check your gradient

When you're unsure about a derivative, compare it with a **finite difference**:

```
∂J/∂wⱼ ≈ [ J(w + ε·eⱼ) − J(w − ε·eⱼ) ] / 2ε      (ε ≈ 1e-6)
```

The hidden tests for the next exercise do exactly this. Get it passing in your
head first.
