"""Hidden validation suite for activation_functions.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import math

import numpy as np
import pytest

import submission as sub


def _ref_gelu(x):
    return 0.5 * x * (1.0 + np.tanh(math.sqrt(2.0 / math.pi) * (x + 0.044715 * x ** 3)))


# ---------------------------------------------------------------- relu

def test_relu_values():
    x = np.array([-2.0, -0.5, 0.0, 0.5, 3.0])
    np.testing.assert_array_equal(sub.relu(x), [0.0, 0.0, 0.0, 0.5, 3.0])


def test_relu_preserves_shape_and_input():
    x = np.random.default_rng(0).standard_normal((3, 4, 5))
    x_copy = x.copy()
    out = sub.relu(x)
    assert np.shape(out) == x.shape, f"relu returned shape {np.shape(out)}, expected {x.shape}"
    np.testing.assert_array_equal(x, x_copy, err_msg="relu modified its input in place")


def test_relu_backward():
    rng = np.random.default_rng(1)
    x = rng.standard_normal((6, 7))
    dout = rng.standard_normal((6, 7))
    dx = sub.relu_backward(dout, x)
    assert np.shape(dx) == x.shape, f"relu_backward returned shape {np.shape(dx)}, expected {x.shape}"
    np.testing.assert_allclose(dx, np.where(x > 0, dout, 0.0))


# ---------------------------------------------------------------- gelu

def test_gelu_values():
    x = np.linspace(-4, 4, 33).reshape(3, 11)
    out = sub.gelu(x)
    assert np.shape(out) == x.shape, f"gelu returned shape {np.shape(out)}, expected {x.shape}"
    np.testing.assert_allclose(out, _ref_gelu(x), atol=1e-9)
    assert sub.gelu(np.array([0.0]))[0] == pytest.approx(0.0)


def test_gelu_asymptotics():
    np.testing.assert_allclose(sub.gelu(np.array([20.0])), [20.0], atol=1e-6)
    np.testing.assert_allclose(sub.gelu(np.array([-20.0])), [0.0], atol=1e-6)


# ---------------------------------------------------------------- softmax

def test_softmax_sums_to_one():
    x = np.random.default_rng(2).standard_normal((5, 9))
    s = sub.softmax(x)
    assert np.shape(s) == x.shape, f"softmax returned shape {np.shape(s)}, expected {x.shape}"
    np.testing.assert_allclose(s.sum(axis=-1), 1.0, atol=1e-12)
    assert np.all(s > 0)


def test_softmax_is_numerically_stable():
    s = sub.softmax(np.array([1000.0, 1001.0, 1002.0]))
    assert np.all(np.isfinite(s)), "softmax produced nan/inf — overflow in exp"
    e = np.exp([0.0, 1.0, 2.0])
    np.testing.assert_allclose(s, e / e.sum(), atol=1e-12)


def test_softmax_axis():
    x = np.random.default_rng(3).standard_normal((4, 6))
    s0 = sub.softmax(x, axis=0)
    np.testing.assert_allclose(s0.sum(axis=0), 1.0, atol=1e-12)
    e = np.exp(x - x.max(axis=0, keepdims=True))
    np.testing.assert_allclose(s0, e / e.sum(axis=0, keepdims=True), atol=1e-12)


def test_softmax_invariant_to_shift():
    x = np.random.default_rng(4).standard_normal((3, 5))
    np.testing.assert_allclose(sub.softmax(x), sub.softmax(x + 123.4), atol=1e-12)
