# Validation Gates, Canary Releases & Model Serving

Your registry holds `churn` v7, trained last night. Promoting it by hand has bitten the team twice: once a
model with better overall AUC was much worse on mobile users, and once a "quick" rollout went to everyone
at once. You'll build the automated release path instead: a **gate** in CI, a **canary** in production,
and the **server** that answers requests.

## 1. `percentile_nearest_rank(values, q)`

Latency budgets are written as percentiles ("p95 under 50 ms"), so pin down the method. Use **nearest
rank**: sort the values and return the one at 1-based rank `ceil(q * n / 100)` (at least rank 1). No
interpolation, so the result is always an observed value. `q` is in `[0, 100]`. Empty input raises
`ValueError`. (This matches `np.percentile(x, q, method="inverted_cdf")`.)

## 2. `validation_gate(candidate, production, metric="auc", max_regression=0.01, min_metric=0.0, slice_max_regression=None, latency_budget_ms=None, latency_percentile=95)`

Each model is a dict (higher metric is better):

```python
{"metrics": {"auc": 0.91},
 "slices": {"mobile": {"auc": 0.88}, "desktop": {"auc": 0.93}},   # optional
 "latencies_ms": [12.1, 9.8, ...]}                                 # needed only for the latency check
```

Run these checks, in this order, and collect a failure code for each one that fails:

| Check | Fails when | Code |
|---|---|---|
| Absolute floor | `candidate < min_metric` | `"min_metric:<metric>"` |
| Overall regression | `production − candidate > max_regression` | `"regression:<metric>"` |
| Each production slice, **sorted by name** | missing from the candidate | `"missing_slice:<name>"` |
| | `production − candidate > slice_max_regression` (defaults to `max_regression`) | `"slice_regression:<name>"` |
| Latency (only if `latency_budget_ms` is set) | nearest-rank `latency_percentile` of `candidate["latencies_ms"]` `> latency_budget_ms` | `"latency"` |

Return `{"passed": not failures, "failures": [...], "latency_ms": <the percentile, or None>}`.
Don't modify the inputs.

## 3. `bucket(request_id, buckets=10_000)` and `route(request_id, canary_percent)`

Routing must be **deterministic across processes and machines**, so every replica sends a given user to
the same arm. Python's built-in `hash()` of a string is randomized per process, so it won't work here. Use:

```python
int.from_bytes(hashlib.sha256(str(request_id).encode("utf-8")).digest()[:8], "big") % buckets
```

`route` returns `"canary"` when `bucket(request_id) < canary_percent * BUCKETS / 100`, otherwise
`"production"`. Raise `ValueError` if `canary_percent` is outside `[0, 100]`. Because the threshold only moves
up as you ramp, a user who saw the canary at 5% still sees it at 25% (**sticky** assignment).

## 4. `canary_decision(baseline, canary, min_samples=500, max_increase=0.01)`

Each arm is `{"requests": int, "errors": int}`.

1. Invalid counts (negative, or `errors > requests`) raise `ValueError`.
2. If **either** arm has fewer than `min_samples` requests, return `"continue"`. Don't decide from noise.
3. Otherwise return `"rollback"` if `canary_rate − baseline_rate > max_increase`, else `"promote"`.

## 5. `ModelServer(predict_fn, schema, max_batch_size=32)`

`schema` maps feature names to `"int"` or `"float"`. Any other type, or `max_batch_size < 1`, raises
`ValueError`. `predict_fn` takes a float array of shape `(b, n_features)`, with columns in **schema
order**, and returns `b` predictions.

- `validate(request)` returns `None` for a valid request, otherwise an error string that names the
  offending feature. A request must be a dict with exactly the schema's keys. Bools never count as numbers.
  `"int"` needs an `int`. `"float"` accepts `int` or `float`, but only finite values.
- `predict(requests)` returns one result per request, **in request order**:
  `{"ok": True, "prediction": float}` or `{"ok": False, "error": str}`. Only valid requests reach the model,
  in chunks of at most `max_batch_size` in arrival order. Append each chunk's size to `self.batch_sizes`.
  If the model returns the wrong number of predictions, raise `RuntimeError`.

```python
server = ModelServer(lambda X: X[:, 0] * 2, {"x": "float"}, max_batch_size=2)
server.predict([{"x": 1.0}, {"y": 1}, {"x": 2.0}, {"x": 3.0}])
# [{"ok": True, "prediction": 2.0}, {"ok": False, "error": "missing feature 'x'"},
#  {"ok": True, "prediction": 4.0}, {"ok": True, "prediction": 6.0}]
server.batch_sizes   # [2, 1]
```

## What the hidden tests check

Nearest-rank percentiles, every gate check (including the edge exactly at the tolerance), slice regressions
hidden by a better overall metric, percentile-based latency budgets, stable hashing, routing percentages and
stickiness, canary decisions and the minimum sample size, order-preserving batching, and schema validation.
