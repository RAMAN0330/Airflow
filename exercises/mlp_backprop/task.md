# Backprop Through a Two-Layer MLP

In the activation-functions exercise you wrote one local gradient at a time.
Now chain them. Build a small network out of layers that each know how to run
**forward** (and cache what they need) and **backward** (turn `dout` into
gradients for their inputs and parameters). Then train it. NumPy only.

## Shapes

| Tensor | Shape |
|---|---|
| `x` | `(N, D)`, one row per example |
| `W`, `b` | `(D, M)`, `(M,)` |
| `out = x @ W + b` | `(N, M)` |
| `logits` | `(N, C)` |
| `y` | `(N,)` integer class labels |

A gradient always has the same shape as the thing it's the gradient of.

## What to implement (`starter.py`)

1. **`linear_forward(x, W, b)`** returns `(out, cache)`.
2. **`linear_backward(dout, cache)`** returns `(dx, dW, db)`:
   ```
   dx = dout @ Wᵀ      (N, D)
   dW = xᵀ @ dout      (D, M)
   db = Σₙ dout[n]     (M,)   summed over the batch
   ```
3. **`relu_forward(x)`** returns `(out, cache)`, and **`relu_backward(dout, cache)`** returns `dx = dout · 1[x > 0]`.
4. **`softmax_cross_entropy(logits, y)`** returns `(loss, dlogits)`:
   - `loss = −(1/N) Σₙ log softmax(logits[n])[y[n]]`, a float.
   - `dlogits = (softmax(logits) − onehot(y)) / N`.
   - Must stay finite for logits like `±1000`: compute the log-softmax after subtracting each row's max.
5. **`TwoLayerMLP(input_dim, hidden_dim, num_classes, seed=0)`**:
   - `self.params` is a dict with `"W1"` `(D, H)`, `"b1"` `(H,)`, `"W2"` `(H, C)`, `"b2"` `(C,)`.
     Create one `rng = np.random.default_rng(seed)` and draw `W1`, then `W2`, as
     `rng.standard_normal(shape) * sqrt(2 / fan_in)` (He initialization). Biases start at zero.
   - `forward(x)` returns logits for `Linear → ReLU → Linear`.
   - `loss_and_grads(x, y)` returns `(loss, grads)`, where `grads` has the same keys and shapes as `params`.
   - `sgd_step(grads, lr)` updates every parameter: `p -= lr * grad`.

Don't modify the arrays passed into the layer functions.

## Example

```python
loss, d = softmax_cross_entropy(np.zeros((4, 5)), np.array([0, 1, 2, 3]))
loss            # log(5) ≈ 1.609
d[0]            # [-0.2, 0.05, 0.05, 0.05, 0.05]   ((0.2 − 1) / 4, then 0.2 / 4)
```

## What the hidden tests check

- Every gradient (`dx`, `dW`, `db`, `dlogits` and all four MLP parameter
  gradients) matches a **central-difference numerical gradient**,
  `(f(θ + h) − f(θ − h)) / 2h`.
- Gradient shapes match parameter shapes.
- The loss is correct on known values and finite for huge logits.
- The MLP is deterministic per seed, and 150 full-batch SGD steps on three
  Gaussian blobs cut the loss by at least 4× and reach > 95% accuracy.
