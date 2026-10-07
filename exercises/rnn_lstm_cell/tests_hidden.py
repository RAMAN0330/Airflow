"""Hidden validation suite for rnn_lstm_cell.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import warnings

import numpy as np

import submission as sub


def _sig(x):
    return 1.0 / (1.0 + np.exp(-x))


def _ref_rnn(x, h0, Wx, Wh, b):
    h, hs = h0, []
    for t in range(x.shape[1]):
        h = np.tanh(x[:, t] @ Wx + h @ Wh + b)
        hs.append(h)
    return np.stack(hs, axis=1)


def _ref_lstm_step(x_t, h, c, Wx, Wh, b):
    H = h.shape[1]
    a = x_t @ Wx + h @ Wh + b
    i, f, g, o = (a[:, k * H:(k + 1) * H] for k in range(4))
    c = _sig(f) * c + _sig(i) * np.tanh(g)
    return _sig(o) * np.tanh(c), c


def _rnn_params(seed, N=3, T=5, D=4, H=6):
    rng = np.random.default_rng(seed)
    return (rng.standard_normal((N, T, D)), rng.standard_normal((N, H)) * 0.5,
            rng.standard_normal((D, H)) * 0.5, rng.standard_normal((H, H)) * 0.4, rng.standard_normal(H) * 0.1)


def _lstm_params(seed, N=3, D=4, H=5):
    rng = np.random.default_rng(seed)
    return (rng.standard_normal((N, D)), rng.standard_normal((N, H)), rng.standard_normal((N, H)),
            rng.standard_normal((D, 4 * H)) * 0.5, rng.standard_normal((H, 4 * H)) * 0.5, rng.standard_normal(4 * H) * 0.5)


# ---------------------------------------------------------------- sigmoid

def test_sigmoid_values_and_stability():
    x = np.linspace(-6, 6, 13)
    np.testing.assert_allclose(sub.sigmoid(x), _sig(x), atol=1e-12)
    assert sub.sigmoid(np.array([0.0]))[0] == 0.5
    with warnings.catch_warnings():
        warnings.simplefilter("error")
        s = sub.sigmoid(np.array([-1000.0, 1000.0]))
    np.testing.assert_allclose(s, [0.0, 1.0], atol=1e-12)


# ---------------------------------------------------------------- vanilla RNN

def test_rnn_step_matches_reference():
    x, h0, Wx, Wh, b = _rnn_params(0)
    h = sub.rnn_step(x[:, 0], h0, Wx, Wh, b)
    assert np.shape(h) == h0.shape, f"rnn_step returned {np.shape(h)}, expected (N, H) = {h0.shape}"
    np.testing.assert_allclose(h, np.tanh(x[:, 0] @ Wx + h0 @ Wh + b), atol=1e-12)


def test_rnn_forward_matches_reference():
    x, h0, Wx, Wh, b = _rnn_params(1)
    copies = [a.copy() for a in (x, h0, Wx, Wh, b)]
    hs = sub.rnn_forward(x, h0, Wx, Wh, b)
    assert np.shape(hs) == (3, 5, 6), f"rnn_forward returned {np.shape(hs)}, expected (N, T, H) = (3, 5, 6)"
    np.testing.assert_allclose(hs, _ref_rnn(x, h0, Wx, Wh, b), atol=1e-12)
    for a, c in zip((x, h0, Wx, Wh, b), copies):
        np.testing.assert_array_equal(a, c, err_msg="rnn_forward modified its inputs")


def test_rnn_hidden_state_is_carried():
    x, h0, Wx, Wh, b = _rnn_params(2)
    hs = sub.rnn_forward(x, h0, Wx, Wh, b)
    x2 = x.copy()
    x2[:, 0] += 1.0  # change only the first input
    hs2 = sub.rnn_forward(x2, h0, Wx, Wh, b)
    assert not np.allclose(hs[:, -1], hs2[:, -1]), (
        "changing x at t=0 didn't affect the last hidden state; feed h_t into step t+1, not h0")
    hs3 = sub.rnn_forward(x, h0 + 1.0, Wx, Wh, b)
    assert not np.allclose(hs[:, -1], hs3[:, -1]), "the last hidden state ignores h0"


def test_rnn_backward_matches_numerical():
    x, h0, Wx, Wh, b = _rnn_params(3, N=2, T=4, D=3, H=4)
    G = np.random.default_rng(30).standard_normal((2, 4, 4))
    grads = sub.rnn_backward(G, x, h0, Wx, Wh, b)
    arrays = {"x": x, "h0": h0, "Wx": Wx, "Wh": Wh, "b": b}
    assert set(grads) == set(arrays), f"rnn_backward keys {sorted(grads)}, expected {sorted(arrays)}"
    h = 1e-6
    for name, arr in arrays.items():
        num = np.zeros_like(arr)
        for idx in np.ndindex(arr.shape):
            old = arr[idx]
            arr[idx] = old + h
            fp = np.sum(_ref_rnn(x, h0, Wx, Wh, b) * G)
            arr[idx] = old - h
            fm = np.sum(_ref_rnn(x, h0, Wx, Wh, b) * G)
            arr[idx] = old
            num[idx] = (fp - fm) / (2 * h)
        assert np.shape(grads[name]) == arr.shape, f"grad {name!r} shape {np.shape(grads[name])}, expected {arr.shape}"
        np.testing.assert_allclose(grads[name], num, rtol=1e-5, atol=1e-7, err_msg=f"gradient for {name!r} is wrong")


# ---------------------------------------------------------------- LSTM

def test_lstm_step_matches_reference():
    x, h, c, Wx, Wh, b = _lstm_params(4)
    h1, c1 = sub.lstm_step(x, h, c, Wx, Wh, b)
    rh, rc = _ref_lstm_step(x, h, c, Wx, Wh, b)
    assert np.shape(h1) == h.shape and np.shape(c1) == c.shape
    np.testing.assert_allclose(c1, rc, atol=1e-12, err_msg="cell state is wrong; check gate order i, f, g, o")
    np.testing.assert_allclose(h1, rh, atol=1e-12)


def test_lstm_gate_semantics():
    N, D, H = 2, 3, 4
    x = np.random.default_rng(5).standard_normal((N, D))
    h = np.random.default_rng(6).standard_normal((N, H))
    c = np.random.default_rng(7).standard_normal((N, H))
    Wx, Wh = np.zeros((D, 4 * H)), np.zeros((H, 4 * H))
    # input gate closed, forget gate open, output gate open: the cell is copied through
    b = np.concatenate([np.full(H, -50.0), np.full(H, 50.0), np.zeros(H), np.full(H, 50.0)])
    h1, c1 = sub.lstm_step(x, h, c, Wx, Wh, b)
    np.testing.assert_allclose(c1, c, atol=1e-12, err_msg="with i≈0 and f≈1 the cell should be unchanged")
    np.testing.assert_allclose(h1, np.tanh(c), atol=1e-12)
    # forget everything, write the candidate: g = tanh(-50) = -1 (a sigmoid would give 0)
    b = np.concatenate([np.full(H, 50.0), np.full(H, -50.0), np.full(H, -50.0), np.full(H, 50.0)])
    h1, c1 = sub.lstm_step(x, h, c, Wx, Wh, b)
    np.testing.assert_allclose(c1, -1.0, atol=1e-12, err_msg="candidate g must use tanh, giving values in (-1, 1)")
    np.testing.assert_allclose(h1, np.tanh(-1.0), atol=1e-12)


def test_lstm_forward_unrolls_sequence():
    rng = np.random.default_rng(8)
    N, T, D, H = 2, 6, 3, 4
    x = rng.standard_normal((N, T, D))
    h0, c0 = rng.standard_normal((N, H)), rng.standard_normal((N, H))
    Wx, Wh, b = rng.standard_normal((D, 4 * H)) * 0.5, rng.standard_normal((H, 4 * H)) * 0.5, rng.standard_normal(4 * H)
    hs, cT = sub.lstm_forward(x, h0, c0, Wx, Wh, b)
    assert np.shape(hs) == (N, T, H), f"hs shape {np.shape(hs)}, expected (N, T, H) = {(N, T, H)}"
    h, c, ref = h0, c0, []
    for t in range(T):
        h, c = _ref_lstm_step(x[:, t], h, c, Wx, Wh, b)
        ref.append(h)
    np.testing.assert_allclose(hs, np.stack(ref, axis=1), atol=1e-12,
                               err_msg="hidden states differ; carry both h and c from step to step")
    np.testing.assert_allclose(cT, c, atol=1e-12, err_msg="return the final cell state c_T")


# ---------------------------------------------------------------- clipping

def test_clip_grad_norm_uses_global_norm():
    g1 = np.full((2, 2), 3.0)   # norm 6
    g2 = np.array([8.0])        # norm 8, global norm 10
    clipped, total = sub.clip_grad_norm([g1, g2], max_norm=5.0)
    assert abs(total - 10.0) < 1e-12, f"total norm {total}, expected sqrt(6² + 8²) = 10"
    np.testing.assert_allclose(clipped[0], g1 * 0.5, atol=1e-12)
    np.testing.assert_allclose(clipped[1], g2 * 0.5, atol=1e-12,
                               err_msg="every array is scaled by the same factor max_norm / global_norm")
    new_total = np.sqrt(sum(np.sum(c ** 2) for c in clipped))
    assert abs(new_total - 5.0) < 1e-9


def test_clip_grad_norm_noop_below_threshold_and_no_mutation():
    rng = np.random.default_rng(9)
    grads = [rng.standard_normal((3, 4)), rng.standard_normal(5)]
    copies = [g.copy() for g in grads]
    big = float(np.sqrt(sum(np.sum(g ** 2) for g in grads)))
    clipped, total = sub.clip_grad_norm(grads, max_norm=big + 1.0)
    assert abs(total - big) < 1e-12
    for c, g in zip(clipped, copies):
        np.testing.assert_array_equal(c, g)
    sub.clip_grad_norm(grads, max_norm=0.1)
    for g, c in zip(grads, copies):
        np.testing.assert_array_equal(g, c, err_msg="clip_grad_norm must return new arrays, not scale in place")
