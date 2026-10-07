"""Multi-head attention with rotary position embeddings (RoPE). NumPy only."""
import numpy as np


def _softmax(x, axis=-1):
    """Provided: numerically stable softmax (you built this in the previous module)."""
    e = np.exp(x - np.max(x, axis=axis, keepdims=True))
    return e / np.sum(e, axis=axis, keepdims=True)


def split_heads(x, n_heads):
    """(B, T, D) -> (B, H, T, D // H). Head h owns features h*d_head:(h+1)*d_head.

    Raise ValueError if D is not divisible by n_heads.
    """
    # TODO: reshape to (B, T, H, d_head), then move the head axis in front of T.
    raise NotImplementedError


def merge_heads(x):
    """(B, H, T, d_head) -> (B, T, H * d_head). Exact inverse of split_heads."""
    # TODO: undo split_heads: transpose first, then reshape.
    raise NotImplementedError


def rope_frequencies(d_head, base=10000.0):
    """Return theta_i = base ** (-2i / d_head) for i = 0 .. d_head/2 - 1, shape (d_head // 2,).

    Raise ValueError if d_head is odd.
    """
    # TODO
    raise NotImplementedError


def apply_rope(x, positions=None, base=10000.0):
    """Rotate interleaved pairs (x[..., 2i], x[..., 2i+1]) by angle positions[t] * theta_i.

    x: (..., T, d_head). positions: optional (T,) array, default np.arange(T).
    Return a new array; never modify x.
    """
    # TODO: build (T, d/2) angles, then rotate the even/odd feature pairs.
    raise NotImplementedError


def multi_head_attention(x, W_q, W_k, W_v, W_o, n_heads, causal=False, rope=False, base=10000.0):
    """x: (B, T, D); all weights (D, D). Return (output (B, T, D), weights (B, H, T, T))."""
    # TODO: project, split heads, optional RoPE on q and k, scaled scores,
    # optional causal mask, softmax, mix values, merge heads, output projection.
    raise NotImplementedError
