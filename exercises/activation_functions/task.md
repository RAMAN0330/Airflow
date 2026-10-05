# Activation Functions & Their Gradients

Every layer in a network ends in a non-linearity, and every backward pass has
to push gradients through it. Implement the four you will use most, in NumPy
only.

## What to implement (`starter.py`)

| Function | Definition |
|---|---|
| `relu(x)` | `max(0, x)` element-wise |
| `relu_backward(dout, x)` | `dout · 1[x > 0]`, the gradient of the loss w.r.t. `x` |
| `gelu(x)` | `0.5 · x · (1 + tanh(√(2/π) · (x + 0.044715 · x³)))` |
| `softmax(x, axis=-1)` | `exp(xᵢ) / Σⱼ exp(xⱼ)` along `axis`, numerically stable |

All functions must:

- return arrays with the **same shape** as their input;
- **not modify** their inputs;
- work for any number of dimensions.

## Numerical stability

`np.exp(1000.0)` is `inf`, and `inf / inf` is `nan`. Since
`softmax(x) = softmax(x − c)` for any constant `c`, choose `c = max(x)` along
the softmax axis so the largest exponent is `exp(0) = 1`.

## What the hidden tests check

- ReLU and GELU values against known points, plus GELU's asymptotes.
- `relu_backward` gates the upstream gradient by `x > 0`.
- Softmax rows sum to 1, the `axis` argument is respected, inputs like
  `[1000, 1001, 1002]` don't produce `nan`, and adding a constant leaves the
  output unchanged.
