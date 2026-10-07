"""Backprop by hand: linear and ReLU layers, softmax cross-entropy and a 2-layer MLP trained with SGD. NumPy only."""
import numpy as np


def linear_forward(x, W, b):
    out = x @ W + b
    cache = (x, W)
    return out, cache


def linear_backward(dout, cache):
    x, W = cache
    dx = dout @ W.T
    dW = x.T @ dout
    db = dout.sum(axis=0)
    return dx, dW, db


def relu_forward(x):
    return np.maximum(x, 0.0), x


def relu_backward(dout, cache):
    x = cache
    return dout * (x > 0)


def softmax_cross_entropy(logits, y):
    N = logits.shape[0]
    shifted = logits - logits.max(axis=1, keepdims=True)
    log_probs = shifted - np.log(np.exp(shifted).sum(axis=1, keepdims=True))
    loss = -log_probs[np.arange(N), y].mean()
    probs = np.exp(log_probs)
    onehot = np.zeros_like(probs)
    onehot[np.arange(N), y] = 1.0
    dlogits = (probs - onehot) / N
    return float(loss), dlogits


class TwoLayerMLP:
    def __init__(self, input_dim, hidden_dim, num_classes, seed=0):
        rng = np.random.default_rng(seed)
        self.params = {
            "W1": rng.standard_normal((input_dim, hidden_dim)) * np.sqrt(2.0 / input_dim),
            "b1": np.zeros(hidden_dim),
            "W2": rng.standard_normal((hidden_dim, num_classes)) * np.sqrt(2.0 / hidden_dim),
            "b2": np.zeros(num_classes),
        }

    def forward(self, x):
        p = self.params
        h_pre, self._c1 = linear_forward(x, p["W1"], p["b1"])
        h, self._cr = relu_forward(h_pre)
        logits, self._c2 = linear_forward(h, p["W2"], p["b2"])
        return logits

    def loss_and_grads(self, x, y):
        logits = self.forward(x)
        loss, dlogits = softmax_cross_entropy(logits, y)
        dh, dW2, db2 = linear_backward(dlogits, self._c2)
        dh_pre = relu_backward(dh, self._cr)
        _, dW1, db1 = linear_backward(dh_pre, self._c1)
        return loss, {"W1": dW1, "b1": db1, "W2": dW2, "b2": db2}

    def sgd_step(self, grads, lr):
        for name, g in grads.items():
            self.params[name] -= lr * g
