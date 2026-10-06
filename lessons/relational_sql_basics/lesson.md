# Relational Thinking & Analytical SQL

In 1970, Edgar Codd proposed storing data as **relations**: tables of rows that share a fixed set of
columns, linked by keys rather than by pointers. Half a century later, almost every analytics question
still ends up as a SQL query over such tables.

## Tables, keys and grain

Each table stores **one kind of fact**, and you should always be able to say what one row means. That
meaning is its **grain**:

| Table | Grain (one row is…) | Key |
|---|---|---|
| `customers` | a customer | `customer_id` |
| `orders` | an order placed by a customer | `order_id` |
| `order_items` | one product line within an order | `(order_id, product_id)` |

`orders.customer_id` is a **foreign key**: it points to a row in `customers`. Storing each fact once
(normalization) means a customer's email lives in exactly one place, so it can't disagree with itself.

## Joins put facts back together

```sql
SELECT o.order_id, c.name, oi.quantity * oi.unit_price AS line_total
FROM order_items oi
JOIN orders o    ON o.order_id = oi.order_id
JOIN customers c ON c.customer_id = o.customer_id;
```

The result's grain is the **finest** table involved: here, one row per order line. Forgetting this is
the most common analytics bug. `COUNT(*)` over this join counts *lines*, not orders, which is why
the exercise asks for `COUNT(DISTINCT o.order_id)`.

## Aggregation

`GROUP BY` collapses rows into groups, and aggregates (`SUM`, `COUNT`, `AVG`, `MIN`, `MAX`) summarize
each one. `WHERE` filters **rows before** grouping. `HAVING` filters **groups after**.

```sql
SELECT p.category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
FROM order_items oi
JOIN orders o   ON o.order_id = oi.order_id AND o.status = 'completed'
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.category
HAVING revenue > 1000
ORDER BY revenue DESC;
```

## Finding what's missing: anti-joins

"Customers who never ordered" means the customers that have *no* match in `orders`:

```sql
SELECT c.customer_id, c.name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id);
```

`LEFT JOIN orders … WHERE o.order_id IS NULL` is equivalent. Be careful with `NOT IN (subquery)`: if
the subquery returns a `NULL`, it returns no rows at all.

## Window functions

A window function computes across **related rows without merging them**. It's marked by `OVER (…)`:

```sql
-- running total
SUM(revenue) OVER (ORDER BY month)
-- rank within each group
ROW_NUMBER() OVER (PARTITION BY category ORDER BY units DESC, product)
```

`PARTITION BY` restarts the window for each group, and `ORDER BY` defines the order inside it. To keep
the top row per group, rank in a CTE (`WITH …`) and then filter on `rank = 1` in the outer query.
Window results can't be filtered in the same query's `WHERE`, because `WHERE` runs before they exist.

## Read SQL in evaluation order

You write `SELECT` first, but the database logically starts at `FROM`. When a query surprises you,
trace it in the order shown in the flow above. Most bugs are a wrong grain from a join, or a filter
applied in the wrong phase.
