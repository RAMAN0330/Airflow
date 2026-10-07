"""Hidden validation suite for mlp_backprop.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import numpy as np

import submission as sub


def _num_grad(f, x, h=1e-6):
    """Central-difference gradient of scalar f() w.r.t. array x (perturbed in place)."""
    grad = np.zeros_like(x)
    it = np.nditer(x, flags=["multi_index"])
    for _ in it:
        i = it.multi_index
        old = x[i]
        x[i] = old + h
        fp = f()
        x[i] = old - h
        fm = f()
        x[i] = old
        grad[i] = (fp - fm) / (2 * h)
    return grad


def _rel_err(a, b):
    return np.max(np.abs(a - b) / np.maximum(1e-8, np.abs(a) + np.abs(b)))


def _ref_ce(logits, y):
    z = logits - logits.max(axis=1, keepdims=True)
    logp = z - np.log(np.exp(z).sum(axis=1, keepdims=True))
    return -logp[np.arange(len(y)), y].mean()


def _blobs(seed=0, n_per=50):
    rng = np.random.default_rng(seed)
    centers = np.array([[0.0, 3.0], [-3.0, -2.0], [3.0, -2.0]])
    X = np.vstack([c + rng.standard_normal((n_per, 2)) for c in centers])
    y = np.repeat(np.arange(3), n_per)
    return X, y


# ---------------------------------------------------------------- linear

def test_linear_forward_values():
    rng = np.random.default_rng(0)
    x, W, b = rng.standard_normal((4, 3)), rng.standard_normal((3, 5)), rng.standard_normal(5)
    copies = (x.copy(), W.copy(), b.copy())
    out, _ = sub.linear_forward(x, W, b)
    assert np.shape(out) == (4, 5), f"linear_forward returned shape {np.shape(out)}, expected (N, M) = (4, 5)"
    np.testing.assert_allclose(out, x @ W + b, atol=1e-12)
    for a, c in zip((x, W, b), copies):
        np.testing.assert_array_equal(a, c, err_msg="linear_forward modified its inputs")


def test_linear_gradient_shapes():
    rng = np.random.default_rng(1)
    x, W, b = rng.standard_normal((6, 3)), rng.standard_normal((3, 4)), rng.standard_normal(4)
    _, cache = sub.linear_forward(x, W, b)
    dx, dW, db = sub.linear_backward(rng.standard_normal((6, 4)), cache)
    assert np.shape(dx) == x.shape, f"dx shape {np.shape(dx)}, expected {x.shape}"
    assert np.shape(dW) == W.shape, f"dW shape {np.shape(dW)}, expected {W.shape}; check which operand is transposed"
    assert np.shape(db) == b.shape, f"db shape {np.shape(db)}, expected {b.shape}; db must be summed over the batch"


def test_linear_backward_matches_numerical():
    rng = np.random.default_rng(2)
    x, W, b = rng.standard_normal((5, 3)), rng.standard_normal((3, 4)), rng.standard_normal(4)
    G = rng.standard_normal((5, 4))  # L = sum(out * G), so dL/dout = G

    def loss():
        return np.sum(sub.linear_forward(x, W, b)[0] * G)

    _, cache = sub.linear_forward(x, W, b)
    dx, dW, db = sub.linear_backward(G, cache)
    np.testing.assert_allclose(dx, _num_grad(loss, x), rtol=1e-6, atol=1e-8, err_msg="dx is wrong")
    np.testing.assert_allclose(dW, _num_grad(loss, W), rtol=1e-6, atol=1e-8, err_msg="dW is wrong")
    np.testing.assert_allclose(db, _num_grad(loss, b), rtol=1e-6, atol=1e-8, err_msg="db is wrong")


# ---------------------------------------------------------------- relu

def test_relu_forward_backward():
    x = np.array([[-2.0, -0.5, 0.5], [3.0, -1.0, 2.0]])
    x_copy = x.copy()
    out, cache = sub.relu_forward(x)
    np.testing.assert_array_equal(out, [[0.0, 0.0, 0.5], [3.0, 0.0, 2.0]])
    dout = np.arange(1.0, 7.0).reshape(2, 3)
    dx = sub.relu_backward(dout, cache)
    np.testing.assert_array_equal(dx, [[0.0, 0.0, 3.0], [4.0, 0.0, 6.0]])
    np.testing.assert_array_equal(x, x_copy, err_msg="relu_forward modified its input")


# ---------------------------------------------------------------- loss

def test_softmax_cross_entropy_loss_value():
    loss, _ = sub.softmax_cross_entropy(np.zeros((4, 5)), np.array([0, 1, 2, 3]))
    assert abs(float(loss) - np.log(5)) < 1e-12, "uniform logits over 5 classes should give loss log(5)"
    rng = np.random.default_rng(3)
    logits, y = rng.standard_normal((8, 4)), rng.integers(0, 4, 8)
    loss, dlogits = sub.softmax_cross_entropy(logits, y)
    assert np.ndim(loss) == 0, "loss should be a scalar (mean over the batch)"
    assert abs(float(loss) - _ref_ce(logits, y)) < 1e-10
    assert np.shape(dlogits) == logits.shape


def test_softmax_cross_entropy_is_stable():
    logits = np.array([[1000.0, 0.0, -1000.0], [-500.0, 500.0, 0.0]])
    loss, dlogits = sub.softmax_cross_entropy(logits, np.array([0, 1]))
    assert np.isfinite(loss) and np.all(np.isfinite(dlogits)), "loss or gradient is nan/inf; use a stable log-softmax"
    assert abs(float(loss)) < 1e-12
    loss, _ = sub.softmax_cross_entropy(logits, np.array([2, 0]))
    assert np.isfinite(loss) and abs(float(loss) - 1500.0) < 1e-6


def test_softmax_cross_entropy_gradient_numerical():
    rng = np.random.default_rng(4)
    logits, y = rng.standard_normal((7, 5)), rng.integers(0, 5, 7)
    _, dlogits = sub.softmax_cross_entropy(logits, y)
    num = _num_grad(lambda: _ref_ce(logits, y), logits)
    assert _rel_err(dlogits, num) < 1e-6, (
        f"dlogits off by a factor of about {np.abs(dlogits).sum() / np.abs(num).sum():.1f}; "
        "the loss is a mean, so its gradient is divided by the batch size")


# ---------------------------------------------------------------- MLP

def test_mlp_init_shapes_and_determinism():
    a = sub.TwoLayerMLP(4, 16, 3, seed=7)
    b = sub.TwoLayerMLP(4, 16, 3, seed=7)
    expected = {"W1": (4, 16), "b1": (16,), "W2": (16, 3), "b2": (3,)}
    assert set(a.params) == set(expected), f"params keys {sorted(a.params)}, expected {sorted(expected)}"
    for k, shape in expected.items():
        assert np.shape(a.params[k]) == shape, f"{k} has shape {np.shape(a.params[k])}, expected {shape}"
        np.testing.assert_array_equal(a.params[k], b.params[k])
    np.testing.assert_array_equal(a.params["b1"], 0.0)
    assert 0.3 < a.params["W1"].std() * np.sqrt(4 / 2) < 2.0, "W1 should be scaled by sqrt(2 / fan_in)"
    logits = a.forward(np.ones((2, 4)))
    assert np.shape(logits) == (2, 3)


def test_mlp_gradients_match_numerical():
    rng = np.random.default_rng(5)
    model = sub.TwoLayerMLP(3, 6, 4, seed=1)
    for k in ("b1", "b2"):
        model.params[k] += rng.standard_normal(model.params[k].shape) * 0.1
    x, y = rng.standard_normal((5, 3)), rng.integers(0, 4, 5)
    _, grads = model.loss_and_grads(x, y)
    assert set(grads) == set(model.params), "grads must have the same keys as params"
    for k in ("W1", "b1", "W2", "b2"):
        num = _num_grad(lambda: model.loss_and_grads(x, y)[0], model.params[k], h=1e-5)
        assert np.shape(grads[k]) == num.shape, f"grads[{k!r}] has shape {np.shape(grads[k])}, expected {num.shape}"
        np.testing.assert_allclose(grads[k], num, rtol=1e-5, atol=1e-7, err_msg=f"grads[{k!r}] is wrong")


def test_training_reduces_loss():
    X, y = _blobs()
    model = sub.TwoLayerMLP(2, 16, 3, seed=0)
    first, _ = model.loss_and_grads(X, y)
    for _ in range(150):
        loss, grads = model.loss_and_grads(X, y)
        model.sgd_step(grads, lr=0.1)
    final, _ = model.loss_and_grads(X, y)
    assert np.isfinite(final), "training diverged"
    assert final < 0.25 * first, f"loss went from {first:.3f} to {final:.3f}; expected at least a 4x drop"
    acc = np.mean(model.forward(X).argmax(axis=1) == y)
    assert acc > 0.95, f"training accuracy {acc:.2f} on separable blobs"
