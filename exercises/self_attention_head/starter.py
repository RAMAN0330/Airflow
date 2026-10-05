"""Scaled dot-product self-attention head.

Fill in each function. Use NumPy only.
"""
import numpy as np


def softmax(x, axis=-1):
    """Numerically stable softmax along `axis`."""
    # TODO: shift by the max along `axis` (keepdims=True), exponentiate, normalize.
    raise NotImplementedError


def causal_mask(T):
    """Boolean (T, T) mask, True where key position j <= query position i."""
    # TODO: one call to np.tril.
    raise NotImplementedError


def scaled_dot_product_attention(Q, K, V, mask=None):
    """Return (output, weights) for softmax(Q K^T / sqrt(d_k)) V.

    mask: optional boolean array broadcastable to (..., T_q, T_k); True = keep.
    Raise ValueError("K and Q dimensions do not match") if Q.shape[-1] != K.shape[-1].
    """
    # TODO: validate shapes, compute scores, apply mask, softmax, weight V.
    raise NotImplementedError


class SelfAttentionHead:
    def __init__(self, d_model, d_head, seed=0):
        # TODO: create self.W_q, self.W_k, self.W_v with shape (d_model, d_head)
        # using np.random.default_rng(seed), scaled by 1/sqrt(d_model).
        raise NotImplementedError

    def forward(self, X, causal=False):
        """X: (..., T, d_model) -> (output (..., T, d_head), weights (..., T, T))."""
        # TODO: project X into Q, K, V; build a causal mask if requested.
        raise NotImplementedError
