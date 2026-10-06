"""Analytics queries against the shop database (SQLite).

Replace each placeholder with your query. Keep column names exactly as specified in the task.
"""

REVENUE_BY_CATEGORY = """
-- TODO: category, revenue
SELECT 'todo' AS todo
"""

TOP_CUSTOMERS = """
-- TODO: customer_id, name, total_spent, order_count (top 5)
SELECT 'todo' AS todo
"""

MONTHLY_REVENUE = """
-- TODO: month, orders, revenue
SELECT 'todo' AS todo
"""

CUSTOMERS_WITHOUT_ORDERS = """
-- TODO: customer_id, name
SELECT 'todo' AS todo
"""

RUNNING_REVENUE = """
-- TODO: month, revenue, running_revenue (window function)
SELECT 'todo' AS todo
"""

TOP_PRODUCT_PER_CATEGORY = """
-- TODO: category, product, units (ROW_NUMBER() OVER (PARTITION BY ...))
SELECT 'todo' AS todo
"""
