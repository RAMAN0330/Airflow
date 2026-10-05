# ML/AI Practice Platform: Exercises & Grading Engine

This is the first slice of the interactive ML/AI practice platform. It contains
two foundational exercises (one per end of the syllabus) and the grading engine
that runs a learner's code against hidden tests. The engine returns the JSON
payload the frontend renders.

```
exercises/
  linear_regression_gd/     Phase 1: Linear & Ridge regression via gradient descent
  self_attention_head/      Phase 3: scaled dot-product self-attention head
    exercise.json           metadata: phase, DAG prerequisites, limits, remediation map
    task.md                 learner-facing spec
    starter.py              template shown in the editor
    solution.py             reference solution (never shipped to learners)
    tests_hidden.py         hidden validation suite (never shipped to learners)
grader/
  run.py                    grading engine + CLI
  _pytest_plugin.py         dropped into the sandbox as conftest.py to collect results
tests/
  test_grader.py            end-to-end tests: solutions pass, known bugs get caught
```

## Quick start

```bash
pip install -r requirements.txt
python -m grader.run exercises/linear_regression_gd exercises/linear_regression_gd/solution.py
python -m pytest            # grader + exercise-suite tests
```

## Grading pipeline

1. **Ingestion.** `grade(submission_code, exercise_dir)` receives the editor buffer as a string.
2. **Injection.** The engine creates a fresh temp sandbox containing `submission.py`
   (the learner's code), `test_hidden.py` and a result-collecting `conftest.py`.
   The hidden tests sit in a separate module that imports `submission`, rather
   than being appended to the learner's file, so learner code cannot shadow test
   helpers and tracebacks keep accurate line numbers.
3. **Execution.** Pytest runs in a subprocess with a minimal environment, its own
   process group, and rlimits (CPU seconds, address space, file size) taken
   from `exercise.json`. It also has a wall-clock timeout that kills the whole
   group. These limits stand in locally for the pod's cgroup limits.
4. **Payload.** The engine returns:

```json
{
  "exercise_id": "self_attention_head",
  "status": "failed",            // passed | failed | error | timeout
  "passed_tests": 13,
  "total_tests": 14,
  "score": 0.9286,
  "tests": [{"name": "...", "outcome": "failed", "error_type": "ValueError",
             "message": "matmul: Input operand 1 has a mismatch ...", "duration_ms": 0.4}],
  "stdout": "learner print() output",
  "stderr": "collection errors / tracebacks",
  "duration_ms": 910,
  "error_tags": ["ShapeMismatch"],
  "remediation": ["linear_transform_sandbox"]
}
```

`error_tags` / `remediation` are the hooks for the adaptive layer. Failure
messages are matched against known signatures, such as shape mismatches,
NaN/overflow and non-convergence. A match maps to the step-back sandbox
declared in the exercise's `exercise.json`.

## Exercise design

Each hidden suite checks **properties**, not just a single expected output. That
way a correct implementation passes regardless of style, and the common bugs
each fail a specific, explainable test:

| Bug | Caught by |
|---|---|
| Gradient sign flipped / LR too high | `test_cost_history_length_and_monotonic`, `test_converges_to_closed_form` |
| Wrong derivative | `test_gradients_match_finite_differences` |
| Regularizing the bias | `test_bias_is_not_regularized` |
| Calling `lstsq` / `inv` instead of descending | `test_no_forbidden_solvers` |
| `K.T` instead of `swapaxes` (breaks batching) | `test_attention_batched_matches_reference` |
| Missing `1/√d_k` | `test_scaling_by_sqrt_dk_is_applied` |
| Unstable softmax | `test_softmax_is_numerically_stable` |
| Causal mask leaks future tokens | `test_causal_head_ignores_future_tokens` |

`tests/test_grader.py` injects each of these bugs into the reference solution
and asserts the right test fails, so the suites stay honest as they evolve.

## Production hardening (not in this slice)

The local runner is a reference implementation. The learner's code runs in the
same process and directory as the hidden tests, so a determined learner could
read the tests or tamper with the results file. In the Kubernetes execution
plane:

- Run the hidden suite from a read-only mount the learner's UID cannot read, and
  return results over the pod's stdout/exit channel instead of a writable file.
- Turn off networking (NetworkPolicy deny-all), run as non-root with a read-only
  root FS and seccomp/gVisor, and enforce limits with cgroups rather than rlimits.
- Use one disposable pod (or a pod reset from a warm snapshot) per submission.
