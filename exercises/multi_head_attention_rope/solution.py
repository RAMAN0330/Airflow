"""Multi-head attention with rotary position embeddings (RoPE). NumPy only."""
import numpy as np


def _softmax(x, axis=-1):
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / np.sum(e, axis=axis, keepdims=True)


def split_heads(x, n_heads):
    B, T, D = x.shape
    if D % n_heads != 0:
        raise ValueError("d_model must be divisible by n_heads")
    d_head = D // n_heads
    return x.reshape(B, T, n_heads, d_head).transpose(0, 2, 1, 3)


def merge_heads(x):
    B, H, T, d_head = x.shape
    return x.transpose(0, 2, 1, 3).reshape(B, T, H * d_head)


def rope_frequencies(d_head, base=10000.0):
    if d_head % 2 != 0:
        raise ValueError("RoPE needs an even head dimension")
    return 1.0 / base ** (np.arange(0, d_head, 2) / d_head)


def apply_rope(x, positions=None, base=10000.0):
    x = np.asarray(x, dtype=float)
    T, d = x.shape[-2], x.shape[-1]
    pos = np.arange(T, dtype=float) if positions is None else np.asarray(positions, dtype=float)
    angles = pos[:, None] * rope_frequencies(d, base)[None, :]  # (T, d/2)
    cos, sin = np.cos(angles), np.sin(angles)
    x_even, x_odd = x[..., 0::2], x[..., 1::2]
    out = np.empty_like(x)
    out[..., 0::2] = x_even * cos - x_odd * sin
    out[..., 1::2] = x_even * sin + x_odd * cos
    return out


def multi_head_attention(x, W_q, W_k, W_v, W_o, n_heads, causal=False, rope=False, base=10000.0):
    q = split_heads(x @ W_q, n_heads)
    k = split_heads(x @ W_k, n_heads)
    v = split_heads(x @ W_v, n_heads)
    if rope:
        q, k = apply_rope(q, base=base), apply_rope(k, base=base)
    d_head = q.shape[-1]
    scores = q @ k.swapaxes(-1, -2) / np.sqrt(d_head)
    if causal:
        T = x.shape[1]
        scores = np.where(np.tril(np.ones((T, T), dtype=bool)), scores, -np.inf)
    weights = _softmax(scores, axis=-1)
    out = merge_heads(weights @ v) @ W_o
    return out, weights
