"""2-D convolution (cross-correlation) with stride and padding, plus max-pooling forward and backward. NumPy only."""
import numpy as np


def conv_output_size(in_size, kernel, stride=1, pad=0):
    """Number of output positions along one spatial axis.

    Raise ValueError if the kernel is larger than the padded input.
    """
    # TODO: floor((in + 2·pad − kernel) / stride) + 1
    raise NotImplementedError


def pad_input(x, pad):
    """Zero-pad the two spatial axes of x (N, C, H, W) by `pad` on every side -> (N, C, H+2p, W+2p)."""
    # TODO: np.pad with a pad width per axis. Batch and channel axes get (0, 0).
    raise NotImplementedError


def conv2d_forward(x, w, b, stride=1, pad=0):
    """Cross-correlate x (N, C, H, W) with w (F, C, KH, KW) and add b (F,).

    out[n, f, i, j] = b[f] + Σ_c Σ_u Σ_v xp[n, c, i·stride + u, j·stride + v] · w[f, c, u, v]
    where xp is x zero-padded by `pad`. Returns (N, F, H_out, W_out).
    Raise ValueError if x and w disagree on the number of channels.
    Must be vectorized enough to run a (8, 16, 32, 32) input with 32 3×3 filters well under a second.
    """
    # TODO: pad, gather patches (im2col or a loop over output positions), multiply by the weights.
    raise NotImplementedError


def maxpool2d_forward(x, pool_size=2, stride=None):
    """Max over each pool_size × pool_size window of x (N, C, H, W). stride defaults to pool_size. No padding."""
    # TODO
    raise NotImplementedError


def maxpool2d_backward(dout, x, pool_size=2, stride=None):
    """Route each dout[n, c, i, j] to the position of its window's max in x (first max on ties).

    Returns dx with the shape of x. Windows can overlap when stride < pool_size: accumulate.
    """
    # TODO
    raise NotImplementedError
