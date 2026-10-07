# Convolutional Networks: Filters, Stride, Padding and Pooling

An MLP on a 224×224 RGB image needs 150,528 weights *per hidden unit* and
treats a cat in the top-left corner as unrelated to the same cat in the
bottom-right. Convolutional layers fix both problems with two assumptions:
useful features are **local**, and the same feature detector is useful
**everywhere** (weight sharing).

## One filter, many channels

A filter is a small volume of weights, `(C, KH, KW)`, that spans *all* input
channels. At each position it takes a dot product with the patch underneath
and adds a bias, producing one number. A layer has `F` filters, so the weights
are `(F, C, KH, KW)` and the output has `F` channels:

```
out[n, f, i, j] = b[f] + Σ_c Σ_u Σ_v x[n, c, i + u, j + v] · w[f, c, u, v]
```

Strictly speaking, that is **cross-correlation**. Mathematical convolution
flips the kernel first (`w[f, c, KH−1−u, KW−1−v]`). Since the weights are
learned, the flip doesn't matter for expressiveness, so PyTorch, TensorFlow and
this course all skip it. It *does* matter when you compare against a reference:
a flipped kernel gives different numbers.

## Stride and padding

**Stride** `s` moves the window `s` pixels at a time, downsampling the output.
**Zero padding** `p` adds a border of zeros so the kernel can be centered on
edge pixels. Together they fix the output size:

```
H_out = ⌊(H + 2p − K) / s⌋ + 1
```

| Layer | H | K | s | p | H_out |
|---|---|---|---|---|---|
| "same" 3×3 | 32 | 3 | 1 | 1 | 32 |
| LeNet conv | 28 | 5 | 1 | 0 | 24 |
| ResNet stem | 224 | 7 | 2 | 3 | 112 |
| odd input, stride 2 | 7 | 3 | 2 | 0 | 3 |

The floor is easy to get wrong. `(H − K + 1) / s` is right only when `s = 1`:
for `H = 7, K = 3, s = 2` it gives 2, but positions 0, 2 and 4 all fit.

## Making it fast: im2col

Four nested Python loops are correct and hopelessly slow. The standard trick,
**im2col**, copies every receptive field into a row of a matrix, so the whole
layer becomes one matrix multiply that BLAS runs at full speed:

```
cols = patches.reshape(N * H_out * W_out, C * KH * KW)
out  = cols @ w.reshape(F, -1).T + b        # (N·H_out·W_out, F)
```

It costs memory (each pixel is copied up to `KH·KW` times), but on CPUs and GPUs
it was the workhorse for years. In NumPy, `sliding_window_view` builds the
patches as a view, without copying.

## Max-pooling

Pooling summarizes each `k × k` window, usually with its max, which shrinks the
feature map and adds a little translation invariance. It has no parameters. A
`2×2`, stride-2 pool halves `H` and `W`.

Its backward pass is a **router**. Only the element that won the max affected
the output, so it receives the whole gradient and everything else gets zero:

```
dx[window argmax] += dout[i, j]
```

Use `+=`, not `=`. When `stride < pool size`, windows overlap and the same pixel
can win more than one.

## In the exercise

You'll implement the size formula, padding, a vectorized conv2d and max-pool
forward and backward. The hidden tests compare against naive loop
implementations, including a hand-worked example that catches a flipped kernel.
