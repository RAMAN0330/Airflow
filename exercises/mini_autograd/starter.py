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

    def __add__(self, other):
        raise NotImplementedError

    def __mul__(self, other):
        raise NotImplementedError

    def __pow__(self, exponent):
        """exponent is an int or float (not a Value). TypeError otherwise."""
        raise NotImplementedError

    def __neg__(self):
        raise NotImplementedError

    def __sub__(self, other):
        raise NotImplementedError

    def __truediv__(self, other):
        raise NotImplementedError

    def __radd__(self, other):
        raise NotImplementedError

    def __rmul__(self, other):
        raise NotImplementedError

    def __rsub__(self, other):
        raise NotImplementedError

    def __rtruediv__(self, other):
        raise NotImplementedError

    def tanh(self):
        raise NotImplementedError

    def exp(self):
        raise NotImplementedError

    def relu(self):
        raise NotImplementedError

    def log(self):
        """Natural log. ValueError for data <= 0."""
        raise NotImplementedError

    def backward(self):
        """Seed self.grad = 1 and run every node's _backward in reverse topological order."""
        raise NotImplementedError

    def zero_grad(self):
        """Reset .grad to 0 on every node in the graph that produced self."""
        raise NotImplementedError
