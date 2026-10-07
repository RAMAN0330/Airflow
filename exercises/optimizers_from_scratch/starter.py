"""Optimizers from scratch: SGD with momentum/Nesterov, RMSProp, Adam, AdamW and a warmup + cosine schedule. NumPy only."""
import math

import numpy as np


class SGD:
    def __init__(self, lr=0.01, momentum=0.0, nesterov=False, weight_decay=0.0):
        self.lr = lr

    def step(self, params, grads):
        """Update each array in params in place. weight_decay is an L2 term added to the gradient."""
        raise NotImplementedError


class RMSProp:
    def __init__(self, lr=0.01, alpha=0.99, eps=1e-8):
        self.lr = lr

    def step(self, params, grads):
        raise NotImplementedError


class Adam:
    def __init__(self, lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=0.0):
        self.lr = lr

    def step(self, params, grads):
        """Bias-corrected Adam. weight_decay is an L2 term added to the gradient."""
        raise NotImplementedError


class AdamW:
    def __init__(self, lr=1e-3, betas=(0.9, 0.999), eps=1e-8, weight_decay=1e-2):
        self.lr = lr

    def step(self, params, grads):
        """Adam on the raw gradient, plus decoupled decay p -= lr * weight_decay * p."""
        raise NotImplementedError


def cosine_warmup_lr(step, base_lr, warmup_steps, total_steps, min_lr=0.0):
    """Linear warmup from 0 to base_lr over warmup_steps, then cosine decay to min_lr at total_steps."""
    raise NotImplementedError
