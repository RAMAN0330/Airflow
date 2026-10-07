# Optimizers: Momentum, Adam & Learning-Rate Schedules

Plain gradient descent, `p -= lr·g`, has one knob and one weakness. On a loss surface that is steep in
one direction and flat in another, a learning rate small enough to stay stable on the steep axis crawls
along the flat one. Every modern optimizer is a fix for that, plus some bookkeeping.

## Momentum: average the direction

Keep a running velocity and step along it:

```
v = μ·v + g          # μ ≈ 0.9
p -= lr·v
```

Across the steep valley the gradient flips sign each step and the oscillations cancel out in `v`. Along
the valley floor it points the same way every time, so `v` builds up to about `g / (1 − μ)`, ten times
larger for `μ = 0.9`. **Nesterov** momentum uses `g + μ·v` as the step, a look-ahead that damps
overshooting.

## RMSProp and Adam: scale each coordinate

Momentum fixes the direction. Adaptive methods fix the **scale** of each coordinate by dividing by a
running root-mean-square of its gradients:

```
m = β₁·m + (1 − β₁)·g          # first moment  (momentum),  β₁ = 0.9
v = β₂·v + (1 − β₂)·g²         # second moment (RMSProp),   β₂ = 0.999
m̂ = m / (1 − β₁ᵗ)              # bias correction, t = 1, 2, …
v̂ = v / (1 − β₂ᵗ)
p -= lr · m̂ / (√v̂ + ε)
```

**Bias correction** matters because `m` and `v` start at zero. After one step `m = 0.1·g` and
`v = 0.001·g²`, so without correction the step is `0.1/√0.001 ≈ 3.2×` too big, and the bias in `v`
takes thousands of steps to wash out. With correction the first step is exactly `lr·sign(g)`, whatever
the gradient's scale. That scale-invariance is why one Adam learning rate works across very different
layers.

## Weight decay: L2 is not the same as decay

For SGD, adding `λ·p` to the gradient (an L2 penalty) and shrinking the weights directly are the same
thing. For Adam they're not. If the penalty goes into `g` it then gets divided by `√v̂`, so weights with
large gradients are barely regularised. Loshchilov & Hutter's **AdamW** decouples the two:

```
p -= lr·λ·p                    # decay the weights directly
# ...then the Adam update on the raw gradient
```

PyTorch's `Adam(weight_decay=…)` is the L2 version and `AdamW` is the decoupled one. Mixing them up
changes how strong your regularisation is by orders of magnitude.

## Learning-rate schedules

Two ideas dominate transformer training:

- **Linear warmup.** Early on, Adam's `v̂` is estimated from very few gradients and the weights are
  random, so big steps are risky. Ramp the rate from 0 to `base_lr` over the first few hundred or
  thousand steps.
- **Cosine decay** (from SGDR). Then glide down `lr = min + ½(base − min)(1 + cos(π·progress))`: slow at
  first, fastest in the middle, gentle at the end.

Off-by-one errors live at the boundaries. Decide whether step 0 has rate 0, and make sure the cosine
starts at exactly `base_lr` when warmup ends and reaches `min_lr` at `total_steps`.

## In code

Real optimizers keep **state per parameter** (velocity, moments, a step counter), update parameter
arrays **in place**, and never touch the gradient arrays you pass in. In the exercise you'll implement
SGD (with momentum and Nesterov), RMSProp, Adam, AdamW and a warmup-plus-cosine schedule that way, then
check them against hand-computed steps, an ill-conditioned quadratic and the Rosenbrock function.
