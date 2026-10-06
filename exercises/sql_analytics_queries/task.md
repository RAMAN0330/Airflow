# Analytics Queries in SQL

You're the first data hire at a small online shop. The founders have questions, and the answers are in
their SQLite database. Write one SQL query per question.

## The schema

```
customers(customer_id PK, name, email, country, signup_date)
products(product_id PK, name, category, price)
orders(order_id PK, customer_id → customers, order_date 'YYYY-MM-DD', status)
order_items(order_id → orders, product_id → products, quantity, unit_price)
```

`status` is one of `completed`, `cancelled` or `pending`. **Revenue only counts completed orders.**
A line's revenue is `quantity * unit_price`. Round every money value with `ROUND(x, 2)`.

You can explore the same data in the **SQL Playground** before you submit.

## What to write (`starter.py`)

Each constant is a SQL string. The column names and the order of rows must match exactly.

| Constant | Columns | Rows / order |
|---|---|---|
| `REVENUE_BY_CATEGORY` | `category, revenue` | one row per category, by `revenue` descending |
| `TOP_CUSTOMERS` | `customer_id, name, total_spent, order_count` | top 5 by `total_spent` desc, ties by `customer_id` |
| `MONTHLY_REVENUE` | `month, orders, revenue` | `month` as `'YYYY-MM'`, ascending; `orders` = distinct completed orders |
| `CUSTOMERS_WITHOUT_ORDERS` | `customer_id, name` | customers with **no orders of any status**, by `customer_id` |
| `RUNNING_REVENUE` | `month, revenue, running_revenue` | cumulative revenue by month, ascending |
| `TOP_PRODUCT_PER_CATEGORY` | `category, product, units` | best-selling product (by units) per category, ties by product name; by `category` |

## Rules

- One read-only statement per constant: `SELECT …` or `WITH … SELECT …`.
- SQLite dialect. Window functions (`OVER (…)`) are available.

## What the hidden tests check

Each query runs against the real database. Its column names and rows are compared with a reference
answer, and the queries are checked to be read-only.
