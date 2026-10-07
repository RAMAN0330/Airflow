"""Hidden validation suite for lora_adapter.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import numpy as np
import pytest

import submission as sub


def _base(seed=0, d_in=10, d_out=6):
    return np.random.default_rng(seed).standard_normal((d_out, d_in)) / np.sqrt(d_in)


def _with_random_adapter(layer, seed):
    rng = np.random.default_rng(seed)
    layer.A = rng.standard_normal(layer.A.shape)
    layer.B = rng.standard_normal(layer.B.shape)
    return layer


def _low_rank_problem(seed=0, d_in=16, d_out=12, rank=2, n=64):
    rng = np.random.default_rng(seed)
    W = rng.standard_normal((d_out, d_in)) / 4
    delta = rng.standard_normal((d_out, rank)) @ rng.standard_normal((rank, d_in)) / 4
    X = rng.standard_normal((n, d_in))
    return W, delta, X, X @ (W + delta).T


# ---------------------------------------------------------------- init

def test_init_shapes_and_zero_B():
    W = _base()
    layer = sub.LoRALinear(W, r=3, alpha=12, seed=5)
    assert np.shape(layer.A) == (3, 10), "A should have shape (r, d_in)"
    assert np.shape(layer.B) == (6, 3), "B should have shape (d_out, r)"
    assert np.all(layer.B == 0.0), "B must start at exactly zero"
    assert np.any(layer.A != 0.0), "A must start random, not zero (otherwise B never gets a gradient)"
    assert layer.scale == pytest.approx(4.0), "scale is alpha / r"
    expected_A = np.random.default_rng(5).standard_normal((3, 10)) / np.sqrt(10)
    np.testing.assert_allclose(layer.A, expected_A, rtol=1e-12)
    with pytest.raises(ValueError):
        sub.LoRALinear(W, r=0, alpha=1)


def test_init_output_equals_base_layer():
    W = _base(1)
    x = np.random.default_rng(2).standard_normal((5, 10))
    layer = sub.LoRALinear(W, r=4, alpha=8, seed=3)
    np.testing.assert_allclose(layer.forward(x), x @ W.T, atol=1e-14,
                               err_msg="a fresh adapter must not change the pretrained layer's output")


# ---------------------------------------------------------------- forward / backward

def test_forward_matches_reference():
    W = _base(4)
    x = np.random.default_rng(5).standard_normal((7, 10))
    layer = _with_random_adapter(sub.LoRALinear(W, r=4, alpha=16, seed=0), 6)
    expected = x @ W.T + (16 / 4) * (x @ layer.A.T @ layer.B.T)
    np.testing.assert_allclose(layer.forward(x), expected, atol=1e-12)
    np.testing.assert_allclose(layer.delta_weight(), 4.0 * layer.B @ layer.A, atol=1e-12)


def test_backward_matches_finite_differences():
    W = _base(7)
    rng = np.random.default_rng(8)
    x, G = rng.standard_normal((4, 10)), rng.standard_normal((4, 6))
    layer = _with_random_adapter(sub.LoRALinear(W, r=2, alpha=6, seed=0), 9)
    grads = layer.backward(x, G)

    def loss():
        return float(np.sum(layer.forward(x) * G))

    eps = 1e-6
    for name in ("A", "B"):
        P = getattr(layer, name)
        num = np.zeros_like(P)
        for idx in np.ndindex(*P.shape):
            old = P[idx]
            P[idx] = old + eps; up = loss()
            P[idx] = old - eps; down = loss()
            P[idx] = old
            num[idx] = (up - down) / (2 * eps)
        assert np.shape(grads[name]) == P.shape
        np.testing.assert_allclose(grads[name], num, rtol=1e-5, atol=1e-7, err_msg=f"wrong gradient for {name}")


def test_backward_grads_only_for_A_and_B():
    layer = _with_random_adapter(sub.LoRALinear(_base(10), r=2, alpha=2, seed=0), 11)
    x = np.random.default_rng(12).standard_normal((3, 10))
    grads = layer.backward(x, np.ones((3, 6)))
    assert set(grads) == {"A", "B"}, f"got gradients for {sorted(grads)}; the base weight W is frozen"
    layer.merge()
    with pytest.raises(RuntimeError):
        layer.backward(x, np.ones((3, 6)))


# ---------------------------------------------------------------- merge

def test_merge_matches_unmerged_and_unmerge_restores():
    W = _base(13)
    W_before = W.copy()
    x = np.random.default_rng(14).standard_normal((5, 10))
    layer = _with_random_adapter(sub.LoRALinear(W, r=3, alpha=6, seed=0), 15)
    y = layer.forward(x)
    layer.merge()
    assert layer.merged
    np.testing.assert_allclose(layer.W, W + 2.0 * layer.B @ layer.A, atol=1e-12)
    np.testing.assert_allclose(layer.forward(x), y, atol=1e-12)
    layer.merge()  # second call must be a no-op
    np.testing.assert_allclose(layer.forward(x), y, atol=1e-12, err_msg="merging twice added the update twice")
    layer.unmerge()
    assert not layer.merged
    np.testing.assert_allclose(layer.W, W, atol=1e-12)
    np.testing.assert_allclose(layer.forward(x), y, atol=1e-12)
    np.testing.assert_array_equal(W, W_before, err_msg="the caller's W array was modified; keep a private copy")


# ---------------------------------------------------------------- parameter counting

def test_parameter_counts():
    assert tuple(sub.param_counts(4096, 4096, 8)) == (65536, 16777216)
    assert tuple(sub.param_counts(10, 6, 3)) == (48, 60)
    layer = sub.LoRALinear(_base(16), r=3, alpha=3)
    assert layer.n_trainable() == 48


# ---------------------------------------------------------------- training

def test_training_fits_low_rank_target():
    W, delta, X, Y = _low_rank_problem()
    layer = sub.LoRALinear(W, r=2, alpha=4, seed=1)
    losses = sub.train_lora(layer, X, Y, lr=0.1, steps=300)
    assert len(losses) == 300
    assert losses[0] == pytest.approx(float(np.mean((X @ W.T - Y) ** 2)), rel=1e-9), \
        "losses[0] should be the MSE of the untouched base layer"
    assert losses[-1] < 1e-6 * losses[0], f"loss only fell from {losses[0]:.3g} to {losses[-1]:.3g}"
    np.testing.assert_allclose(layer.delta_weight(), delta, atol=1e-3)


def test_training_keeps_base_frozen():
    W, _, X, Y = _low_rank_problem(seed=3)
    X_before, Y_before = X.copy(), Y.copy()
    layer = sub.LoRALinear(W, r=2, alpha=4, seed=2)
    W_frozen = layer.W.copy()
    sub.train_lora(layer, X, Y, lr=0.1, steps=20)
    np.testing.assert_array_equal(layer.W, W_frozen, err_msg="training changed the frozen base weight W")
    assert np.any(layer.B != 0.0), "training should update B"
    np.testing.assert_array_equal(X, X_before)
    np.testing.assert_array_equal(Y, Y_before)
