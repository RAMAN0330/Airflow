# Gradient: ML/AI Practice Platform

Gradient is an interactive platform where learners implement machine-learning
algorithms from scratch. Each exercise has hidden tests that run in a sandbox,
and a prerequisite graph unlocks exercises as the learner progresses.

| Layer | Stack |
|---|---|
| Frontend (`web/`) | Next.js 16 (App Router), React 19, Tailwind CSS v4, **shadcn/ui** (Radix), **Zustand**, Monaco editor |
| Control plane (`api/`) | FastAPI, SQLite (WAL), Pydantic |
| Execution plane (`grader/`) | pytest in a resource-limited subprocess (CPU / memory / file-size rlimits, wall-clock kill) |
| Content (`exercises/`) | Task Markdown, starter, reference solution, hidden tests, metadata and hints |

```
Browser ──► Next.js (web) ──/api/* rewrite──► FastAPI (api) ──► grader ──► sandboxed pytest subprocess
               │ Zustand stores                     │ SQLite: submissions → progress, DAG unlocks
               │ Monaco (self-hosted)               └ catalog: exercises + curriculum.json (validated DAG)
```

## Quick start

**Docker:**

```bash
docker compose up --build        # http://localhost:3000
```

**Local dev:**

```bash
pip install -r requirements.txt
cd web && npm install && cd ..
make api     # FastAPI on :8000 (in one terminal)
make web     # Next.js on :3000, proxies /api to :8000 (in another)
make check   # pytest + typecheck + lint
```

## Product tour

- **Roadmap (`/`):** a three-phase curriculum (Classical ML → Deep Learning →
  GenAI/LLMs). Each module card shows its status (available, in progress,
  completed, locked), best score, difficulty and time estimate. Locked cards
  name their missing prerequisites. Modules not built yet are shown as
  *coming soon*. The progress card shows a "Continue" button for the next
  exercise.
- **Workspace (`/exercises/[id]`):** resizable three-pane IDE. It has the task
  description (GFM Markdown) next to the Monaco editor, and a results panel
  below it.
  - Run with **Ctrl/Cmd+Enter**.
  - Results show a per-test pass/fail matrix with the exception type, a hint
    for each failing test, and *mentor tips* that can link back to a
    foundational exercise.
  - Output and Errors tabs show the learner's stdout and stderr.
  - Drafts autosave per exercise. Every attempt is kept in Submissions and can
    be restored in one click. Reset to starter asks for confirmation first.
  - Passing an exercise shows a toast that offers to open the newly unlocked
    exercise.
  - Below 1024px the workspace switches to a tabbed Task / Code / Results layout.
- **Progress (`/progress`):** stat cards (completed, submissions, pass rate,
  day streak), a 12-week activity heatmap, a per-exercise table and recent
  submissions.
- Light, dark and system themes. Loading skeletons, empty states and error
  states with retry.

## Frontend state (Zustand)

| Store | Persisted | Holds |
|---|---|---|
| `user-store` | localStorage | Anonymous learner ID, sent as `X-User-Id` |
| `editor-store` | localStorage | Per-exercise drafts, font size, minimap |
| `catalog-store` | no | Curriculum and progress, with load states; invalidated after each run |
| `workspace-store` | no | Open exercise, submission history, the run in flight, latest result, active tabs |

shadcn/ui components live in `web/src/components/ui/` (`components.json` is
configured, so `npx shadcn add <component>` works). Monaco is copied from
`node_modules` into `public/monaco` at install/build time, so the editor needs
no CDN.

## API

All routes take an `X-User-Id` header (8–64 characters of `[A-Za-z0-9_-]`).

| Method | Path | Description |
|---|---|---|
| GET | `/api/health` | Liveness |
| GET | `/api/curriculum` | Phases → modules → exercise summaries with per-user status |
| GET | `/api/exercises/{id}` | Task Markdown, starter code, prerequisites and unlocks with status |
| GET | `/api/exercises/{id}/submissions` | This user's attempts, newest first, with code and results |
| POST | `/api/exercises/{id}/submissions` | Grade `{code}`; returns the result plus `newly_completed` and `unlocked`. Returns `403` if locked, `429` if a run is already in flight, `422` if the code is over 100 KB |
| GET | `/api/progress` | Counts, pass rate, per-exercise rows, recent submissions, daily activity, next up |

The catalog checks at startup that every prerequisite and remediation link
points to a real exercise and that the prerequisite graph has no cycles.
Concurrent grading is capped by `MAX_CONCURRENT_RUNS` (default 4).

## Exercises

| Phase | Exercise | Prerequisite | Hidden tests |
|---|---|---|---|
| 1 | `linear_regression_gd`: Linear & Ridge regression via gradient descent | none | 12 |
| 2 | `activation_functions`: ReLU (+ backward), GELU, stable softmax | `linear_regression_gd` | 9 |
| 3 | `self_attention_head`: scaled dot-product attention, causal masking | `activation_functions` | 14 |

Each exercise directory contains:

- `exercise.json`: metadata, limits, prerequisites, remediation map and per-test hints
- `task.md`
- `starter.py`
- `solution.py`: never served
- `tests_hidden.py`: never served

**Adding an exercise:** create the directory and reference it from
`exercises/curriculum.json`. `tests/test_grader.py::test_every_hidden_test_has_a_hint`
checks that every hidden test has a hint.

Each hidden suite checks **properties** rather than one exact output, so the
common mistakes each fail a specific, explainable test:

| Bug | Caught by |
|---|---|
| Gradient sign flipped / learning rate too high | `test_cost_history_length_and_monotonic`, `test_converges_to_closed_form` |
| Wrong derivative | `test_gradients_match_finite_differences` |
| Regularizing the bias | `test_bias_is_not_regularized` |
| Calling `lstsq` / `inv` instead of descending | `test_no_forbidden_solvers` |
| Unstable softmax | `test_softmax_is_numerically_stable` (tagged `NaNInSoftmax`) |
| `K.T` instead of `swapaxes` (breaks batching) | `test_attention_batched_matches_reference` (tagged `ShapeMismatch`) |
| Missing `1/√d_k` | `test_scaling_by_sqrt_dk_is_applied` |
| Causal mask leaks future tokens | `test_causal_head_ignores_future_tokens` |

## Grading payload

```json
{
  "status": "failed",                 // passed | failed | error | timeout
  "passed_tests": 13, "total_tests": 14, "score": 0.9286,
  "tests": [{"name": "test_attention_batched_matches_reference", "outcome": "failed",
             "error_type": "ValueError", "message": "matmul: Input operand 1 has a mismatch…",
             "hint": ".T reverses every axis of a batched tensor. Swap only the last two axes.",
             "duration_ms": 0.4}],
  "stdout": "…", "stderr": "…", "duration_ms": 910,
  "error_tags": ["ShapeMismatch"],
  "remediation": [{"tag": "ShapeMismatch", "hint": "…", "exercise": "linear_regression_gd"}]
}
```

## Tests

`python -m pytest` runs 28 tests:

- **Grader:** reference solutions pass; starters fail; injected bugs are
  caught and tagged; syntax errors, CPU- and wall-clock timeouts and memory
  bombs are classified correctly.
- **API:** DAG locking and unlocking, newly-completed detection, history,
  progress, per-user isolation, input validation and cycle detection.

CI (`.github/workflows/ci.yml`) runs these plus the frontend typecheck, lint
and production build.

## Production hardening (not in this slice)

- **Sandbox.** Learner code currently runs inside the API container (which
  compose runs read-only, with all capabilities dropped and a pid limit). It
  also shares a directory with the hidden tests and the results file. Next
  step: one network-less, non-root pod per run (gVisor, or Firecracker
  microVMs), with tests on a read-only mount the learner's UID can't read and
  results returned over the pod's exit channel.
- **Identity.** The anonymous `X-User-Id` should be replaced with real auth
  (OAuth/JWT), and per-user rate limits added.
- **Scale-out.** The per-user run lock and run semaphore are in-process, so
  the API runs one worker. To scale horizontally, move to Postgres, use Redis
  for locks and rate limits, and put a job queue in front of the execution
  plane.
- **AI mentor.** Hints are curated per test today. The next step is the
  RAG/LLM hint layer: embed the failing test, traceback and code, retrieve
  pedagogy notes, and generate guidance that never includes solution code.
