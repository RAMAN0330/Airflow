# Data Quality Tests & Incremental Loads

A dashboard showed revenue doubling overnight. The cause was duplicate order rows that nobody tested for.
Data teams prevent this with **data tests**: assertions about the data that run on every load, like the
`unique`, `not_null`, `accepted_values` and `relationships` tests built into dbt.

Rows are lists of dicts (one dict per row).

## 1. Checks

Each check returns a result dict:

```python
{"check": "unique", "column": "order_id", "passed": False, "failures": 2, "sample": [3, 7]}
```

`sample` holds the indices of up to **5** failing rows.

| Function | A row fails when |
|---|---|
| `check_not_null(rows, column)` | the value is `None`, missing, or an empty/whitespace string |
| `check_unique(rows, column)` | its non-null value appears in more than one row (every copy fails) |
| `check_accepted_values(rows, column, values)` | its non-null value isn't in `values` |
| `check_range(rows, column, min=None, max=None)` | its non-null value isn't numeric, or is `< min` or `> max` |
| `check_relationships(rows, column, parents)` | its non-null value isn't in the `parents` collection |

## 2. `run_suite(rows, suite)`

`suite` is a list of specs such as `{"check": "accepted_values", "column": "status", "values": [...], "severity": "warn"}`.
Extra keys are passed to the check, and `severity` defaults to `"error"`. Return:

```python
{"passed": bool, "results": [... each result plus its "severity"], "summary": {"errors": n, "warnings": n}}
```

`passed` is `False` only if some **error**-severity check failed. An unknown `check` raises `ValueError`.

## 3. `incremental_batch(rows, watermark)`

Return `(batch, new_watermark)`: the rows with `updated_at` strictly greater than `watermark` (all rows if
`watermark` is `None`), sorted by `updated_at`. The new watermark is the largest `updated_at` in the batch.
If nothing is new, return the old watermark.
