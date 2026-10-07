"""Vanilla RNN and LSTM forward passes, backprop through time for the RNN, and global-norm gradient clipping. NumPy only."""
import numpy as np


def sigmoid(x):
    """Logistic function 1 / (1 + e^-x), element-wise, without overflow warnings for large |x|."""
    # TODO: hint: 0.5 * (1 + tanh(x / 2)) is the same function.
    raise NotImplementedError


def rnn_step(x_t, h_prev, Wx, Wh, b):
    """One vanilla RNN step: h_t = tanh(x_t @ Wx + h_prev @ Wh + b).

    x_t: (N, D), h_prev: (N, H), Wx: (D, H), Wh: (H, H), b: (H,) -> h_t: (N, H)
    """
    # TODO
    raise NotImplementedError


def rnn_forward(x, h0, Wx, Wh, b):
    """Run the RNN over x: (N, T, D) starting from h0: (N, H). Return every hidden state, (N, T, H)."""
    # TODO: loop over time, feeding each step's output in as the next step's h_prev.
    raise NotImplementedError


def rnn_backward(dhs, x, h0, Wx, Wh, b):
    """Backprop through time for rnn_forward.

    dhs: (N, T, H) = dL/dh_t for every time step (the loss may read every hidden state).
    Return {"x": dx, "h0": dh0, "Wx": dWx, "Wh": dWh, "b": db}, each shaped like its input.
    """
    # TODO: recompute the forward pass, then walk t = T-1 ... 0 carrying dh_next backwards.
    raise NotImplementedError


def lstm_step(x_t, h_prev, c_prev, Wx, Wh, b):
    """One LSTM step. Returns (h_t, c_t), each (N, H).

    Wx: (D, 4H), Wh: (H, 4H), b: (4H,). The pre-activation a = x_t @ Wx + h_prev @ Wh + b
    is split into four blocks of width H in the order i, f, g, o (same as PyTorch):
        i = σ(a[:, 0:H])     input gate
        f = σ(a[:, H:2H])    forget gate
        g = tanh(a[:, 2H:3H]) candidate cell
        o = σ(a[:, 3H:4H])   output gate
        c_t = f * c_prev + i * g
        h_t = o * tanh(c_t)
    """
    # TODO
    raise NotImplementedError


def lstm_forward(x, h0, c0, Wx, Wh, b):
    """Unroll lstm_step over x: (N, T, D). Return (hs (N, T, H), c_T (N, H))."""
    # TODO
    raise NotImplementedError


def clip_grad_norm(grads, max_norm):
    """Clip a list of gradient arrays by their GLOBAL L2 norm.

    total = sqrt(Σ over every array of Σ g²). If total > max_norm, multiply every array by
    max_norm / total; otherwise leave them unchanged. Return (new_list, total) and never modify the inputs.
    """
    # TODO
    raise NotImplementedError
