"""A micrograd-style scalar autograd engine: a computational graph of Values with reverse-mode backward()."""
import math


class Value:
    """A scalar that remembers how it was computed, so gradients can flow back through it."""

    def __init__(self, data, _children=(), _op=""):
        self.data = float(data)
        self.grad = 0.0
        self._backward = lambda: None
        self._prev = tuple(_children)
        self._op = _op

    def __repr__(self):
        return f"Value(data={self.data}, grad={self.grad})"

    @staticmethod
    def _wrap(other):
        return other if isinstance(other, Value) else Value(other)

    def __add__(self, other):
        other = self._wrap(other)
        out = Value(self.data + other.data, (self, other), "+")

        def _backward():
            self.grad += out.grad
            other.grad += out.grad
        out._backward = _backward
        return out

    def __mul__(self, other):
        other = self._wrap(other)
        out = Value(self.data * other.data, (self, other), "*")

        def _backward():
            self.grad += other.data * out.grad
            other.grad += self.data * out.grad
        out._backward = _backward
        return out

    def __pow__(self, exponent):
        if not isinstance(exponent, (int, float)):
            raise TypeError("only int/float exponents are supported")
        out = Value(self.data ** exponent, (self,), f"**{exponent}")

        def _backward():
            self.grad += exponent * self.data ** (exponent - 1) * out.grad
        out._backward = _backward
        return out

    def __neg__(self):
        return self * -1

    def __sub__(self, other):
        return self + (-self._wrap(other))

    def __truediv__(self, other):
        return self * self._wrap(other) ** -1

    def __radd__(self, other):
        return self + other

    def __rmul__(self, other):
        return self * other

    def __rsub__(self, other):
        return self._wrap(other) - self

    def __rtruediv__(self, other):
        return self._wrap(other) / self

    def tanh(self):
        t = math.tanh(self.data)
        out = Value(t, (self,), "tanh")

        def _backward():
            self.grad += (1.0 - t * t) * out.grad
        out._backward = _backward
        return out

    def exp(self):
        e = math.exp(self.data)
        out = Value(e, (self,), "exp")

        def _backward():
            self.grad += e * out.grad
        out._backward = _backward
        return out

    def relu(self):
        out = Value(self.data if self.data > 0 else 0.0, (self,), "relu")

        def _backward():
            self.grad += (1.0 if self.data > 0 else 0.0) * out.grad
        out._backward = _backward
        return out

    def log(self):
        if self.data <= 0:
            raise ValueError("log is only defined for positive values")
        out = Value(math.log(self.data), (self,), "log")

        def _backward():
            self.grad += out.grad / self.data
        out._backward = _backward
        return out

    def _topo(self):
        """Every node reachable from self, each one after all of its inputs (iterative DFS)."""
        order, seen, stack = [], set(), [(self, False)]
        while stack:
            node, expanded = stack.pop()
            if expanded:
                order.append(node)
                continue
            if id(node) in seen:
                continue
            seen.add(id(node))
            stack.append((node, True))
            for child in node._prev:
                if id(child) not in seen:
                    stack.append((child, False))
        return order

    def backward(self):
        """Seed d(self)/d(self) = 1 and apply each node's local chain rule in reverse topological order."""
        topo = self._topo()
        self.grad = 1.0
        for node in reversed(topo):
            node._backward()

    def zero_grad(self):
        """Reset .grad to 0 on every node in the graph that produced self."""
        for node in self._topo():
            node.grad = 0.0
