"""Reference solution — never shipped to learners."""
import numpy as np


def relu(x):
    return np.maximum(x, 0.0)


def relu_backward(dout, x):
    return dout * (x > 0)


def gelu(x):
    return 0.5 * x * (1.0 + np.tanh(np.sqrt(2.0 / np.pi) * (x + 0.044715 * x ** 3)))


def softmax(x, axis=-1):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / np.sum(e, axis=axis, keepdims=True)
