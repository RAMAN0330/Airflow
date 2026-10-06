# Orchestration: Pipelines as DAGs

A real pipeline is many steps: extract orders, extract customers, join them, test the result, train a
model, refresh a dashboard. Some steps depend on others, and some don't. An **orchestrator** such as
Apache Airflow decides what runs when, in what order, and what happens when something fails.

## Dependencies form a graph

Write "`join` needs `extract_orders`" as an edge `extract_orders → join`. Together, the tasks and edges
form a **directed graph**. It must be **acyclic**: if `a` needs `b` and `b` needs `a`, nothing can ever
start. That's why Airflow calls a pipeline a **DAG**.

```
extract_orders ──┐
                 ├──► join ──► train
extract_customers┘        └──► report
```

## Finding a run order: topological sort

A **topological order** lists every task after all of its upstreams. **Kahn's algorithm** finds one:

1. Count each task's unmet upstreams.
2. Put every task with a count of zero into a "ready" set.
3. Repeatedly take a ready task, emit it, and decrement the count of each task downstream of it. Any
   that reach zero become ready.
4. If tasks remain when nothing is ready, they're on a **cycle**. Report an error.

Picking the alphabetically smallest ready task (a min-heap) makes the order **deterministic**, so runs are
reproducible and diffs stay readable.

## Parallelism comes from the graph

A task's **layer** is one more than its deepest upstream's layer. Tasks in the same layer don't depend on
each other, so they can run **in parallel**:

```
layer 0: extract_customers, extract_orders
layer 1: join
layer 2: report, train
```

## Failure semantics

Failures are normal: networks time out, APIs rate-limit, disks fill up. Orchestrators make them
manageable:

- **Retries.** Re-run a failed task up to N more times, to absorb transient errors. This is only safe if
  the task is **idempotent**, like the upsert-based loads from the previous lessons.
- **upstream_failed.** If a task fails for good, everything downstream of it is skipped and marked
  `upstream_failed`. Running `train` on a half-built table would be worse than not running it.
- **Independent branches continue.** A failure in the orders branch shouldn't stop the marketing
  dashboard that never depended on it.

## Beyond this exercise

Production orchestrators add scheduling ("every day at 02:00"), backfills over past dates, sensors that
wait for upstream data, task pools to cap concurrency, and a UI showing every run. Underneath all of that
is the graph logic you'll implement here.
