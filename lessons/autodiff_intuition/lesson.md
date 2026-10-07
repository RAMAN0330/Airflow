# Automatic Differentiation: The Chain Rule as an Algorithm

Training a network needs `∂loss/∂w` for every weight, often millions of them. There are three ways to
get derivatives on a computer:

| Method | How | Problem |
|---|---|---|
| Symbolic | manipulate formulas, like a CAS | expressions blow up and can't handle loops or `if` |
| Numerical | `(f(x+h) − f(x−h)) / 2h` | one or two evaluations *per input*, plus truncation and rounding error |
| Automatic | apply the chain rule to each elementary operation as the program runs | must store intermediate values; otherwise exact to rounding at a few times the cost of one forward pass |

Automatic differentiation (AD) is what PyTorch, JAX and TensorFlow do.

## The computational graph

Every program that computes a number is a composition of tiny operations. For
`L = tanh(w·x + b)`:

```
w ─┐
   (*) ── n ─┐
x ─┘         (+) ── z ── tanh ── L
b ───────────┘
```

Each node knows its **local derivative**: `∂n/∂w = x`, `∂z/∂n = 1`, `∂L/∂z = 1 − tanh²(z)`. The chain
rule multiplies local derivatives along a path and **sums over paths**:

```
∂L/∂w = ∂L/∂z · ∂z/∂n · ∂n/∂w = (1 − L²) · 1 · x
```

## Forward mode vs reverse mode

Forward mode pushes derivatives from one input towards all outputs, so it costs one pass per input.
**Reverse mode** pulls the gradient of one output back to all inputs in one backward pass. A loss is a
single scalar and there are millions of weights, so ML uses reverse mode. Backpropagation is reverse-mode
AD applied to a neural network.

## Reverse mode, step by step

1. **Forward**: compute every node's value and record its inputs.
2. **Seed**: `L.grad = 1`, because `∂L/∂L = 1`.
3. **Backward**: visit nodes in **reverse topological order**. Each node takes its own finished `grad`
   and adds `local derivative × grad` into each input.

```python
def _backward():                     # for out = self * other
    self.grad  += other.data * out.grad
    other.grad += self.data  * out.grad
```

## Three ways to get it wrong

**Overwriting instead of accumulating.** In `y = x*x + x`, `x` feeds three edges, and the "sum over
paths" means `x.grad` must collect all of them: `2x + 1`. Writing `self.grad = …` keeps only the last
contribution. This bug passes every test that never reuses a variable.

**The wrong order.** A node can only pass its gradient on once *every* consumer has added to it. A
topological sort (each node after its inputs), reversed, guarantees that. Walking breadth-first from the
output looks similar but breaks as soon as a value is used at two different depths, as in a residual
connection.

**Slipped local derivatives.** `d/dx xⁿ = n·xⁿ⁻¹`. Forgetting the factor `n` or the `−1` gives
gradients that are wrong but plausible, so the training loop still runs, just badly.

## Trust, but check

Always compare an AD gradient with a central finite difference on a few random points. With `h ≈ 1e-6`
the two should agree to about 6 significant digits. PyTorch ships the same idea as
`torch.autograd.gradcheck`.

Gradients **accumulate** across `backward()` calls in PyTorch and in your engine. That's useful for
gradient accumulation over micro-batches, and it's why every training step starts with `zero_grad()`.

In the exercise you'll build a micrograd-style `Value` class with arithmetic, `tanh`, `exp`, `relu` and
`log`, a topologically ordered `backward()`, and `zero_grad()`, then train a single neuron with it.
