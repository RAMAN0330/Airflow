# Conv2D and Max-Pooling from Scratch

A convolutional layer slides a small stack of filters over an image and takes a
dot product at every position. Implement it, with stride and padding, plus
max-pooling, in NumPy only. The hidden tests compare you against naive
four-nested-loop references, so correctness is easy to check; your version must
also be fast.

## Convention: cross-correlation, like PyTorch

Deep-learning libraries call it "convolution", but they **do not flip the
kernel**. For input `x` of shape `(N, C, H, W)`, weights `w` of shape
`(F, C, KH, KW)` and bias `b` of shape `(F,)`:

```
out[n, f, i, j] = b[f] + Σ_c Σ_u Σ_v  xp[n, c, i·s + u, j·s + v] · w[f, c, u, v]
```

where `xp` is `x` zero-padded by `pad` on all four spatial sides and `s` is the stride.

## Output size

```
H_out = ⌊(H + 2·pad − KH) / stride⌋ + 1
```

and the same for the width. For example, `H = 7, K = 3, stride = 2, pad = 0` gives `⌊4/2⌋ + 1 = 3`.

## What to implement (`starter.py`)

1. **`conv_output_size(in_size, kernel, stride=1, pad=0)`**: the formula above, as an `int`.
   Raise `ValueError` if `kernel > in_size + 2·pad`.
2. **`pad_input(x, pad)`**: zero-pad only the `H` and `W` axes, giving `(N, C, H + 2p, W + 2p)`.
3. **`conv2d_forward(x, w, b, stride=1, pad=0)`** returns `(N, F, H_out, W_out)`.
   - Raise `ValueError` if `x.shape[1] != w.shape[1]`.
   - It must run an `(8, 16, 32, 32)` input with 32 filters of `3×3` (pad 1) in well under
     2 seconds. Loop over output positions at most, never over `N`, `F` or `C`.
4. **`maxpool2d_forward(x, pool_size=2, stride=None)`**: max over each
   `pool_size × pool_size` window. `stride` defaults to `pool_size`, with no padding.
5. **`maxpool2d_backward(dout, x, pool_size=2, stride=None)`**: send each
   `dout[n, c, i, j]` to the location of the max in its window (the first one, on
   ties). When `stride < pool_size`, windows overlap and one input can win
   several windows, so **accumulate**.

Don't modify any input array.

## im2col in one paragraph

Gather every receptive field into a row: `cols` has shape
`(N·H_out·W_out, C·KH·KW)`. Then the whole convolution is one matmul,
`cols @ w.reshape(F, −1).T + b`, followed by reshaping to `(N, H_out, W_out, F)`
and transposing to `(N, F, H_out, W_out)`.
`numpy.lib.stride_tricks.sliding_window_view(xp, (KH, KW), axis=(2, 3))[:, :, ::s, ::s]`
gives you every window without copying.

## What the hidden tests check

- The output-size formula on known layer configurations (LeNet, ResNet stem, stride 2 and 3).
- Padding values and shape.
- A hand-computed example that tells cross-correlation apart from flipped convolution.
- Matching the naive reference for several `(stride, pad)` combinations on non-square inputs.
- Speed, the channel-mismatch error, and max-pool forward and backward, including
  a numerical-gradient check with overlapping windows.
