"""Activation functions and their gradients.

Fill in each function. Use NumPy only.
"""
import numpy as np


def relu(x):
    """Element-wise max(0, x)."""
    # TODO
    raise NotImplementedError


def relu_backward(dout, x):
    """Gradient of the loss w.r.t. x, given upstream gradient dout = dL/d relu(x)."""
    # TODO: let the gradient through only where x > 0.
    raise NotImplementedError


def gelu(x):
    """GELU, tanh approximation: 0.5 x (1 + tanh(sqrt(2/pi) (x + 0.044715 x^3)))."""
    # TODO
    raise NotImplementedError


def softmax(x, axis=-1):
    """Numerically stable softmax along `axis`."""
    # TODO: shift by the max (keepdims=True), exponentiate, normalize.
    raise NotImplementedError
