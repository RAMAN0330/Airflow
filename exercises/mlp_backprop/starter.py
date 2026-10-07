"""Backprop by hand: linear and ReLU layers, softmax cross-entropy and a 2-layer MLP trained with SGD. NumPy only."""
import numpy as np


def linear_forward(x, W, b):
    """x: (N, D), W: (D, M), b: (M,). Return (out, cache) with out = x @ W + b of shape (N, M)."""
    # TODO: compute out and keep whatever the backward pass needs in cache.
    raise NotImplementedError


def linear_backward(dout, cache):
    """dout: (N, M) = dL/dout. Return (dx, dW, db) with the shapes of x, W and b."""
    # TODO: dx = dout @ Wᵀ, dW = xᵀ @ dout, db = dout summed over the batch.
    raise NotImplementedError


def relu_forward(x):
    """Return (out, cache) with out = max(0, x)."""
    # TODO
    raise NotImplementedError


def relu_backward(dout, cache):
    """Return dx: let dout through only where the forward input was > 0."""
    # TODO
    raise NotImplementedError


def softmax_cross_entropy(logits, y):
    """logits: (N, C), y: (N,) integer labels.

    Return (loss, dlogits): loss is the mean cross-entropy over the batch (a float),
    dlogits = dL/dlogits with shape (N, C). Must be numerically stable.
    """
    # TODO: stable log-softmax, mean negative log-likelihood, gradient (softmax - onehot) / N.
    raise NotImplementedError


class TwoLayerMLP:
    """input -> Linear(W1, b1) -> ReLU -> Linear(W2, b2) -> logits."""

    def __init__(self, input_dim, hidden_dim, num_classes, seed=0):
        # TODO: self.params = {"W1", "b1", "W2", "b2"}. Draw W1 then W2 from
        # np.random.default_rng(seed).standard_normal, scaled by sqrt(2 / fan_in). Biases are zeros.
        raise NotImplementedError

    def forward(self, x):
        """x: (N, input_dim) -> logits (N, num_classes). Cache what backward needs."""
        # TODO
        raise NotImplementedError

    def loss_and_grads(self, x, y):
        """Return (loss, grads) where grads has the same keys and shapes as self.params."""
        # TODO: forward, loss, then backward through each layer in reverse order.
        raise NotImplementedError

    def sgd_step(self, grads, lr):
        """Update every parameter: p -= lr * grad."""
        # TODO
        raise NotImplementedError
