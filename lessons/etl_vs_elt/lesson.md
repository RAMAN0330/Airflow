# ETL vs ELT: Moving Data You Can Trust

Analytics and ML are only as good as the data under them, and that data almost never starts where it's
needed. A **pipeline** moves it from operational systems (apps, payment providers, CRMs) into an analytical
store (a warehouse or lakehouse).

## Three stages

- **Extract** reads data from the source *as delivered*: a CSV export, an API page, a database snapshot.
  Keep extraction dumb, so that if something breaks later you still have the original.
- **Transform** validates, cleans, standardizes, deduplicates and reshapes the data.
- **Load** writes the result into its destination table.

## ETL or ELT?

| | ETL | ELT |
|---|---|---|
| Where transforms run | In the pipeline, before loading | Inside the warehouse, after loading raw data |
| Typical tools | Python/Spark jobs | SQL models (e.g. dbt) on Snowflake, BigQuery, Postgres… |
| Strength | Raw sensitive data never lands; less warehouse compute | Raw data is kept, so transforms can be re-run and audited |
| Watch out for | Changing logic means re-extracting | Raw data needs governance and access control |

Cheap, scalable warehouses made **ELT** the default for analytics. **ETL** still makes sense when data
must be cleaned or masked before it's stored. The engineering principles below apply to both.

## 1. Idempotency: re-runs must be safe

Pipelines fail and get retried. A load that does plain `INSERT`s will **duplicate** data on every retry.
Make the load idempotent by keying on a **business key** and **upserting**:

```sql
INSERT INTO fact_orders (order_id, amount, updated_at, ...)
VALUES (?, ?, ?, ...)
ON CONFLICT (order_id) DO UPDATE SET amount = excluded.amount, updated_at = excluded.updated_at, ...;
```

Run it once or ten times and the table ends up the same, and a later correction overwrites the old value.

## 2. Keep the latest version of each record

Sources resend records when they change. Within a batch, keep **one row per key**: the one with the
greatest `updated_at`. ISO-8601 timestamps (`2025-03-01T12:00:00`) sort correctly as plain strings, which
is one reason to standardize on them.

## 3. Reject loudly, never silently

A row with `amount = "oops"` shouldn't crash the nightly run, and it shouldn't vanish either. Send it to a
**rejects** output with a reason (`"invalid amount"`). Someone can then fix the source, and nothing goes
missing without a trace.

## 4. Normalize at the boundary

Lower-case emails, upper-case ISO country and currency codes, parse every accepted date format into one
(`YYYY-MM-DD`), and convert numeric strings to numbers. Do it once, in the pipeline, so every consumer
downstream sees a single canonical form.

## 5. Audit every run

Return or log `extracted`, `loaded` and `rejected` counts. When a dashboard looks wrong, the first question
is always "what did last night's run actually do?"

## Facts and grain

In a warehouse, a **fact table** records measurable events at a declared **grain** ("one row per order"),
and joins to descriptive **dimension** tables (customers, products). This is Kimball's dimensional modeling,
still the most common way to lay out analytical data.
