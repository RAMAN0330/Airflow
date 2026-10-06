# Point-in-Time Correct Feature Joins

You're training a fraud model. Labels are transactions with a timestamp and an outcome. Features
(`avg_spend_7d`, `n_chargebacks`, …) are recomputed every few hours and stored with the time they were
computed. If you join each transaction to the **latest** feature row overall, you leak the future: the
model sees chargebacks that happened *after* the transaction. It looks brilliant offline and fails in
production.

Feature stores such as Feast avoid this with **point-in-time joins**: for each event, use the newest
feature values that existed **at that moment**.

## Inputs

```python
labels   = [{"entity_id": "u1", "event_ts": 1700, "label": 1}, ...]
features = [{"entity_id": "u1", "feature_ts": 1500, "avg_spend": 31.0, "n_cb": 0}, ...]
```

Timestamps are integers (epoch seconds). Feature rows can come in any order.

## 1. `point_in_time_join(labels, features, ttl=None) -> list[dict]`

For each label, in the original order, return `{**label, "feature_ts": ..., "features": {...}}`:

- Use the feature row for the same `entity_id` with the **largest `feature_ts <= event_ts`**.
- `features` holds that row's columns, *excluding* `entity_id` and `feature_ts`.
- If there's no such row, or `ttl` is set and `event_ts − feature_ts > ttl`, both `feature_ts` and
  `features` are `None`.
- If two rows tie on `feature_ts`, the one that appears **later** in `features` wins.
- Don't mutate the inputs.

It must handle **40,000 labels × 120,000 feature rows** in a couple of seconds, so comparing every label
against every feature row won't do.

## 2. `detect_leakage(rows) -> list[int]`

Given rows with `event_ts` and `feature_ts`, return the indices where `feature_ts` is **after** `event_ts`.
Use it to audit a training set someone else built.
