# Build a Tiny Autograd Engine

PyTorch's `loss.backward()` feels like magic. It isn't: every operation records its inputs and how to
differentiate itself, and `backward()` replays those local rules in reverse. You'll build the whole
thing for scalars in about 100 lines, in the style of Andrej Karpathy's *micrograd*. Pure Python
(`math` is fine).

## The `Value` class

A `Value` wraps a float and remembers how it was made:

| Attribute | Meaning |
|---|---|
| `data` | the float result of the forward computation |
| `grad` | `∂(output)/∂(this node)`, filled in by `backward()`, starts at `0.0` |
| `_prev` | the input `Value`s this node was computed from |
| `_backward` | a closure that pushes `out.grad` into the inputs' `.grad` (the local chain rule) |

The constructor is given in the starter.

## 1. Operators

Implement `+ - * /`, unary `-`, and `**` with a constant `int`/`float` exponent. Each returns a **new**
`Value` and sets its `_backward`. Python numbers must work on either side (`a + 1`, `1 - a`, `2 / a`), so
also implement `__radd__`, `__rsub__`, `__rmul__` and `__rtruediv__`. `x ** Value(...)` raises `TypeError`.

```python
def __mul__(self, other):
    other = other if isinstance(other, Value) else Value(other)
    out = Value(self.data * other.data, (self, other), "*")
    def _backward():
        self.grad += other.data * out.grad
        other.grad += self.data * out.grad
    out._backward = _backward
    return out
```

Note the `+=`. A node used twice (`x * x`, or a residual connection) gets gradient from **both** uses.

## 2. Functions

`tanh()`, `exp()`, `relu()` and `log()` (natural log; `ValueError` if `data <= 0`). Local derivatives:
`1 − tanh²`, `eˣ`, `1[x > 0]` and `1/x`.

## 3. `backward()`

1. Collect every node reachable from `self` in **topological order** (each node after all its inputs).
2. Set `self.grad = 1.0`.
3. Call `_backward()` on each node in **reverse** topological order.

Reverse topological order guarantees that a node's gradient is complete before it's passed on.

## 4. `zero_grad()`

Set `grad = 0.0` on every node in the graph behind `self`. Gradients accumulate across `backward()` calls
(just like PyTorch), so a training loop zeroes them every step.

## Example

```python
x = Value(3.0)
y = x * x + x        # 12
y.backward()
x.grad               # 7.0  (= 2x + 1)
```

The tests check every gradient against central finite differences `(f(x+h) − f(x−h)) / 2h` and train a
one-neuron classifier `tanh(w·x + b)` with plain gradient descent.
