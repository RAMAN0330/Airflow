"""Bug-injection tests for the deep-learning modules: each realistic mistake must be caught by a specific hidden test."""
from pathlib import Path

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(exercise, old, new):
    src = (EX / exercise / "solution.py").read_text()
    buggy = src.replace(old, new)
    assert buggy != src, f"mutation {old!r} did not apply"
    return buggy


# ---------------------------------------------------------------- mlp_backprop

def test_mlp_dw_missing_transpose_is_caught():
    buggy = _mutate("mlp_backprop", "x.T @ dout", "dout.T @ x")
    r, failed = _failed(buggy, EX / "mlp_backprop")
    assert r["status"] == "failed"
    assert {"test_linear_gradient_shapes", "test_linear_backward_matches_numerical"} <= failed
    assert "ShapeMismatch" in r["error_tags"]


def test_mlp_db_not_summed_is_caught():
    buggy = _mutate("mlp_backprop", "db = dout.sum(axis=0)", "db = dout")
    r, failed = _failed(buggy, EX / "mlp_backprop")
    assert r["status"] == "failed"
    assert "test_linear_gradient_shapes" in failed


def test_mlp_loss_grad_not_divided_by_batch_is_caught():
    buggy = _mutate("mlp_backprop", "(probs - onehot) / N", "(probs - onehot)")
    r, failed = _failed(buggy, EX / "mlp_backprop")
    assert r["status"] == "failed"
    assert {"test_softmax_cross_entropy_gradient_numerical", "test_mlp_gradients_match_numerical"} <= failed
    assert "test_softmax_cross_entropy_loss_value" not in failed


# ---------------------------------------------------------------- conv2d_pooling

def test_conv_kernel_flip_is_caught():
    buggy = _mutate("conv2d_pooling", "w.reshape(F, -1)", "w[:, :, ::-1, ::-1].reshape(F, -1)")
    r, failed = _failed(buggy, EX / "conv2d_pooling")
    assert r["status"] == "failed"
    assert {"test_conv_is_cross_correlation", "test_conv_matches_naive_reference"} <= failed
    assert "test_output_size_formula" not in failed


def test_conv_wrong_output_size_with_stride_is_caught():
    buggy = _mutate("conv2d_pooling", "(in_size + 2 * pad - kernel) // stride + 1",
                    "(in_size + 2 * pad - kernel + 1) // stride")
    r, failed = _failed(buggy, EX / "conv2d_pooling")
    assert r["status"] == "failed"
    assert {"test_output_size_formula", "test_conv_stride_and_padding"} <= failed
    assert "test_conv_matches_naive_reference" not in failed  # stride 1 still works


def test_maxpool_backward_overwrite_is_caught():
    buggy = _mutate("conv2d_pooling", "dx[n_idx, c_idx, r0 + r, c0 + c] +=", "dx[n_idx, c_idx, r0 + r, c0 + c] =")
    r, failed = _failed(buggy, EX / "conv2d_pooling")
    assert r["status"] == "failed"
    assert failed == {"test_maxpool_backward_overlapping_windows"}


# ---------------------------------------------------------------- rnn_lstm_cell

def test_per_tensor_clipping_is_caught():
    buggy = _mutate("rnn_lstm_cell", "return [g * scale for g in grads], total",
                    "return [g * min(1.0, max_norm / max(float(np.linalg.norm(g)), 1e-12)) for g in grads], total")
    r, failed = _failed(buggy, EX / "rnn_lstm_cell")
    assert r["status"] == "failed"
    assert "test_clip_grad_norm_uses_global_norm" in failed


def test_lstm_candidate_sigmoid_is_caught():
    buggy = _mutate("rnn_lstm_cell", "g = np.tanh(a[:, 2 * H:3 * H])", "g = sigmoid(a[:, 2 * H:3 * H])")
    r, failed = _failed(buggy, EX / "rnn_lstm_cell")
    assert r["status"] == "failed"
    assert {"test_lstm_step_matches_reference", "test_lstm_gate_semantics"} <= failed


def test_rnn_hidden_state_not_carried_is_caught():
    buggy = _mutate("rnn_lstm_cell", "rnn_step(x[:, t, :], h, Wx", "rnn_step(x[:, t, :], h0, Wx")
    r, failed = _failed(buggy, EX / "rnn_lstm_cell")
    assert r["status"] == "failed"
    assert {"test_rnn_forward_matches_reference", "test_rnn_hidden_state_is_carried"} <= failed
    assert "test_rnn_step_matches_reference" not in failed
