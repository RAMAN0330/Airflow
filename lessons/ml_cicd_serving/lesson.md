# CI/CD & Serving for ML: Gates, Canaries & Model Servers

The registry tells you *which* model is in production. This lesson is about *how* a new version gets
there without hurting anyone. Continuous Delivery for ML (Sato, Wider and Windheuser) applies the usual
CD idea, small, safe, reversible releases, to code, data **and** models. Three pieces do most of the work:
an automated **validation gate**, a **canary release**, and a **model server** that actually answers requests.

## 1. The validation gate

A gate runs in CI and blocks the release unless the candidate meets agreed criteria **relative to
production**. TFX's Evaluator works this way: it compares a candidate with a baseline model and only
"blesses" it if thresholds hold. A useful gate checks four things:

| Check | Rule (higher metric is better) |
|---|---|
| Floor | `candidate ≥ min_metric`. Never ship something absolutely bad |
| Regression | `production − candidate ≤ max_regression`. Small noise is tolerated |
| **Every slice** | the same rule per segment: device, country, customer tier |
| Latency | the p95 of benchmark latencies is within budget |

**Slices matter.** An overall AUC is an average, and averages hide failures. Oakden-Rayner et al. call this
*hidden stratification*: models that look accurate overall can do much worse on an important subgroup.
A candidate with better overall AUC and a collapsed mobile slice must fail the gate.

**Pin down the percentile method.** "p95 latency" is ambiguous until you say how it's computed. The
nearest-rank method sorts the sample and takes rank `ceil(0.95 · n)`, so the result is always an observed
latency. Interpolating methods give slightly different numbers, and you can't enforce a budget if two
tools disagree about the measurement. Use percentiles rather than the mean: users feel the tail.

## 2. Canary releases

A canary sends a **small share of real traffic** to the new version and watches it before everyone gets
it (Fowler's bliki entry *CanaryRelease*, and chapter 16 of Google's SRE Workbook). The routing rule
needs three properties:

- **Deterministic everywhere.** Every replica must route request `u-42` the same way. Python's built-in
  `hash()` of a string is salted per process (`PYTHONHASHSEED`), so two workers disagree. Use a stable hash:
  ```python
  b = int.from_bytes(hashlib.sha256(rid.encode()).digest()[:8], "big") % 10_000
  arm = "canary" if b < pct * 100 else "production"
  ```
- **Proportional.** Uniform buckets make about `pct`% of ids land in the canary.
- **Sticky.** The threshold only moves up as you ramp from 1% to 5% to 25%, so a user who saw the canary
  keeps seeing it instead of flipping between versions.

## 3. Canary analysis: wait for evidence

After a few minutes the canary may show 2 errors in 20 requests. That is 10%, and it means nothing yet.
Deciding on tiny samples causes both false rollbacks and false promotions. A simple, honest rule:

1. If either arm has fewer than `min_samples` requests, **continue** collecting.
2. Otherwise compare error rates: **roll back** if `canary_rate − baseline_rate > max_increase`, else
   **promote** (or ramp to the next step).

Real systems add statistical tests and more metrics (latency, business KPIs), but the minimum sample size
is the part that's most often missing.

## 4. Serving: validate, batch, keep order

A model server sits between callers and the model. It has two jobs that are easy to get wrong:

- **Input schema validation.** Reject missing or unexpected features, wrong types, bools pretending to be
  numbers, and NaN or inf, *before* the model sees them. Return a per-request error. One bad request
  shouldn't fail the others.
- **Batching.** Models are much faster per example on a batch. Clipper and TensorFlow Serving both
  group concurrent requests into batches to raise throughput within a latency budget. The invariant:
  **answer `i` goes back to request `i`.** Keep each request's index, batch only the valid rows in
  arrival order, and write predictions back by index. A server that reorders returns *plausible* numbers
  to the wrong callers, and no error is raised.

## In the exercise

You'll implement `percentile_nearest_rank`, a `validation_gate` with slice and latency checks, a
sha256-based `bucket`/`route` canary router, `canary_decision` with a minimum sample size, and a
`ModelServer` that validates and batches requests while preserving order.
