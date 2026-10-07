"""Vanilla RNN and LSTM forward passes, backprop through time for the RNN, and global-norm gradient clipping. NumPy only."""
import numpy as np


def sigmoid(x):
    # 0.5·(1 + tanh(x/2)) is exactly the logistic function and never overflows.
    return 0.5 * (1.0 + np.tanh(0.5 * x))


def rnn_step(x_t, h_prev, Wx, Wh, b):
    return np.tanh(x_t @ Wx + h_prev @ Wh + b)


def rnn_forward(x, h0, Wx, Wh, b):
    N, T, _ = x.shape
    hs = np.zeros((N, T, h0.shape[1]))
    h = h0
    for t in range(T):
        h = rnn_step(x[:, t, :], h, Wx, Wh, b)
        hs[:, t, :] = h
    return hs


def rnn_backward(dhs, x, h0, Wx, Wh, b):
    hs = rnn_forward(x, h0, Wx, Wh, b)
    T = x.shape[1]
    dx = np.zeros_like(x, dtype=float)
    dWx, dWh, db = np.zeros_like(Wx), np.zeros_like(Wh), np.zeros_like(b)
    dh_next = np.zeros_like(h0, dtype=float)
    for t in reversed(range(T)):
        h_prev = hs[:, t - 1, :] if t > 0 else h0
        da = (dhs[:, t, :] + dh_next) * (1.0 - hs[:, t, :] ** 2)
        dx[:, t, :] = da @ Wx.T
        dWx += x[:, t, :].T @ da
        dWh += h_prev.T @ da
        db += da.sum(axis=0)
        dh_next = da @ Wh.T
    return {"x": dx, "h0": dh_next, "Wx": dWx, "Wh": dWh, "b": db}


def lstm_step(x_t, h_prev, c_prev, Wx, Wh, b):
    H = h_prev.shape[1]
    a = x_t @ Wx + h_prev @ Wh + b
    i = sigmoid(a[:, :H])
    f = sigmoid(a[:, H:2 * H])
    g = np.tanh(a[:, 2 * H:3 * H])
    o = sigmoid(a[:, 3 * H:])
    c = f * c_prev + i * g
    h = o * np.tanh(c)
    return h, c


def lstm_forward(x, h0, c0, Wx, Wh, b):
    N, T, _ = x.shape
    hs = np.zeros((N, T, h0.shape[1]))
    h, c = h0, c0
    for t in range(T):
        h, c = lstm_step(x[:, t, :], h, c, Wx, Wh, b)
        hs[:, t, :] = h
    return hs, c


def clip_grad_norm(grads, max_norm):
    total = float(np.sqrt(sum(np.sum(np.square(g)) for g in grads)))
    scale = max_norm / total if total > max_norm else 1.0
    return [g * scale for g in grads], total
