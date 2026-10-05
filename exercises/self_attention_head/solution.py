"""Reference solution — never shipped to learners."""
import numpy as np


def softmax(x, axis=-1):
    shifted = x - np.max(x, axis=axis, keepdims=True)
    e = np.exp(shifted)
    return e / np.sum(e, axis=axis, keepdims=True)


def causal_mask(T):
    return np.tril(np.ones((T, T), dtype=bool))


def scaled_dot_product_attention(Q, K, V, mask=None):
    if Q.shape[-1] != K.shape[-1]:
        raise ValueError("K and Q dimensions do not match")
    d_k = Q.shape[-1]
    scores = Q @ K.swapaxes(-1, -2) / np.sqrt(d_k)
    if mask is not None:
        scores = np.where(mask, scores, -np.inf)
    weights = softmax(scores, axis=-1)
    return weights @ V, weights


class SelfAttentionHead:
    def __init__(self, d_model, d_head, seed=0):
        rng = np.random.default_rng(seed)
        scale = 1.0 / np.sqrt(d_model)
        self.W_q = rng.standard_normal((d_model, d_head)) * scale
        self.W_k = rng.standard_normal((d_model, d_head)) * scale
        self.W_v = rng.standard_normal((d_model, d_head)) * scale

    def forward(self, X, causal=False):
        Q, K, V = X @ self.W_q, X @ self.W_k, X @ self.W_v
        mask = causal_mask(X.shape[-2]) if causal else None
        return scaled_dot_product_attention(Q, K, V, mask)
