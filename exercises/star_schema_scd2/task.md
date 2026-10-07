# Build a Star Schema with SCD Type 2

The shop's analysts keep writing four-way joins against the order tables, and every query gets "which
country was this customer in?" slightly wrong, because customers move and the `customers` table only
remembers where they live *now*. Build a small warehouse layer on top: a **star schema** with history.

You get a `sqlite3.Connection` to the same shop database as before (`customers`, `products`, `orders`,
`order_items`).

## 1. `build_star(conn)`

Create and fill four tables:

```
dim_customer(customer_key INTEGER PRIMARY KEY, customer_id, name, country, valid_from, valid_to, is_current)
dim_product (product_key  INTEGER PRIMARY KEY, product_id, name, category)
dim_date    (date_key     INTEGER PRIMARY KEY, full_date 'YYYY-MM-DD', year, month, quarter)
fact_sales  (order_id, date_key, customer_key, product_key, quantity, unit_price, revenue)
```

- **Surrogate keys.** `customer_key` and `product_key` are warehouse-owned integers, not the source ids.
  The source ids stay as ordinary columns.
- **Initial customer rows:** one per customer, `valid_from = '1900-01-01'`, `valid_to = '9999-12-31'`,
  `is_current = 1`.
- **dim_date:** one row for **every** calendar day from the first to the last order date, with no gaps.
  `date_key` is the integer `YYYYMMDD` (e.g. `20250224`), and `quarter` is 1 to 4.
- **fact_sales grain: one row per completed order line.** Only `status = 'completed'` orders count.
  `revenue = quantity * unit_price` (unrounded). `order_id` stays on the fact as a degenerate dimension.
- Each fact row's `customer_key` is the version of the customer that was valid on the order date.

## 2. `REVENUE_BY_COUNTRY_QUARTER`

A SQL string answering "revenue by customer country, per quarter", using **only the star tables**.
Columns `country, year, quarter, revenue` with `revenue` as `ROUND(…, 2)`. Order by `year, quarter`, then
`revenue` descending, then `country`.

## 3. `apply_scd2(conn, snapshot, as_of) -> dict`

`snapshot` is today's source extract: a list of `{"customer_id", "name", "country"}` dicts. Merge it into
`dim_customer` as **SCD Type 2** effective on `as_of` (`'YYYY-MM-DD'`):

| Case | Action |
|---|---|
| `customer_id` has no current row | insert a new row, `valid_from = as_of`, `valid_to = '9999-12-31'`, `is_current = 1` |
| `name` and `country` equal the current row's | do nothing |
| either attribute changed | close the current row (`valid_to = as_of`, `is_current = 0`), then insert the new version as above |

Return `{"inserted": n, "updated": n, "unchanged": n}`. Customers missing from the snapshot are left
alone. Never overwrite a row's `name` or `country`: that's Type 1, and it rewrites history. Running the
same snapshot twice must change nothing the second time. Don't modify `snapshot`.

## 4. `customer_key_at(conn, customer_id, on_date)`

Return the `customer_key` whose `valid_from <= on_date < valid_to`, or `None`. Ranges are half-open, so
on the change date itself the new version applies.

## Example

```python
build_star(conn)
apply_scd2(conn, [{"customer_id": 3, "name": "Chen Sato", "country": "DE"}, ...], "2025-07-01")
# customer 3 now has two rows:
#   key 3   US  1900-01-01 → 2025-07-01  is_current 0   (old facts still point here)
#   key 25  DE  2025-07-01 → 9999-12-31  is_current 1
```

## What the hidden tests check

Surrogate keys, a gap-free date dimension, order-line grain, fact foreign keys, the query (run after the
OLTP tables are dropped), new versions with closed predecessors, untouched unchanged rows, idempotent
re-runs, new customers, point-in-time lookups, and that historical revenue by country doesn't move after a
customer changes country.
