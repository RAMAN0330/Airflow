# Optimizers from Scratch: Momentum, Adam & AdamW

`torch.optim.AdamW(model.parameters(), lr=3e-4)` is one line in every training script. Underneath it are a
handful of running averages and a few easily-missed details: bias correction, where weight decay goes, and
which step the warmup starts on. You'll build the whole family in NumPy and check each against
hand-computed numbers.

## The interface

Every optimizer is a class whose `step(params, grads)` takes two equal-length lists of NumPy arrays:

- update each `params[i]` **in place** (`p -= ...`), so the caller's arrays change
- never modify `grads`
- keep per-parameter state (velocities, moment estimates) between calls, created as zeros on the first step
- read `self.lr` on every step, so a schedule can change it between calls
- raise `ValueError` if the lists have different lengths or a param and its grad differ in shape

## 1. `SGD(lr=0.01, momentum=0.0, nesterov=False, weight_decay=0.0)`

```
g = g + weight_decay · p          # L2 penalty
v = μ · v + g                     # only if momentum > 0
p -= lr · v                       # heavy-ball momentum
p -= lr · (g + μ · v)             # Nesterov (instead of the line above)
p -= lr · g                       # momentum == 0
```

## 2. `RMSProp(lr=0.01, alpha=0.99, eps=1e-8)`

```
s = α · s + (1 − α) · g²
p -= lr · g / (√s + eps)
```

## 3. `Adam(lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=0.0)`

With a step counter `t` that starts at 1 and increases once per `step()` call:

```
g = g + weight_decay · p          # Adam's weight decay is an L2 term
m = β₁ · m + (1 − β₁) · g
v = β₂ · v + (1 − β₂) · g²
m̂ = m / (1 − β₁ᵗ),   v̂ = v / (1 − β₂ᵗ)
p -= lr · m̂ / (√v̂ + eps)
```

Without the bias correction the first steps are far too small or too large, because `m` and `v` start at 0.

## 4. `AdamW(lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=1e-2)`

Same as Adam on the **raw** gradient, plus **decoupled** decay applied directly to the weights:

```
p -= lr · weight_decay · p        # then the Adam update, with g untouched
```

With a zero gradient, AdamW shrinks every weight by exactly `(1 − lr·wd)` per step.

## 5. `cosine_warmup_lr(step, base_lr, warmup_steps, total_steps, min_lr=0.0)`

Steps count from 0.

| step | learning rate |
|---|---|
| `step < warmup_steps` | `base_lr · step / warmup_steps` |
| `warmup_steps <= step < total_steps` | `min_lr + ½(base_lr − min_lr)(1 + cos(π · progress))`, `progress = (step − warmup_steps) / (total_steps − warmup_steps)` |
| `step >= total_steps` | `min_lr` |

Raise `ValueError` for a negative `step` or `warmup_steps`, or `total_steps < warmup_steps`.

```python
[cosine_warmup_lr(s, 1.0, 4, 12) for s in (0, 1, 4, 8, 12)]   # [0.0, 0.25, 1.0, 0.5, 0.0]
```

## Example

```python
p = np.array([0.0])
opt = Adam(lr=0.1)
opt.step([p], [np.array([1.0])])     # p == [-0.1]: the first Adam step is lr·sign(g)
```
