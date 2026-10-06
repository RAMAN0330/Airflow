# Data Quality Tests & Incremental Loads

Code has unit tests, and data needs them too. A pipeline can run perfectly and still load garbage: a
source starts sending duplicates, a new status value appears, a join key goes missing. Without tests,
you find out from a wrong dashboard or a degraded model.

## Data tests are assertions

A **data test** states something that must be true and lists the rows where it isn't. dbt ships four
generic tests that cover most needs:

| Test | Asserts | Catches |
|---|---|---|
| `not_null` | the column always has a value | broken extracts, missing joins |
| `unique` | no value appears twice | duplicate loads, fan-out joins |
| `accepted_values` | values come from a known set | new or typo'd statuses |
| `relationships` | every child key exists in the parent | orphaned orders, out-of-order loads |

Add **range** checks for numbers (no negative amounts, no ages of 300) and freshness checks for timestamps.

A good test result says **how many** rows failed and shows **a few examples**, so the person on call can
start debugging straight away:

```python
{"check": "unique", "column": "order_id", "passed": False, "failures": 2, "sample": [2, 3]}
```

Note that `unique` fails **every** copy of a duplicated value, because you can't tell which one is "right".

## Severity decides what happens next

Not every failure deserves stopping the world. Give each test a **severity**:

- **error**: block the load. A non-unique primary key will corrupt everything downstream.
- **warn**: load anyway, but alert someone. A new status value might be legitimate.

## Data validation for ML

Google's TFX team reports that validating the data fed to ML pipelines catches many production
incidents. Training/serving skew, unexpected categories and missing features look like data bugs long
before they look like model bugs. A test suite at the pipeline boundary is the cheapest protection a
model can get.

## Incremental loads with a watermark

Re-processing all of history every night gets slower as the data grows. An **incremental** load only
processes what changed since last time:

1. Read the stored **watermark**, the max `updated_at` already loaded (none on the first run).
2. Select rows with `updated_at > watermark`, strictly greater, because rows *at* the watermark were already loaded.
3. Test and load that batch.
4. Store the new watermark **only after the load succeeds**. If the run fails, the next run picks up the
   same rows again, which your idempotent upsert handles safely.

If a batch is empty, keep the old watermark. Setting it to "nothing" would reload all of history next time.

dbt's incremental models follow the same pattern: on incremental runs they filter source rows newer than
the max timestamp already in the target table.
