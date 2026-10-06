"""Hidden validation suite for sql_analytics_queries."""
import re
import sqlite3
from pathlib import Path

import pytest

import submission as sub

DB_SQL = (Path(__file__).parent / "fixtures" / "shop.sql").read_text()

COMPLETED = """
    FROM order_items oi JOIN orders o ON o.order_id = oi.order_id AND o.status = 'completed'
"""
REFERENCE = {
    "REVENUE_BY_CATEGORY": (["category", "revenue"], f"""
        SELECT p.category, ROUND(SUM(oi.quantity*oi.unit_price), 2) AS r {COMPLETED}
        JOIN products p ON p.product_id = oi.product_id GROUP BY 1 ORDER BY r DESC"""),
    "TOP_CUSTOMERS": (["customer_id", "name", "total_spent", "order_count"], f"""
        SELECT c.customer_id, c.name, ROUND(SUM(oi.quantity*oi.unit_price), 2) AS t, COUNT(DISTINCT o.order_id) {COMPLETED}
        JOIN customers c ON c.customer_id = o.customer_id GROUP BY 1, 2 ORDER BY t DESC, 1 LIMIT 5"""),
    "MONTHLY_REVENUE": (["month", "orders", "revenue"], f"""
        SELECT substr(o.order_date,1,7) AS m, COUNT(DISTINCT o.order_id), ROUND(SUM(oi.quantity*oi.unit_price), 2) {COMPLETED}
        GROUP BY m ORDER BY m"""),
    "CUSTOMERS_WITHOUT_ORDERS": (["customer_id", "name"], """
        SELECT customer_id, name FROM customers WHERE customer_id NOT IN (SELECT customer_id FROM orders) ORDER BY 1"""),
    "RUNNING_REVENUE": (["month", "revenue", "running_revenue"], f"""
        WITH m AS (SELECT substr(o.order_date,1,7) AS m, SUM(oi.quantity*oi.unit_price) AS r {COMPLETED} GROUP BY 1)
        SELECT m, ROUND(r, 2), ROUND(SUM(r) OVER (ORDER BY m), 2) FROM m ORDER BY m"""),
    "TOP_PRODUCT_PER_CATEGORY": (["category", "product", "units"], f"""
        WITH u AS (SELECT p.category c, p.name n, SUM(oi.quantity) q {COMPLETED}
                   JOIN products p ON p.product_id = oi.product_id GROUP BY 1, 2)
        SELECT c, n, q FROM (SELECT c, n, q, ROW_NUMBER() OVER (PARTITION BY c ORDER BY q DESC, n) rn FROM u)
        WHERE rn = 1 ORDER BY c"""),
}


@pytest.fixture(scope="module")
def db():
    conn = sqlite3.connect(":memory:")
    conn.executescript(DB_SQL)
    yield conn
    conn.close()


def _norm(rows):
    return [tuple(round(v, 2) if isinstance(v, float) else v for v in r) for r in rows]


def _check(db, name):
    sql = getattr(sub, name)
    try:
        cur = db.execute(sql)
    except sqlite3.Error as e:
        pytest.fail(f"{name} failed to run: {e}")
    cols = [d[0] for d in cur.description]
    got = _norm(cur.fetchall())
    expected_cols, ref_sql = REFERENCE[name]
    want = _norm(db.execute(ref_sql).fetchall())
    assert cols == expected_cols, f"{name}: columns {cols}, expected {expected_cols} (check shape and aliases)"
    assert len(got) == len(want), f"{name}: returned {len(got)} rows, expected {len(want)}"
    assert got == want, f"{name}: first differing row {next(g for g, w in zip(got, want) if g != w)} vs expected {next(w for g, w in zip(got, want) if g != w)}"


def test_revenue_by_category(db):
    _check(db, "REVENUE_BY_CATEGORY")


def test_top_customers(db):
    _check(db, "TOP_CUSTOMERS")


def test_monthly_revenue(db):
    _check(db, "MONTHLY_REVENUE")


def test_customers_without_orders(db):
    _check(db, "CUSTOMERS_WITHOUT_ORDERS")


def test_running_revenue(db):
    _check(db, "RUNNING_REVENUE")


def test_top_product_per_category(db):
    _check(db, "TOP_PRODUCT_PER_CATEGORY")


def test_queries_are_read_only():
    for name in REFERENCE:
        sql = re.sub(r"--[^\n]*", "", getattr(sub, name)).strip().rstrip(";").strip()
        assert re.match(r"(?is)^(select|with)\b", sql), f"{name} must start with SELECT or WITH"
        assert ";" not in sql, f"{name} must be a single statement"
        assert not re.search(r"(?i)\b(insert|update|delete|drop|alter|create|attach|pragma)\b", sql), f"{name} must be read-only"
