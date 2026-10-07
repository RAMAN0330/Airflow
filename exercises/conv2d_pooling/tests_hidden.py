"""Hidden validation suite for conv2d_pooling.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import time

import numpy as np
import pytest

import submission as sub


def _ref_conv(x, w, b, stride=1, pad=0):
    """Deliberately naive loops: the definition of cross-correlation, nothing clever."""
    N, C, H, W = x.shape
    F, _, KH, KW = w.shape
    xp = np.zeros((N, C, H + 2 * pad, W + 2 * pad))
    xp[:, :, pad:pad + H, pad:pad + W] = x
    Ho = (H + 2 * pad - KH) // stride + 1
    Wo = (W + 2 * pad - KW) // stride + 1
    out = np.zeros((N, F, Ho, Wo))
    for n in range(N):
        for f in range(F):
            for i in range(Ho):
                for j in range(Wo):
                    patch = xp[n, :, i * stride:i * stride + KH, j * stride:j * stride + KW]
                    out[n, f, i, j] = np.sum(patch * w[f]) + b[f]
    return out


def _ref_pool(x, p, s):
    N, C, H, W = x.shape
    Ho, Wo = (H - p) // s + 1, (W - p) // s + 1
    out = np.zeros((N, C, Ho, Wo))
    for i in range(Ho):
        for j in range(Wo):
            out[:, :, i, j] = x[:, :, i * s:i * s + p, j * s:j * s + p].max(axis=(2, 3))
    return out


def _data(seed, N=2, C=3, H=7, W=6, F=4, K=3):
    rng = np.random.default_rng(seed)
    return rng.standard_normal((N, C, H, W)), rng.standard_normal((F, C, K, K)), rng.standard_normal(F)


# ---------------------------------------------------------------- sizes and padding

def test_output_size_formula():
    cases = [((32, 3, 1, 1), 32), ((7, 3, 2, 0), 3), ((6, 3, 2, 0), 2), ((5, 3, 2, 1), 3),
             ((28, 5, 1, 0), 24), ((224, 7, 2, 3), 112), ((4, 4, 1, 0), 1), ((10, 2, 3, 0), 3)]
    for (n, k, s, p), expected in cases:
        got = sub.conv_output_size(n, k, s, p)
        assert got == expected, f"conv_output_size({n}, kernel={k}, stride={s}, pad={p}) = {got}, expected {expected}"
    with pytest.raises(ValueError):
        sub.conv_output_size(3, 5, 1, 0)
    assert sub.conv_output_size(3, 5, 1, 1) == 1


def test_pad_input():
    x = np.random.default_rng(0).standard_normal((2, 3, 4, 5))
    x_copy = x.copy()
    xp = sub.pad_input(x, 2)
    assert np.shape(xp) == (2, 3, 8, 9), f"padded shape {np.shape(xp)}, expected (2, 3, 8, 9); pad only H and W"
    np.testing.assert_array_equal(xp[:, :, 2:6, 2:7], x)
    border = np.ones((8, 9), dtype=bool)
    border[2:6, 2:7] = False
    assert np.all(xp[:, :, border] == 0.0), "padding must be zeros"
    np.testing.assert_array_equal(x, x_copy, err_msg="pad_input modified its input")
    np.testing.assert_array_equal(sub.pad_input(x, 0), x)


# ---------------------------------------------------------------- conv

def test_conv_is_cross_correlation():
    x = np.arange(16, dtype=float).reshape(1, 1, 4, 4)
    w = np.array([[[[1.0, 2.0], [3.0, 4.0]]]])
    out = sub.conv2d_forward(x, w, np.zeros(1))
    assert np.shape(out) == (1, 1, 3, 3)
    # top-left: 0·1 + 1·2 + 4·3 + 5·4 = 34. A flipped kernel would give 16.
    assert out[0, 0, 0, 0] == pytest.approx(34.0), (
        f"out[0,0,0,0] = {out[0, 0, 0, 0]}; 16 means the kernel was flipped (true convolution). "
        "Deep-learning 'convolution' is cross-correlation: no flip")
    np.testing.assert_allclose(out, _ref_conv(x, w, np.zeros(1)), atol=1e-12)


def test_conv_matches_naive_reference():
    x, w, b = _data(1)
    copies = (x.copy(), w.copy(), b.copy())
    out = sub.conv2d_forward(x, w, b)
    ref = _ref_conv(x, w, b)
    assert np.shape(out) == ref.shape, f"output shape {np.shape(out)}, expected {ref.shape}"
    np.testing.assert_allclose(out, ref, atol=1e-10)
    for a, c in zip((x, w, b), copies):
        np.testing.assert_array_equal(a, c, err_msg="conv2d_forward modified its inputs")


@pytest.mark.parametrize("stride,pad", [(1, 1), (2, 0), (2, 1), (3, 2)])
def test_conv_stride_and_padding(stride, pad):
    x, w, b = _data(2, H=9, W=8, K=3)
    out = sub.conv2d_forward(x, w, b, stride=stride, pad=pad)
    ref = _ref_conv(x, w, b, stride, pad)
    assert np.shape(out) == ref.shape, f"stride={stride}, pad={pad}: shape {np.shape(out)}, expected {ref.shape}"
    np.testing.assert_allclose(out, ref, atol=1e-10)


def test_conv_channel_mismatch_raises():
    x = np.zeros((1, 3, 5, 5))
    w = np.zeros((2, 4, 3, 3))
    with pytest.raises(ValueError):
        sub.conv2d_forward(x, w, np.zeros(2))


def test_conv_is_fast_enough():
    rng = np.random.default_rng(3)
    x, w, b = rng.standard_normal((8, 16, 32, 32)), rng.standard_normal((32, 16, 3, 3)), rng.standard_normal(32)
    start = time.perf_counter()
    out = sub.conv2d_forward(x, w, b, stride=1, pad=1)
    elapsed = time.perf_counter() - start
    assert np.shape(out) == (8, 32, 32, 32)
    assert elapsed < 2.0, f"conv2d_forward took {elapsed:.2f}s; vectorize over the batch, channels and filters"
    ref = _ref_conv(x[:1, :, :6, :6], w[:2], b[:2], 1, 1)
    np.testing.assert_allclose(sub.conv2d_forward(x[:1, :, :6, :6], w[:2], b[:2], 1, 1), ref, atol=1e-9)


# ---------------------------------------------------------------- pooling

@pytest.mark.parametrize("p,s", [(2, None), (3, 2), (2, 1)])
def test_maxpool_forward_matches_reference(p, s):
    x = np.random.default_rng(4).standard_normal((2, 3, 7, 6))
    out = sub.maxpool2d_forward(x, pool_size=p, stride=s)
    ref = _ref_pool(x, p, p if s is None else s)
    assert np.shape(out) == ref.shape, f"pool {p}, stride {s}: shape {np.shape(out)}, expected {ref.shape}"
    np.testing.assert_allclose(out, ref)


def test_maxpool_backward_routes_to_argmax():
    x = np.array([[[[1.0, 5.0, 2.0, 0.0],
                    [3.0, 4.0, 8.0, 6.0],
                    [0.0, 2.0, 1.0, 1.0],
                    [9.0, 1.0, 3.0, 7.0]]]])
    dout = np.array([[[[10.0, 20.0], [30.0, 40.0]]]])
    dx = sub.maxpool2d_backward(dout, x, pool_size=2)
    expected = np.zeros_like(x)
    expected[0, 0, 0, 1] = 10.0
    expected[0, 0, 1, 2] = 20.0
    expected[0, 0, 3, 0] = 30.0
    expected[0, 0, 3, 3] = 40.0
    np.testing.assert_array_equal(dx, expected)


def test_maxpool_backward_overlapping_windows():
    rng = np.random.default_rng(5)
    x = rng.standard_normal((2, 2, 7, 7))
    dout = rng.standard_normal((2, 2, 3, 3))
    dx = sub.maxpool2d_backward(dout, x, pool_size=3, stride=2)
    assert np.shape(dx) == x.shape
    # numerical gradient of L = sum(maxpool(x) * dout) (no ties in random data)
    h = 1e-6
    num = np.zeros_like(x)
    for idx in np.ndindex(x.shape):
        old = x[idx]
        x[idx] = old + h
        fp = np.sum(_ref_pool(x, 3, 2) * dout)
        x[idx] = old - h
        fm = np.sum(_ref_pool(x, 3, 2) * dout)
        x[idx] = old
        num[idx] = (fp - fm) / (2 * h)
    np.testing.assert_allclose(dx, num, atol=1e-6,
                               err_msg="overlapping windows can share a max: accumulate with +=, don't overwrite")
