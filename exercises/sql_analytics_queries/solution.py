"""Reference solution — never shipped to learners."""

_COMPLETED_LINES = """
    FROM order_items oi
    JOIN orders o ON o.order_id = oi.order_id AND o.status = 'completed'
"""

REVENUE_BY_CATEGORY = f"""
SELECT p.category AS category, ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
{_COMPLETED_LINES}
JOIN products p ON p.product_id = oi.product_id
GROUP BY p.category
ORDER BY revenue DESC
"""

TOP_CUSTOMERS = f"""
SELECT c.customer_id AS customer_id, c.name AS name,
       ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total_spent,
       COUNT(DISTINCT o.order_id) AS order_count
{_COMPLETED_LINES}
JOIN customers c ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.name
ORDER BY total_spent DESC, c.customer_id
LIMIT 5
"""

MONTHLY_REVENUE = f"""
SELECT substr(o.order_date, 1, 7) AS month,
       COUNT(DISTINCT o.order_id) AS orders,
       ROUND(SUM(oi.quantity * oi.unit_price), 2) AS revenue
{_COMPLETED_LINES}
GROUP BY month
ORDER BY month
"""

CUSTOMERS_WITHOUT_ORDERS = """
SELECT c.customer_id AS customer_id, c.name AS name
FROM customers c
WHERE NOT EXISTS (SELECT 1 FROM orders o WHERE o.customer_id = c.customer_id)
ORDER BY c.customer_id
"""

RUNNING_REVENUE = f"""
WITH monthly AS (
    SELECT substr(o.order_date, 1, 7) AS month, SUM(oi.quantity * oi.unit_price) AS revenue
    {_COMPLETED_LINES}
    GROUP BY month
)
SELECT month, ROUND(revenue, 2) AS revenue,
       ROUND(SUM(revenue) OVER (ORDER BY month), 2) AS running_revenue
FROM monthly
ORDER BY month
"""

TOP_PRODUCT_PER_CATEGORY = f"""
WITH units AS (
    SELECT p.category AS category, p.name AS product, SUM(oi.quantity) AS units
    {_COMPLETED_LINES}
    JOIN products p ON p.product_id = oi.product_id
    GROUP BY p.category, p.name
), ranked AS (
    SELECT category, product, units,
           ROW_NUMBER() OVER (PARTITION BY category ORDER BY units DESC, product) AS rn
    FROM units
)
SELECT category, product, units FROM ranked WHERE rn = 1 ORDER BY category
"""
