"""2-D convolution (cross-correlation) with stride and padding, plus max-pooling forward and backward. NumPy only."""
import numpy as np
from numpy.lib.stride_tricks import sliding_window_view


def conv_output_size(in_size, kernel, stride=1, pad=0):
    if kernel > in_size + 2 * pad:
        raise ValueError("kernel is larger than the padded input")
    return (in_size + 2 * pad - kernel) // stride + 1


def pad_input(x, pad):
    return np.pad(x, ((0, 0), (0, 0), (pad, pad), (pad, pad)), mode="constant")


def conv2d_forward(x, w, b, stride=1, pad=0):
    N, C, H, W = x.shape
    F, Cw, KH, KW = w.shape
    if C != Cw:
        raise ValueError("input channels do not match weight channels")
    Ho = conv_output_size(H, KH, stride, pad)
    Wo = conv_output_size(W, KW, stride, pad)
    xp = pad_input(x, pad)
    windows = sliding_window_view(xp, (KH, KW), axis=(2, 3))[:, :, ::stride, ::stride]
    # im2col: one row per output position, one column per (c, kh, kw) weight.
    cols = windows.transpose(0, 2, 3, 1, 4, 5).reshape(N * Ho * Wo, C * KH * KW)
    out = cols @ w.reshape(F, -1).T + b
    return out.reshape(N, Ho, Wo, F).transpose(0, 3, 1, 2)


def maxpool2d_forward(x, pool_size=2, stride=None):
    stride = pool_size if stride is None else stride
    windows = sliding_window_view(x, (pool_size, pool_size), axis=(2, 3))[:, :, ::stride, ::stride]
    return windows.max(axis=(-2, -1))


def maxpool2d_backward(dout, x, pool_size=2, stride=None):
    stride = pool_size if stride is None else stride
    N, C, _, _ = x.shape
    Ho, Wo = dout.shape[2], dout.shape[3]
    dx = np.zeros_like(x, dtype=float)
    n_idx, c_idx = np.meshgrid(np.arange(N), np.arange(C), indexing="ij")
    for i in range(Ho):
        for j in range(Wo):
            r0, c0 = i * stride, j * stride
            window = x[:, :, r0:r0 + pool_size, c0:c0 + pool_size].reshape(N, C, -1)
            r, c = np.divmod(window.argmax(axis=-1), pool_size)
            dx[n_idx, c_idx, r0 + r, c0 + c] += dout[:, :, i, j]
    return dx
