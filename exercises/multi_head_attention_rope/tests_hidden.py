"""Hidden validation suite for multi_head_attention_rope.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import numpy as np
import pytest

import submission as sub


# ---------------------------------------------------------------- references

def _ref_softmax(x):
    e = np.exp(x - x.max(axis=-1, keepdims=True))
    return e / e.sum(axis=-1, keepdims=True)


def _ref_rope(x, positions=None, base=10000.0):
    """Loop-based RoPE: multiply each (2i, 2i+1) pair by an explicit 2x2 rotation matrix."""
    x = np.asarray(x, dtype=float)
    T, d = x.shape[-2], x.shape[-1]
    pos = np.arange(T) if positions is None else np.asarray(positions, dtype=float)
    out = np.array(x)
    for t in range(T):
        for i in range(d // 2):
            theta = pos[t] * base ** (-2.0 * i / d)
            R = np.array([[np.cos(theta), -np.sin(theta)], [np.sin(theta), np.cos(theta)]])
            pair = x[..., t, 2 * i:2 * i + 2]
            out[..., t, 2 * i:2 * i + 2] = pair @ R.T
    return out


def _ref_mha(x, W_q, W_k, W_v, W_o, H, causal=False, rope=False):
    """Head-by-head reference: slice the feature axis explicitly, no reshapes."""
    B, T, D = x.shape
    dh = D // H
    Q, K, V = x @ W_q, x @ W_k, x @ W_v
    heads, weights = [], []
    for h in range(H):
        q, k, v = (M[..., h * dh:(h + 1) * dh] for M in (Q, K, V))
        if rope:
            q, k = _ref_rope(q), _ref_rope(k)
        s = q @ k.swapaxes(-1, -2) / np.sqrt(dh)
        if causal:
            s = np.where(np.tril(np.ones((T, T), dtype=bool)), s, -np.inf)
        w = _ref_softmax(s)
        heads.append(w @ v)
        weights.append(w)
    return np.concatenate(heads, axis=-1) @ W_o, np.stack(weights, axis=1)


def _weights(seed, D):
    rng = np.random.default_rng(seed)
    return [rng.standard_normal((D, D)) / np.sqrt(D) for _ in range(4)]


# ---------------------------------------------------------------- heads

def test_split_heads_shape_and_layout():
    x = np.random.default_rng(0).standard_normal((2, 5, 12))
    s = sub.split_heads(x, 3)
    assert np.shape(s) == (2, 3, 5, 4), f"got {np.shape(s)}, expected (B, H, T, d_head) = (2, 3, 5, 4)"
    for h in range(3):
        np.testing.assert_array_equal(
            s[:, h], x[..., h * 4:(h + 1) * 4],
            err_msg=f"head {h} should hold features {h * 4}:{(h + 1) * 4} of every token — heads are mixing")


def test_merge_heads_inverts_split():
    x = np.random.default_rng(1).standard_normal((3, 7, 16))
    for H in (1, 2, 4, 8):
        m = sub.merge_heads(sub.split_heads(x, H))
        assert np.shape(m) == x.shape
        np.testing.assert_array_equal(m, x)
    y = np.random.default_rng(2).standard_normal((2, 4, 6, 3))
    np.testing.assert_array_equal(sub.merge_heads(y)[:, :, 3:6], y[:, 1])


def test_split_heads_rejects_indivisible():
    with pytest.raises(ValueError):
        sub.split_heads(np.zeros((1, 3, 10)), 3)


# ---------------------------------------------------------------- RoPE

def test_rope_frequencies_values():
    np.testing.assert_allclose(sub.rope_frequencies(8),
                               [1.0, 10000 ** -0.25, 10000 ** -0.5, 10000 ** -0.75], rtol=1e-12)
    f = sub.rope_frequencies(64)
    assert np.shape(f) == (32,)
    np.testing.assert_allclose(f, 10000.0 ** (-np.arange(0, 64, 2) / 64), rtol=1e-12)
    np.testing.assert_allclose(sub.rope_frequencies(4, base=100.0), [1.0, 0.1], rtol=1e-12)
    with pytest.raises(ValueError):
        sub.rope_frequencies(7)


def test_apply_rope_matches_reference():
    rng = np.random.default_rng(3)
    x = rng.standard_normal((2, 3, 6, 8))
    np.testing.assert_allclose(sub.apply_rope(x), _ref_rope(x), atol=1e-12)
    pos = np.array([0, 5, 9, 2, 100, 7])
    np.testing.assert_allclose(sub.apply_rope(x, positions=pos), _ref_rope(x, pos), atol=1e-12)
    # Position 0 is the identity; position 1 rotates pair (x0, x1) = (1, 0) by exactly 1 radian.
    e = np.zeros((2, 4)); e[:, 0] = 1.0
    r = sub.apply_rope(e)
    np.testing.assert_allclose(r[0], e[0], atol=1e-15)
    np.testing.assert_allclose(r[1, :2], [np.cos(1.0), np.sin(1.0)], atol=1e-12,
                               err_msg="use the interleaved convention: pairs are (x[2i], x[2i+1])")


def test_rope_preserves_norms():
    x = np.random.default_rng(4).standard_normal((3, 10, 16)) * 5
    r = sub.apply_rope(x, positions=np.arange(10) * 37)
    np.testing.assert_allclose(np.linalg.norm(r, axis=-1), np.linalg.norm(x, axis=-1), rtol=1e-12)


def test_rope_dot_product_depends_only_on_offset():
    rng = np.random.default_rng(5)
    q, k = rng.standard_normal((1, 16)), rng.standard_normal((1, 16))

    def score(m, n):
        return float(np.sum(sub.apply_rope(q, positions=[m]) * sub.apply_rope(k, positions=[n])))

    for offset in (0, 2, 9):
        vals = [score(m + offset, m) for m in (0, 3, 50, 1000)]
        np.testing.assert_allclose(vals, vals[0], rtol=1e-9, atol=1e-9,
                                   err_msg=f"<R_m q, R_n k> changed with absolute position at offset {offset}")
    assert not np.isclose(score(2, 0), score(9, 0)), "different offsets should give different scores"


def test_apply_rope_does_not_mutate_input():
    x = np.random.default_rng(6).standard_normal((4, 8))
    before = x.copy()
    out = sub.apply_rope(x)
    np.testing.assert_array_equal(x, before)
    assert out is not x


# ---------------------------------------------------------------- multi-head attention

@pytest.mark.parametrize("rope", [False, True])
def test_mha_matches_reference(rope):
    x = np.random.default_rng(7).standard_normal((2, 6, 16))
    W = _weights(8, 16)
    out, w = sub.multi_head_attention(x, *W, n_heads=4, rope=rope)
    ref_out, ref_w = _ref_mha(x, *W, 4, rope=rope)
    assert np.shape(out) == (2, 6, 16)
    assert np.shape(w) == (2, 4, 6, 6), f"weights shape {np.shape(w)}, expected (B, H, T, T)"
    np.testing.assert_allclose(w, ref_w, atol=1e-10)
    np.testing.assert_allclose(out, ref_out, atol=1e-10)


def test_causal_mha_ignores_future_tokens():
    x = np.random.default_rng(9).standard_normal((1, 7, 8))
    W = _weights(10, 8)
    x_future = x.copy()
    x_future[:, 5:] += 3.0
    out_a, w = sub.multi_head_attention(x, *W, n_heads=2, causal=True, rope=True)
    out_b, _ = sub.multi_head_attention(x_future, *W, n_heads=2, causal=True, rope=True)
    assert np.all(np.triu(w, k=1) == 0.0), "causal weights must be exactly zero above the diagonal"
    np.testing.assert_allclose(out_a[:, :5], out_b[:, :5], atol=1e-12,
                               err_msg="earlier positions changed when only future tokens changed")
    np.testing.assert_allclose(out_a, _ref_mha(x, *W, 2, causal=True, rope=True)[0], atol=1e-10)
