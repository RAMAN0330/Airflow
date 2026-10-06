# Orchestrate a Pipeline DAG

Pipelines are graphs: `extract_orders` and `extract_customers` must finish before `join`, which must
finish before `train` and `report`. Orchestrators such as Apache Airflow model this as a **DAG**
(directed acyclic graph) and decide what runs, in what order, and what happens on failure.

A DAG is a dict mapping each task to the list of its **upstream** tasks:

```python
dag = {
    "extract_orders": [],
    "extract_customers": [],
    "join": ["extract_orders", "extract_customers"],
    "train": ["join"],
    "report": ["join"],
}
```

## What to implement (`starter.py`)

| Function | Returns |
|---|---|
| `topological_order(dag)` | A list of every task, each after all of its upstreams. When several are ready, pick **alphabetical** order. Raise `ValueError` on a cycle or an unknown upstream |
| `execution_layers(dag)` | A list of layers. Layer *k* holds the tasks whose upstreams are all in earlier layers, so they could run **in parallel**. Sort each layer |
| `run_dag(dag, runners, max_retries=2)` | `{task: {"state": ..., "attempts": n}}` after running the DAG |

### `run_dag` semantics (as in Airflow)

- `runners[task]()` runs a task. If it raises, the task failed.
- A failed task is retried up to `max_retries` more times. If it never succeeds, its state is `"failed"`.
- A task with a failed or upstream-failed parent is **not run**. Its state is `"upstream_failed"` with
  `attempts == 0`.
- Everything else that succeeds is `"success"`. Independent branches keep running.

## What the hidden tests check

Dependency order, deterministic tie-breaking, cycle and unknown-upstream detection, parallel layers, run
order, retries, downstream failure propagation, and independent branches still running.
