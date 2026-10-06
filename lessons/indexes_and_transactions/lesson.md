# Indexes, Query Plans & ACID Transactions

Correct queries are step one. Production databases also need them to be **fast** and their changes to be
**safe**. This lesson covers both.

## Why queries get slow

To find `WHERE customer_id = 42` in a table with no usable index, the database has no choice but to read
**every row** (a *full scan*). That's fine at 1,000 rows and painful at 100 million.

An **index** is a separate, sorted data structure (in SQLite and most databases, a B-tree) that maps
column values to rows. Finding a key in a balanced tree takes about log₂(n) steps: roughly 27 lookups
for 100 million rows instead of 100 million.

## Composite indexes: order matters

```sql
CREATE INDEX idx_orders_customer_date ON orders (customer_id, order_date);
```

This index is sorted by `customer_id`, then by `order_date` within each customer. It serves:

- `WHERE customer_id = ?`, using the leading column, ✅
- `WHERE customer_id = ? AND order_date >= ?`, an equality then a range, ✅
- `WHERE order_date >= ?` on its own: ❌, because the dates are only sorted *within* each customer.

Rule of thumb: put **equality columns first and the range column last**. If an index also holds every
column the query reads, it's a **covering index** and the table itself is never touched.

## Read the plan, don't guess

```sql
EXPLAIN QUERY PLAN
SELECT order_id, order_date FROM orders WHERE customer_id = 3 AND order_date >= '2025-06-01';
-- before: SCAN orders
-- after:  SEARCH orders USING COVERING INDEX idx_orders_customer_date (customer_id=? AND order_date>?)
```

`SCAN` means every row is visited. `SEARCH … USING INDEX` means the index narrowed it down. Every
serious database has an equivalent (`EXPLAIN ANALYZE` in PostgreSQL).

Indexes aren't free: each one slows down writes and uses disk. Add them for real query patterns.

## Pagination without the slowdown

`LIMIT 20 OFFSET 100000` makes the database produce and discard 100,000 rows to show page 5,001.
**Keyset pagination** remembers where the last page ended:

```sql
SELECT order_id, order_date FROM orders WHERE order_id > :last_seen ORDER BY order_id LIMIT 20;
```

Each page is an index search, so page 5,001 costs the same as page 1.

## Transactions: all or nothing

Moving stock between warehouses takes two writes. If the process dies between them, units vanish.
A **transaction** groups writes so they are **atomic**: either all commit or none do. That's the "A" in
**ACID** (Atomicity, Consistency, Isolation, Durability).

In Python's `sqlite3`, the connection is a context manager:

```python
with conn:                      # commits on success, rolls back on any exception
    conn.execute("UPDATE inventory SET qty = qty - ? WHERE warehouse = ? AND product_id = ?", (n, src, pid))
    conn.execute("INSERT INTO inventory (warehouse, product_id, qty) VALUES (?, ?, ?) "
                 "ON CONFLICT (warehouse, product_id) DO UPDATE SET qty = qty + excluded.qty", (dst, pid, n))
```

If the second statement fails, the first is undone too. Validate inputs (like stock levels) *inside* the
transaction, so the check and the write see the same data.

## Always use parameters

Never build SQL with f-strings. `f"... WHERE warehouse = '{name}'"` breaks on a name like `O'Hare`, and
lets an attacker run their own SQL (**SQL injection**). Placeholders (`?`) send values separately from
the SQL text, so they're always treated as data.
