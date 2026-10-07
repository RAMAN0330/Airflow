"""LoRA: a frozen linear layer plus a trainable low-rank update. NumPy only."""
import numpy as np


class LoRALinear:
    def __init__(self, W, r, alpha, seed=0):
        if r <= 0:
            raise ValueError("rank r must be positive")
        self.W = np.array(W, dtype=float)  # a private copy: the frozen base weight
        d_out, d_in = self.W.shape
        rng = np.random.default_rng(seed)
        self.A = rng.standard_normal((r, d_in)) / np.sqrt(d_in)
        self.B = np.zeros((d_out, r))
        self.r = r
        self.alpha = alpha
        self.scale = alpha / r
        self.merged = False

    def delta_weight(self):
        return self.scale * (self.B @ self.A)

    def forward(self, x):
        if self.merged:
            return x @ self.W.T
        return x @ self.W.T + self.scale * ((x @ self.A.T) @ self.B.T)

    def backward(self, x, grad_out):
        if self.merged:
            raise RuntimeError("unmerge() before training")
        xa = x @ self.A.T                                   # (N, r)
        grad_B = self.scale * grad_out.T @ xa               # (d_out, r)
        grad_A = self.scale * (grad_out @ self.B).T @ x     # (r, d_in)
        return {"A": grad_A, "B": grad_B}

    def step(self, grads, lr):
        for name, g in grads.items():
            param = getattr(self, name)
            param -= lr * g

    def merge(self):
        if not self.merged:
            self.W = self.W + self.delta_weight()
            self.merged = True

    def unmerge(self):
        if self.merged:
            self.W = self.W - self.delta_weight()
            self.merged = False

    def n_trainable(self):
        return self.A.size + self.B.size


def param_counts(d_in, d_out, r):
    return r * (d_in + d_out), d_in * d_out


def train_lora(layer, X, Y, lr=0.1, steps=200):
    losses = []
    for _ in range(steps):
        pred = layer.forward(X)
        diff = pred - Y
        losses.append(float(np.mean(diff ** 2)))
        grads = layer.backward(X, 2.0 * diff / diff.size)
        layer.step(grads, lr)
    return losses
