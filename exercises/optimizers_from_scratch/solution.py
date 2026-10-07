"""Optimizers from scratch: SGD with momentum/Nesterov, RMSProp, Adam, AdamW and a warmup + cosine schedule. NumPy only."""
import math

import numpy as np


class Optimizer:
    """Base class: keeps per-parameter state and updates a list of arrays in place."""

    def __init__(self, lr):
        if lr <= 0:
            raise ValueError("lr must be positive")
        self.lr = lr
        self.t = 0
        self.state = None

    def _check(self, params, grads):
        if len(params) != len(grads):
            raise ValueError("params and grads must have the same length")
        for p, g in zip(params, grads):
            if np.shape(p) != np.shape(g):
                raise ValueError(f"shape mismatch: param {np.shape(p)} vs grad {np.shape(g)}")
        if self.state is None:
            self.state = [self._init_state(p) for p in params]
        elif len(self.state) != len(params):
            raise ValueError("number of parameters changed between steps")

    def _init_state(self, p):
        return {}

    def step(self, params, grads):
        """Update every array in params in place using its gradient. Never modifies grads."""
        self._check(params, grads)
        self.t += 1
        for p, g, s in zip(params, grads, self.state):
            self._update(p, np.asarray(g, dtype=float), s)

    def _update(self, p, g, s):
        raise NotImplementedError


class SGD(Optimizer):
    def __init__(self, lr=0.01, momentum=0.0, nesterov=False, weight_decay=0.0):
        super().__init__(lr)
        if nesterov and momentum <= 0:
            raise ValueError("Nesterov momentum requires momentum > 0")
        self.momentum, self.nesterov, self.weight_decay = momentum, nesterov, weight_decay

    def _init_state(self, p):
        return {"v": np.zeros_like(p, dtype=float)}

    def _update(self, p, g, s):
        g = g + self.weight_decay * p          # L2 penalty: part of the gradient
        if self.momentum:
            s["v"] = self.momentum * s["v"] + g
            g = g + self.momentum * s["v"] if self.nesterov else s["v"]
        p -= self.lr * g


class RMSProp(Optimizer):
    def __init__(self, lr=0.01, alpha=0.99, eps=1e-8):
        super().__init__(lr)
        self.alpha, self.eps = alpha, eps

    def _init_state(self, p):
        return {"sq": np.zeros_like(p, dtype=float)}

    def _update(self, p, g, s):
        s["sq"] = self.alpha * s["sq"] + (1 - self.alpha) * g * g
        p -= self.lr * g / (np.sqrt(s["sq"]) + self.eps)


class Adam(Optimizer):
    decoupled = False

    def __init__(self, lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=0.0):
        super().__init__(lr)
        self.beta1, self.beta2 = betas
        self.eps, self.weight_decay = eps, weight_decay

    def _init_state(self, p):
        return {"m": np.zeros_like(p, dtype=float), "v": np.zeros_like(p, dtype=float)}

    def _update(self, p, g, s):
        if self.decoupled:
            p -= self.lr * self.weight_decay * p       # AdamW: shrink weights directly
        else:
            g = g + self.weight_decay * p              # Adam: L2 folded into the gradient
        s["m"] = self.beta1 * s["m"] + (1 - self.beta1) * g
        s["v"] = self.beta2 * s["v"] + (1 - self.beta2) * g * g
        m_hat = s["m"] / (1 - self.beta1 ** self.t)
        v_hat = s["v"] / (1 - self.beta2 ** self.t)
        p -= self.lr * m_hat / (np.sqrt(v_hat) + self.eps)


class AdamW(Adam):
    decoupled = True

    def __init__(self, lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=1e-2):
        super().__init__(lr, betas, eps, weight_decay)


def cosine_warmup_lr(step, base_lr, warmup_steps, total_steps, min_lr=0.0):
    """Linear warmup from 0 to base_lr over warmup_steps, then cosine decay to min_lr at total_steps."""
    if step < 0 or warmup_steps < 0 or total_steps < warmup_steps:
        raise ValueError("need step >= 0 and 0 <= warmup_steps <= total_steps")
    if step < warmup_steps:
        return base_lr * step / warmup_steps
    if step >= total_steps:
        return float(min_lr)
    progress = (step - warmup_steps) / (total_steps - warmup_steps)
    return min_lr + 0.5 * (base_lr - min_lr) * (1.0 + math.cos(math.pi * progress))
