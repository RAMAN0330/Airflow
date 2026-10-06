# Experiment Tracking & a Model Registry

Six weeks in, nobody can say which notebook produced the model in production, or how to get the last good
one back. MLOps fixes this with two tools, and you'll build both:

- **Experiment tracking**: every training run logs its params and metrics, as MLflow Tracking does.
- **A model registry**: named, versioned models that move through stages, as in the MLflow Model Registry.

## `ModelRegistry`

| Method | Behavior |
|---|---|
| `log_run(params, metrics) -> run_id` | Store a run (ids `"run-1"`, `"run-2"`, …). Stored data must not change if the caller mutates its dicts later |
| `get_run(run_id) -> dict` | `{"run_id", "params", "metrics", "fingerprint"}` |
| `fingerprint(params) -> str` (static) | SHA-256 of the params, the same regardless of key order |
| `duplicate_runs() -> list[list[str]]` | Groups of run ids that share a fingerprint (only groups larger than 1) |
| `best_run(metric, mode="max") -> run_id` | Best run on `metric` (`"max"` or `"min"`); ties go to the earliest; ignore runs without the metric |
| `register(run_id, name) -> version` | New version of model `name` (1, 2, … per name), in stage `"None"` |
| `transition(name, version, stage)` | Move to `"None"`, `"Staging"`, `"Production"` or `"Archived"` |
| `get_production(name) -> version or None` | Current Production version |
| `rollback(name) -> version` | Restore the previous Production version and archive the current one |

### Rules

- At most **one** version per model is in `Production`. Promoting another archives the old one.
- An unknown stage raises `ValueError`. An unknown model or version raises `KeyError`.
- `rollback` with no earlier Production version raises `ValueError`.
- `stage(name, version)` returns a version's current stage.

## What the hidden tests check

Run storage and immutability, order-independent fingerprints, duplicate detection, best-run selection
(max and min, with ties), per-model versioning, safe promotion, invalid transitions, and rollback.
