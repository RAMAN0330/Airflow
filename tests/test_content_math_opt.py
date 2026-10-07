"""Bug-injection checks for the math_opt content group: each realistic bug must be caught by a specific hidden test."""
import ast
import json
from pathlib import Path

import pytest

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
EXERCISES = ["least_squares_qr", "mini_autograd", "optimizers_from_scratch"]


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(exercise, old, new):
    src = (EX / exercise / "solution.py").read_text()
    buggy = src.replace(old, new)
    assert buggy != src, f"mutation {old!r} did not apply"
    return buggy


def _assert_caught(exercise, buggy, test_name):
    r, failed = _failed(buggy, EX / exercise)
    assert r["status"] == "failed"
    assert test_name in failed


@pytest.mark.parametrize("exercise", EXERCISES)
def test_solution_passes_and_starter_fails(exercise):
    ex = EX / exercise
    r = grade((ex / "solution.py").read_text(), ex)
    assert r["status"] == "passed" and r["passed_tests"] == r["total_tests"]
    r = grade((ex / "starter.py").read_text(), ex)
    assert r["status"] == "failed" and r["passed_tests"] == 0


@pytest.mark.parametrize("exercise", EXERCISES)
def test_hints_match_tests(exercise):
    meta = json.loads((EX / exercise / "exercise.json").read_text())
    tree = ast.parse((EX / exercise / "tests_hidden.py").read_text())
    names = {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}
    assert set(meta["hints"]) == names
    assert meta["id"] == exercise


# --- least_squares_qr -------------------------------------------------------------------------------

def test_householder_wrong_sign_is_caught():
    # Reflecting onto +sign(x0)‖x‖e1 makes v[0] = x0 − ‖x‖ cancel when x already points along +e1.
    buggy = _mutate("least_squares_qr", "alpha = -np.copysign(normx, x[0])", "alpha = np.copysign(normx, x[0])")
    _assert_caught("least_squares_qr", buggy, "test_householder_nearly_triangular_input")


def test_back_substitution_top_down_is_caught():
    buggy = _mutate("least_squares_qr", "for i in reversed(range(n)):", "for i in range(n):")
    _assert_caught("least_squares_qr", buggy, "test_back_substitution_known_system")


def test_using_numpy_qr_is_caught():
    buggy = _mutate(
        "least_squares_qr",
        "def qr_least_squares(A, b):\n",
        "def qr_least_squares(A, b):\n    return np.linalg.lstsq(A, b, rcond=None)[0]\n",
    )
    _assert_caught("least_squares_qr", buggy, "test_qr_does_not_call_numpy_solvers")


# --- mini_autograd ----------------------------------------------------------------------------------

def test_gradient_overwrite_is_caught():
    buggy = _mutate(
        "mini_autograd",
        "            self.grad += out.grad\n            other.grad += out.grad",
        "            self.grad = out.grad\n            other.grad = out.grad",
    )
    _assert_caught("mini_autograd", buggy, "test_reused_node_accumulates")


def test_wrong_power_rule_is_caught():
    buggy = _mutate("mini_autograd", "exponent * self.data ** (exponent - 1) * out.grad",
                    "self.data ** (exponent - 1) * out.grad")
    _assert_caught("mini_autograd", buggy, "test_power_rule")


def test_backward_without_topological_order_is_caught():
    # Breadth-first from the output looks plausible but can run a node before all its consumers finish.
    bfs = (
        "        topo, queue, seen = [], [self], {id(self)}\n"
        "        while queue:\n"
        "            node = queue.pop(0)\n"
        "            topo.append(node)\n"
        "            for child in node._prev:\n"
        "                if id(child) not in seen:\n"
        "                    seen.add(id(child))\n"
        "                    queue.append(child)\n"
        "        self.grad = 1.0\n"
        "        for node in topo:\n"
    )
    buggy = _mutate("mini_autograd", "        topo = self._topo()\n        self.grad = 1.0\n        for node in reversed(topo):\n", bfs)
    _assert_caught("mini_autograd", buggy, "test_deep_graph_needs_topological_order")


# --- optimizers_from_scratch ------------------------------------------------------------------------

def test_missing_bias_correction_is_caught():
    buggy = _mutate("optimizers_from_scratch", 'm_hat = s["m"] / (1 - self.beta1 ** self.t)', 'm_hat = s["m"]')
    buggy = buggy.replace('v_hat = s["v"] / (1 - self.beta2 ** self.t)', 'v_hat = s["v"]')
    _assert_caught("optimizers_from_scratch", buggy, "test_adam_bias_correction_first_steps")


def test_adamw_using_l2_is_caught():
    buggy = _mutate("optimizers_from_scratch", "class AdamW(Adam):\n    decoupled = True", "class AdamW(Adam):\n    decoupled = False")
    _assert_caught("optimizers_from_scratch", buggy, "test_adamw_decay_is_decoupled")


def test_warmup_off_by_one_is_caught():
    buggy = _mutate("optimizers_from_scratch", "return base_lr * step / warmup_steps", "return base_lr * (step + 1) / warmup_steps")
    _assert_caught("optimizers_from_scratch", buggy, "test_cosine_warmup_schedule")


def test_in_place_l2_mutating_grads_is_caught():
    buggy = _mutate("optimizers_from_scratch", "g = g + self.weight_decay * p          # L2", "g += self.weight_decay * p          # L2")
    _assert_caught("optimizers_from_scratch", buggy, "test_step_updates_in_place_and_keeps_grads")
