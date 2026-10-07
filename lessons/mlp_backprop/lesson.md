# Backpropagation Through a Multilayer Perceptron

The previous lesson gave you one local gradient per activation. A network is a
chain of such functions, and backpropagation is the bookkeeping that multiplies
their local derivatives together in the right order. This lesson walks through
a two-layer MLP: forward, loss, backward, update.

## The forward pass is a recipe you replay backwards

```
z1 = x @ W1 + b1        # (N, H)
h  = relu(z1)           # (N, H)
s  = h @ W2 + b2        # (N, C) logits
L  = cross_entropy(s, y)
```

Each line is a layer that does two jobs. **Forward**, it computes its output
and **caches** whatever it will need later (`x` and `W` for a linear layer,
the input for ReLU). **Backward**, it receives `dout = ∂L/∂out` and returns
gradients for its inputs and parameters.

## Jacobians, without building them

For a vector function `y = f(x)`, the Jacobian `∂y/∂x` holds every partial
derivative. The chain rule says `∂L/∂x = (∂y/∂x)ᵀ ∂L/∂y`. For a linear layer
with a batch, that Jacobian would be enormous, `(N·M) × (N·D)`, and mostly
zeros. You never build it. You write the product directly:

```
dx = dout @ W.T          # (N, M) @ (M, D) -> (N, D)
dW = x.T @ dout          # (D, N) @ (N, M) -> (D, M)
db = dout.sum(axis=0)    # (M,)  the same b was added to every row
```

The shapes double-check your work: **a gradient has the shape of the thing it
differentiates**. If `dW` comes out `(M, D)`, a transpose is on the wrong
operand. If `db` comes out `(N, M)`, you forgot that the bias is shared across
the batch, so its gradients must be summed.

## Softmax and cross-entropy, fused

Computing softmax, then log, then the loss separately is both unstable and
wasteful. Fused, the gradient is remarkably simple:

```
log_p   = z - log Σ exp(z)          # after subtracting the row max
L       = -mean(log_p[n, y[n]])
dlogits = (softmax(z) - onehot(y)) / N
```

The `/ N` is there because the loss is a **mean** over the batch. Drop it and
your gradients scale with batch size: the same learning rate that works for 32
examples blows up at 512.

## Chaining it: the backward pass

```
ds          = (p - onehot) / N
dh, dW2, db2 = linear_backward(ds, cache2)
dz1         = dh * (z1 > 0)
_,  dW1, db1 = linear_backward(dz1, cache1)
```

Gradients flow in reverse order of the forward pass. Each layer only needs its
own cache and the incoming `dout`. That locality is why frameworks can
differentiate arbitrary graphs.

## Trust, but verify: numerical gradient checking

Backprop bugs rarely crash. They silently train worse. Check every analytic
gradient against a **central difference**:

```
∂L/∂θᵢ ≈ (L(θ + h·eᵢ) − L(θ − h·eᵢ)) / 2h        h ≈ 1e-5 … 1e-6
```

Its error is O(h²), versus O(h) for the one-sided version. Use float64, compare
with a *relative* error, and expect values around 1e-7 or smaller when you're
right. Gradient checks are slow (two forward passes per parameter), so run them
on tiny networks, then switch them off.

## In the exercise

You'll implement each layer, the fused loss, and a `TwoLayerMLP` with He
initialization (`std = √(2 / fan_in)`, suited to ReLU). The hidden tests check
every gradient numerically, then train on three Gaussian blobs and expect the
loss to fall at least 4×.
