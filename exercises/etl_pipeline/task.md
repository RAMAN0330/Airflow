# Build an Idempotent ETL Pipeline

Every night the payments team drops an `orders.csv` export. It's messy: stray spaces, mixed date formats,
a few broken rows, and corrections that re-send the same order with a newer `updated_at`. Build the
pipeline that turns it into a clean `fact_orders` table.

```
order_id,customer_email,amount,currency,order_date,country,updated_at
1001, Ana@Example.com ,120.50,USD,2025-03-01,us,2025-03-01T10:00:00
1002,"ben, jr@example.com",oops,EUR,02/03/2025,de,2025-03-02T09:00:00
```

## Stages

| Function | Does |
|---|---|
| `extract(csv_text) -> list[dict]` | Parse the CSV (quoted fields can contain commas) and strip whitespace from keys and values |
| `transform(rows) -> (clean, rejects)` | Validate and normalize each row, then keep only the latest version of each `order_id` |
| `load(conn, clean) -> int` | Create `fact_orders` if it's missing and **upsert** each row; return the number of rows written |
| `run_pipeline(conn, csv_text) -> dict` | Run E → T → L and return `{"extracted", "loaded", "rejected"}` counts |

## Transform rules

A clean row has exactly these keys:
`order_id (int)`, `customer_email (str, lower-case)`, `amount (float)`, `currency (str, upper-case)`,
`order_date ('YYYY-MM-DD')`, `country (2-letter, upper-case)`, `updated_at (str)`.

- `order_date` arrives as `YYYY-MM-DD` **or** `DD/MM/YYYY`.
- Reject a row (`{**original_row, "reason": "..."}`) when `order_id` is missing or not an integer,
  `amount` isn't a number or is negative, or `order_date` can't be parsed.
- If an `order_id` appears more than once among valid rows, keep the one with the latest `updated_at`.

## Load rules

`fact_orders` has `order_id INTEGER PRIMARY KEY` plus the other six columns. Loading the same data twice
must not create duplicates, and a newer extract must overwrite corrected values. That's **idempotency**.

## What the hidden tests check

CSV quoting, normalization, both date formats, rejects with reasons, dedup to the latest version, table
creation and upserts, idempotent re-runs, corrections, and run metrics.
