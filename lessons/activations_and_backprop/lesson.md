# Non-Linearities and Their Local Gradients

Stack two linear layers and you still have a linear layer: `W₂(W₁x) = (W₂W₁)x`.
Depth only buys expressive power once a **non-linearity** sits between the
layers. This lesson covers the three you'll use constantly, and how gradients
flow back through them.

## Backprop in one sentence

Each layer receives `dout`, the gradient of the loss with respect to its
*output*. It returns the gradient with respect to its *input* by multiplying by
its own **local derivative**:

```
dx = dout · f′(x)         # element-wise for activation functions
```

So every activation needs two things: a forward function and its local
derivative.

## ReLU

```
relu(x)  = max(0, x)
relu′(x) = 1 if x > 0 else 0
```

ReLU is cheap and doesn't saturate for positive inputs, so it is the default
choice. In the backward pass it works as a **gate**: gradient passes through
where the input was positive and is zeroed elsewhere.

```
dx = dout * (x > 0)
```

Units whose input is always negative get zero gradient forever. These are
called "dead ReLUs".

## GELU

GELU is a smooth ReLU that most transformers use. The common tanh approximation
is:

```
gelu(x) = 0.5 · x · (1 + tanh(√(2/π) · (x + 0.044715 · x³)))
```

For large positive `x` it behaves like `x`, and for large negative `x` it goes
to 0. Near zero it dips slightly below 0, which lets small negative signals
through.

## Softmax

Softmax turns a vector of logits into a probability distribution:

```
softmax(x)ᵢ = exp(xᵢ) / Σⱼ exp(xⱼ)
```

### The numerical-stability trick

`exp(1000)` overflows to `inf`, and `inf / inf = nan`. Softmax doesn't change
if you shift every logit by the same constant:

```
softmax(x) = softmax(x − c)
```

Choose `c = max(x)`. The largest exponent becomes `exp(0) = 1`, so nothing can
overflow. Every production implementation does this.

When `x` is a batch, compute the max and the sum **along the softmax axis** with
`keepdims=True`, so they broadcast back against `x`.

## Shapes never change

All three functions are element-wise (softmax normalizes along one axis), so
`output.shape == input.shape`. If your shapes change, something is broadcasting
by accident.
