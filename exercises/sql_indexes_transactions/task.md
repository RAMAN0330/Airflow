# Indexes, Pagination & Transactions

The shop is growing. Lookups are slowing down, the product page loads every order at once, and last
week a crash left stock moved out of one warehouse but never into the other. Fix all three.

You get a `sqlite3.Connection` to the shop database, the same one as in the previous exercise. There's also
an `inventory(warehouse, product_id, qty)` table with primary key `(warehouse, product_id)` and
`CHECK (qty >= 0)`.

## 1. `create_indexes(conn)`

Add indexes so that both of these queries **search an index instead of scanning the table**:

```sql
SELECT order_id, order_date FROM orders WHERE customer_id = ? AND order_date >= ?;
SELECT SUM(quantity) FROM order_items WHERE product_id = ?;
```

Calling it twice must not fail. Prove your work with `EXPLAIN QUERY PLAN`: you want `SEARCH … USING
(COVERING) INDEX`, not `SCAN`.

## 2. `orders_page(conn, after_id=0, limit=20)`

Return `[(order_id, order_date), …]` for the next `limit` orders with `order_id > after_id`, in id order.
This is **keyset pagination**: unlike `OFFSET`, it never re-reads skipped rows.

## 3. `transfer_stock(conn, product_id, src, dst, qty)`

Move `qty` units of a product from warehouse `src` to `dst`, and return `(new_src_qty, new_dst_qty)`.

- `qty <= 0` raises `ValueError`.
- If `src` doesn't have enough stock, raise `ValueError` and change nothing.
- If `dst` has no row for the product yet, create it.
- It must be **atomic**. If anything fails partway through, both rows end up exactly as they were, and no
  transaction is left open.
- Use parameters (`?`). Warehouse names can contain quotes.

## What the hidden tests check

Query plans, idempotency, pagination coverage without overlap, transfers, rollback on errors (including a
failure injected into the second write), and safety against SQL injection.
