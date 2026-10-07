"""Star schema + SCD Type 2 over the shop database with sqlite3."""
import sqlite3
from datetime import date, timedelta

OPEN_END = "9999-12-31"
BEGINNING = "1900-01-01"


def build_star(conn: sqlite3.Connection) -> None:
    with conn:
        conn.executescript(f"""
            CREATE TABLE dim_customer (
                customer_key INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL, name TEXT NOT NULL,
                country TEXT NOT NULL, valid_from TEXT NOT NULL, valid_to TEXT NOT NULL,
                is_current INTEGER NOT NULL);
            CREATE TABLE dim_product (
                product_key INTEGER PRIMARY KEY, product_id INTEGER NOT NULL, name TEXT NOT NULL,
                category TEXT NOT NULL);
            CREATE TABLE dim_date (
                date_key INTEGER PRIMARY KEY, full_date TEXT NOT NULL UNIQUE, year INTEGER NOT NULL,
                month INTEGER NOT NULL, quarter INTEGER NOT NULL);
            CREATE TABLE fact_sales (
                order_id INTEGER NOT NULL, date_key INTEGER NOT NULL REFERENCES dim_date(date_key),
                customer_key INTEGER NOT NULL REFERENCES dim_customer(customer_key),
                product_key INTEGER NOT NULL REFERENCES dim_product(product_key),
                quantity INTEGER NOT NULL, unit_price REAL NOT NULL, revenue REAL NOT NULL);

            INSERT INTO dim_customer (customer_id, name, country, valid_from, valid_to, is_current)
            SELECT customer_id, name, country, '{BEGINNING}', '{OPEN_END}', 1 FROM customers ORDER BY customer_id;
            INSERT INTO dim_product (product_id, name, category)
            SELECT product_id, name, category FROM products ORDER BY product_id;
        """)
        lo, hi = conn.execute("SELECT MIN(order_date), MAX(order_date) FROM orders").fetchone()
        d, end, days = date.fromisoformat(lo), date.fromisoformat(hi), []
        while d <= end:
            days.append((int(d.strftime("%Y%m%d")), d.isoformat(), d.year, d.month, (d.month - 1) // 3 + 1))
            d += timedelta(days=1)
        conn.executemany("INSERT INTO dim_date VALUES (?, ?, ?, ?, ?)", days)
        # Grain: one row per completed order line.
        conn.execute("""
            INSERT INTO fact_sales (order_id, date_key, customer_key, product_key, quantity, unit_price, revenue)
            SELECT oi.order_id, CAST(replace(o.order_date, '-', '') AS INTEGER), dc.customer_key,
                   dp.product_key, oi.quantity, oi.unit_price, oi.quantity * oi.unit_price
            FROM order_items oi
            JOIN orders o ON o.order_id = oi.order_id AND o.status = 'completed'
            JOIN dim_customer dc ON dc.customer_id = o.customer_id
                 AND o.order_date >= dc.valid_from AND o.order_date < dc.valid_to
            JOIN dim_product dp ON dp.product_id = oi.product_id
            ORDER BY oi.order_id, oi.product_id
        """)


REVENUE_BY_COUNTRY_QUARTER = """
SELECT c.country AS country, d.year AS year, d.quarter AS quarter, ROUND(SUM(f.revenue), 2) AS revenue
FROM fact_sales f
JOIN dim_customer c ON c.customer_key = f.customer_key
JOIN dim_date d ON d.date_key = f.date_key
GROUP BY c.country, d.year, d.quarter
ORDER BY year, quarter, revenue DESC, country
"""


def apply_scd2(conn: sqlite3.Connection, snapshot: list[dict], as_of: str) -> dict:
    counts = {"inserted": 0, "updated": 0, "unchanged": 0}
    with conn:
        for row in snapshot:
            cur = conn.execute(
                "SELECT customer_key, name, country FROM dim_customer WHERE customer_id = ? AND is_current = 1",
                (row["customer_id"],),
            ).fetchone()
            if cur is None:
                counts["inserted"] += 1
            elif (cur[1], cur[2]) == (row["name"], row["country"]):
                counts["unchanged"] += 1
                continue
            else:
                conn.execute("UPDATE dim_customer SET valid_to = ?, is_current = 0 WHERE customer_key = ?", (as_of, cur[0]))
                counts["updated"] += 1
            conn.execute(
                "INSERT INTO dim_customer (customer_id, name, country, valid_from, valid_to, is_current) "
                "VALUES (?, ?, ?, ?, ?, 1)",
                (row["customer_id"], row["name"], row["country"], as_of, OPEN_END),
            )
    return counts


def customer_key_at(conn: sqlite3.Connection, customer_id: int, on_date: str) -> int | None:
    row = conn.execute(
        "SELECT customer_key FROM dim_customer WHERE customer_id = ? AND valid_from <= ? AND ? < valid_to",
        (customer_id, on_date, on_date),
    ).fetchone()
    return None if row is None else row[0]
