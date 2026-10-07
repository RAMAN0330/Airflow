"""LoRA: a frozen linear layer plus a trainable low-rank update. NumPy only."""
import numpy as np


class LoRALinear:
    def __init__(self, W, r, alpha, seed=0):
        """Wrap a frozen weight W of shape (d_out, d_in) with a rank-r adapter.

        Store a private float copy of W as self.W (never modify the caller's array).
        rng = np.random.default_rng(seed)
        self.A: rng.standard_normal((r, d_in)) / sqrt(d_in)
        self.B: zeros (d_out, r)
        self.scale = alpha / r; self.merged = False. Raise ValueError if r <= 0.
        """
        # TODO
        raise NotImplementedError

    def delta_weight(self):
        """The low-rank update scale * B @ A, shape (d_out, d_in)."""
        raise NotImplementedError

    def forward(self, x):
        """x: (N, d_in) -> (N, d_out) = x @ W.T + scale * (x @ A.T) @ B.T (just x @ W.T when merged)."""
        raise NotImplementedError

    def backward(self, x, grad_out):
        """Given dL/d(output) of shape (N, d_out), return {"A": dL/dA, "B": dL/dB}.

        W is frozen, so it gets no gradient. Raise RuntimeError if the layer is merged.
        """
        raise NotImplementedError

    def step(self, grads, lr):
        """Plain SGD on every parameter named in `grads`: param -= lr * grad."""
        raise NotImplementedError

    def merge(self):
        """Fold the update into W for zero-overhead inference. Calling it twice changes nothing."""
        raise NotImplementedError

    def unmerge(self):
        """Undo merge(): subtract the update from W again. A no-op if not merged."""
        raise NotImplementedError

    def n_trainable(self):
        """Number of trainable scalars (entries of A and B)."""
        raise NotImplementedError


def param_counts(d_in, d_out, r):
    """Return (lora_params, full_finetune_params) for one d_in -> d_out layer."""
    raise NotImplementedError


def train_lora(layer, X, Y, lr=0.1, steps=200):
    """Run `steps` SGD steps on the MSE loss mean((layer.forward(X) - Y) ** 2).

    Return the list of losses, one per step, each measured before that step's update.
    """
    raise NotImplementedError
