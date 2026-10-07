# LoRA: Fine-Tuning Through a Low-Rank Window

Full fine-tuning updates every weight. For a 7B-parameter model that means a new 7B-parameter copy for
every task, plus optimizer state (Adam keeps two extra numbers per weight). **LoRA** (Hu et al., 2021)
gets close to the same quality by training less than 1% of that.

## The bet: updates are low-rank

Pretrained models adapt in a surprisingly small subspace. Aghajanyan et al. found that optimizing about
200 parameters, projected back into the full space, gets RoBERTa to 90% of full fine-tuning
quality on MRPC. LoRA turns that observation into an architecture. Freeze `W` and learn the change
`ΔW` as a product of two thin matrices:

```
W  : (d_out, d_in)   frozen
B  : (d_out, r)      trainable, starts at 0
A  : (r, d_in)       trainable, starts random
ΔW = (α / r) · B A   rank ≤ r, with r ≪ min(d_in, d_out)

h = x Wᵀ + (α / r) · (x Aᵀ) Bᵀ
```

For a 4096 × 4096 projection with `r = 8`: full fine-tuning trains 16.8M numbers, LoRA trains
`8·(4096 + 4096) = 65,536`, about 0.4%. Note the order `(x Aᵀ) Bᵀ`. You never build the full `ΔW`
during training; `x` is squeezed through an `r`-dimensional bottleneck.

## Why B starts at zero

With `B = 0`, `ΔW = 0`, so the adapted model starts out **exactly** equal to the pretrained one. Training
begins from known-good behaviour instead of a randomly perturbed model. `A` must *not* be zero as well,
though. The gradient of `B` is proportional to `x Aᵀ`, so if both start at zero, both gradients are zero
and nothing ever learns.

## Why α / r

`α` is a fixed scale. Dividing by `r` means that changing the rank doesn't change the size of the
update, so you can try `r = 4, 8, 16` without retuning the learning rate. Forgetting it, or applying it
twice, scales every update by the wrong factor.

## Gradients by hand

Let `G = ∂L/∂h` (shape `(N, d_out)`) and `u = x Aᵀ` (shape `(N, r)`). Then

```
∂L/∂B = (α/r) · Gᵀ u               (d_out, r)
∂L/∂A = (α/r) · (G B)ᵀ x           (r, d_in)
∂L/∂W = nothing: it's frozen
```

The memory savings come from that last line. No gradient and no Adam state exist for `W`. In PyTorch
you set `requires_grad=False`. In the exercise, `backward` simply never returns one, and a test checks
that `W` is bit-for-bit unchanged after training.

## Merge for free inference

After training, fold the update in: `W' = W + (α/r) B A`. The layer is a plain linear layer again, with
**no extra inference latency**. Adapter layers (Houlsby et al., 2019) can't do this, because they add
sequential computation. Unmerge (`W' − ΔW`) to swap in a different task's adapter. Each adapter is only a
few megabytes, so one base model can serve many tasks.

## Where it goes next

QLoRA keeps the frozen `W` in 4-bit precision and trains LoRA adapters on top, which brings a 65B model
within reach of a single 48 GB GPU. The `B A` structure is the same one you'll build.

## In the exercise

You'll build `LoRALinear` with the init, forward, hand-written backward, SGD step, `merge`/`unmerge` and
parameter counting, then train it to recover a rank-2 change to a frozen layer.
