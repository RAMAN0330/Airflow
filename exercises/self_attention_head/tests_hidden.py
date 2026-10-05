"""Hidden validation suite for self_attention_head.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import numpy as np
import pytest

import submission as sub


def _ref_softmax(x, axis=-1):
    e = np.exp(x - x.max(axis=axis, keepdims=True))
    return e / e.sum(axis=axis, keepdims=True)


def _ref_attention(Q, K, V, mask=None):
    scores = Q @ K.swapaxes(-1, -2) / np.sqrt(Q.shape[-1])
    if mask is not None:
        scores = np.where(mask, scores, -np.inf)
    w = _ref_softmax(scores)
    return w @ V, w


def _qkv(seed, batch=(), tq=5, tk=5, dk=8, dv=6):
    rng = np.random.default_rng(seed)
    return (
        rng.standard_normal((*batch, tq, dk)),
        rng.standard_normal((*batch, tk, dk)),
        rng.standard_normal((*batch, tk, dv)),
    )


# ---------------------------------------------------------------- softmax

def test_softmax_sums_to_one():
    x = np.random.default_rng(0).standard_normal((4, 7))
    s = sub.softmax(x)
    np.testing.assert_allclose(s.sum(axis=-1), 1.0, atol=1e-12)
    np.testing.assert_allclose(s, _ref_softmax(x), atol=1e-12)


def test_softmax_is_numerically_stable():
    s = sub.softmax(np.array([1000.0, 1001.0, 1002.0]))
    assert np.all(np.isfinite(s)), "softmax overflowed — subtract the max before exp"
    np.testing.assert_allclose(s, _ref_softmax(np.array([0.0, 1.0, 2.0])), atol=1e-12)


def test_softmax_respects_axis():
    x = np.random.default_rng(1).standard_normal((3, 4))
    np.testing.assert_allclose(sub.softmax(x, axis=0).sum(axis=0), 1.0, atol=1e-12)


# ---------------------------------------------------------------- mask

def test_causal_mask():
    m = sub.causal_mask(4)
    assert np.shape(m) == (4, 4)
    assert np.asarray(m).dtype == bool, "causal_mask should be boolean"
    np.testing.assert_array_equal(m, np.tril(np.ones((4, 4), dtype=bool)))


# ---------------------------------------------------------------- attention

def test_attention_unbatched_matches_reference():
    Q, K, V = _qkv(2, tq=4, tk=6)
    out, w = sub.scaled_dot_product_attention(Q, K, V)
    ref_out, ref_w = _ref_attention(Q, K, V)
    assert np.shape(out) == (4, 6), f"output shape {np.shape(out)}, expected (T_q, d_v) = (4, 6)"
    assert np.shape(w) == (4, 6), f"weights shape {np.shape(w)}, expected (T_q, T_k) = (4, 6)"
    np.testing.assert_allclose(w, ref_w, atol=1e-10)
    np.testing.assert_allclose(out, ref_out, atol=1e-10)


def test_attention_batched_matches_reference():
    Q, K, V = _qkv(3, batch=(2, 3))
    out, w = sub.scaled_dot_product_attention(Q, K, V)
    ref_out, ref_w = _ref_attention(Q, K, V)
    assert np.shape(out) == (2, 3, 5, 6), f"batched output shape {np.shape(out)}; did you use .T instead of swapaxes?"
    np.testing.assert_allclose(w, ref_w, atol=1e-10)
    np.testing.assert_allclose(out, ref_out, atol=1e-10)


def test_scaling_by_sqrt_dk_is_applied():
    Q, K, V = _qkv(4, dk=64)
    _, w = sub.scaled_dot_product_attention(Q, K, V)
    unscaled = _ref_softmax(Q @ K.T)
    assert not np.allclose(w, unscaled), "weights equal softmax(QK^T) — missing the 1/sqrt(d_k) factor"
    np.testing.assert_allclose(w, _ref_softmax(Q @ K.T / 8.0), atol=1e-10)


def test_masked_positions_get_zero_weight():
    Q, K, V = _qkv(5, batch=(2,))
    mask = np.tril(np.ones((5, 5), dtype=bool))
    out, w = sub.scaled_dot_product_attention(Q, K, V, mask=mask)
    assert np.all(w[..., ~mask] == 0.0), "masked positions must receive exactly zero weight"
    np.testing.assert_allclose(w.sum(axis=-1), 1.0, atol=1e-12)
    np.testing.assert_allclose(out, _ref_attention(Q, K, V, mask)[0], atol=1e-10)


def test_dimension_mismatch_raises():
    rng = np.random.default_rng(6)
    Q, K, V = rng.standard_normal((4, 8)), rng.standard_normal((4, 7)), rng.standard_normal((4, 3))
    with pytest.raises(ValueError, match="K and Q dimensions do not match"):
        sub.scaled_dot_product_attention(Q, K, V)


# ---------------------------------------------------------------- head

def test_head_weight_shapes():
    head = sub.SelfAttentionHead(d_model=16, d_head=4, seed=0)
    for name in ("W_q", "W_k", "W_v"):
        assert np.shape(getattr(head, name)) == (16, 4), f"{name} should have shape (d_model, d_head)"


def test_head_forward_matches_reference():
    head = sub.SelfAttentionHead(d_model=16, d_head=4, seed=1)
    X = np.random.default_rng(7).standard_normal((2, 6, 16))
    out, w = head.forward(X)
    ref_out, ref_w = _ref_attention(X @ head.W_q, X @ head.W_k, X @ head.W_v)
    assert np.shape(out) == (2, 6, 4)
    assert np.shape(w) == (2, 6, 6)
    np.testing.assert_allclose(out, ref_out, atol=1e-10)


def test_head_is_deterministic_per_seed():
    a = sub.SelfAttentionHead(8, 4, seed=42)
    b = sub.SelfAttentionHead(8, 4, seed=42)
    np.testing.assert_array_equal(a.W_q, b.W_q)


def test_causal_head_ignores_future_tokens():
    head = sub.SelfAttentionHead(d_model=8, d_head=4, seed=2)
    X = np.random.default_rng(8).standard_normal((6, 8))
    X_future = X.copy()
    X_future[4:] += 10.0  # perturb only positions 4 and 5
    out_a, w = head.forward(X, causal=True)
    out_b, _ = head.forward(X_future, causal=True)
    assert np.all(np.triu(w, k=1) == 0.0), "causal weights must be zero above the diagonal"
    np.testing.assert_allclose(out_a[:4], out_b[:4], atol=1e-12,
                               err_msg="earlier positions changed when only future tokens changed — information leak")


def test_unmasked_attention_is_permutation_equivariant():
    head = sub.SelfAttentionHead(d_model=8, d_head=4, seed=3)
    X = np.random.default_rng(9).standard_normal((5, 8))
    perm = np.array([3, 0, 4, 1, 2])
    out, _ = head.forward(X)
    out_perm, _ = head.forward(X[perm])
    np.testing.assert_allclose(out_perm, out[perm], atol=1e-10)
