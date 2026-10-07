# LoRA Adapter from Scratch

Fine-tuning every weight of a 7B-parameter model means storing a full copy of it for every task, plus the
optimizer state for all of those weights. LoRA keeps the pretrained weight `W` **frozen** and learns only
a low-rank update:

```
h = x Wᵀ + (α / r) · x Aᵀ Bᵀ          ΔW = (α / r) · B A
```

| Tensor | Shape | Trainable? | Init |
|---|---|---|---|
| `W` | `(d_out, d_in)` | no | pretrained |
| `A` | `(r, d_in)` | yes | `rng.standard_normal((r, d_in)) / √d_in` |
| `B` | `(d_out, r)` | yes | zeros |
| `x` | `(N, d_in)` | n/a | n/a |

## What to implement (`starter.py`)

1. **`LoRALinear(W, r, alpha, seed=0)`**: store a private float copy of `W` as `self.W`, create `self.A`
   and `self.B` as above with `rng = np.random.default_rng(seed)`, and set `self.scale = alpha / r` and
   `self.merged = False`. Raise `ValueError` if `r <= 0`.
2. **`delta_weight()`**: `scale * B @ A`.
3. **`forward(x)`**: `x @ W.T + scale * (x @ A.T) @ B.T`. Once merged, `W` already holds the update, so
   return just `x @ W.T`.
4. **`backward(x, grad_out)`**: given `dL/dh` of shape `(N, d_out)`, return `{"A": dL/dA, "B": dL/dB}`.
   Nothing for `W`, which is frozen. Raise `RuntimeError` if the layer is merged.
5. **`step(grads, lr)`**: SGD on each parameter named in `grads`: `param -= lr * grad`.
6. **`merge()` / `unmerge()`**: fold `ΔW` into `W` (and take it back out). Calling `merge()` twice must not
   add the update twice.
7. **`n_trainable()`**: number of entries in `A` and `B`.
8. **`param_counts(d_in, d_out, r)`**: `(lora_params, full_params)` for one layer.
9. **`train_lora(layer, X, Y, lr=0.1, steps=200)`**: SGD on `mean((forward(X) − Y)²)`. Return one loss per
   step, measured *before* that step's update.

## Rules

- Never modify the caller's `W`, `X` or `Y`.
- `W` must be bit-for-bit unchanged after any amount of training (while unmerged).
- A freshly built layer must return exactly `x @ W.T`.

## Example

```python
>>> param_counts(4096, 4096, 8)        # one attention projection in a 7B model
(65536, 16777216)                      # 0.39% of the parameters
>>> layer = LoRALinear(W, r=2, alpha=4)
>>> losses = train_lora(layer, X, X @ (W + delta).T, lr=0.1, steps=300)
>>> losses[-1] / losses[0] < 1e-6      # delta has rank 2, so rank 2 is enough
True
```
