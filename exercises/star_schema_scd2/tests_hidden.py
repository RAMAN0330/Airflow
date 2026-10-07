"""Hidden validation suite for star_schema_scd2."""
import copy
import sqlite3
from datetime import date, timedelta
from pathlib import Path

import pytest

import submission as sub

DB_SQL = (Path(__file__).parent / "fixtures" / "shop.sql").read_text()
OPEN_END = "9999-12-31"
DIM_COLS = "customer_key, customer_id, name, country, valid_from, valid_to, is_current"


@pytest.fixture
def db():
    conn = sqlite3.connect(":memory:")
    conn.executescript(DB_SQL)
    yield conn
    conn.close()


@pytest.fixture
def star(db):
    sub.build_star(db)
    return db


def snapshot(conn):
    return [{"customer_id": i, "name": n, "country": c}
            for i, n, c in conn.execute("SELECT customer_id, name, country FROM customers ORDER BY customer_id")]


def versions(conn, customer_id):
    return conn.execute(f"SELECT {DIM_COLS} FROM dim_customer WHERE customer_id = ? ORDER BY valid_from",
                        (customer_id,)).fetchall()


def run_query(conn):
    try:
        cur = conn.execute(sub.REVENUE_BY_COUNTRY_QUARTER)
    except sqlite3.Error as e:
        pytest.fail(f"REVENUE_BY_COUNTRY_QUARTER failed to run: {e}")
    return [d[0] for d in cur.description], [tuple(round(v, 2) if isinstance(v, float) else v for v in r)
                                             for r in cur.fetchall()]


def test_dimensions_have_surrogate_keys(star):
    n_cust = star.execute("SELECT COUNT(*) FROM customers").fetchone()[0]
    rows = star.execute(f"SELECT {DIM_COLS} FROM dim_customer").fetchall()
    assert len(rows) == n_cust, "dim_customer starts with one row per customer"
    keys = [r[0] for r in rows]
    assert len(set(keys)) == len(keys) and all(isinstance(k, int) for k in keys), "customer_key must be a unique integer"
    assert {r[1] for r in rows} == {r[0] for r in star.execute("SELECT customer_id FROM customers")}
    assert all(r[5] == OPEN_END and r[6] == 1 for r in rows), "initial rows are current with valid_to = '9999-12-31'"
    prods = star.execute("SELECT product_key, product_id, name, category FROM dim_product").fetchall()
    assert len(prods) == star.execute("SELECT COUNT(*) FROM products").fetchone()[0]
    assert len({p[0] for p in prods}) == len(prods)


def test_dim_date_is_contiguous(star):
    lo, hi = star.execute("SELECT MIN(order_date), MAX(order_date) FROM orders").fetchone()
    rows = star.execute("SELECT date_key, full_date, year, month, quarter FROM dim_date ORDER BY full_date").fetchall()
    d0, d1 = date.fromisoformat(lo), date.fromisoformat(hi)
    expected = [d0 + timedelta(days=i) for i in range((d1 - d0).days + 1)]
    assert [r[1] for r in rows] == [d.isoformat() for d in expected], "one row per calendar day, no gaps"
    for (key, full, y, m, q), d in zip(rows, expected):
        assert key == int(d.strftime("%Y%m%d")), f"date_key for {full} should be {d.strftime('%Y%m%d')}"
        assert (y, m, q) == (d.year, d.month, (d.month - 1) // 3 + 1), f"wrong calendar attributes for {full}"


def test_fact_grain_is_order_line(star):
    lines = star.execute("""SELECT COUNT(*), SUM(oi.quantity * oi.unit_price) FROM order_items oi
                            JOIN orders o ON o.order_id = oi.order_id WHERE o.status = 'completed'""").fetchone()
    n, total = star.execute("SELECT COUNT(*), SUM(revenue) FROM fact_sales").fetchone()
    assert n == lines[0], f"fact_sales has {n} rows; the grain is one row per completed order line ({lines[0]})"
    dup = star.execute("SELECT COUNT(*) FROM (SELECT order_id, product_key FROM fact_sales "
                       "GROUP BY 1, 2 HAVING COUNT(*) > 1)").fetchone()[0]
    assert dup == 0, "(order_id, product_key) must be unique at order-line grain"
    assert total == pytest.approx(lines[1]), "revenue must be quantity * unit_price per line"
    bad = star.execute("SELECT COUNT(*) FROM fact_sales WHERE abs(revenue - quantity * unit_price) > 1e-9").fetchone()[0]
    assert bad == 0


def test_fact_foreign_keys_resolve(star):
    for dim, key in (("dim_customer", "customer_key"), ("dim_product", "product_key"), ("dim_date", "date_key")):
        orphans = star.execute(f"SELECT COUNT(*) FROM fact_sales f LEFT JOIN {dim} d ON d.{key} = f.{key} "
                               f"WHERE d.{key} IS NULL").fetchone()[0]
        assert orphans == 0, f"{orphans} fact rows point at a missing {dim} row"
    wrong = star.execute("""
        SELECT COUNT(*) FROM fact_sales f
        JOIN dim_date d ON d.date_key = f.date_key
        JOIN dim_customer c ON c.customer_key = f.customer_key
        JOIN dim_product p ON p.product_key = f.product_key
        JOIN orders o ON o.order_id = f.order_id
        JOIN order_items oi ON oi.order_id = f.order_id AND oi.product_id = p.product_id
        WHERE d.full_date != o.order_date OR c.customer_id != o.customer_id""").fetchone()[0]
    assert wrong == 0, "fact rows must point at the right date, customer and product"


def test_revenue_query_matches_oltp(db):
    want = [tuple(r) for r in db.execute("""
        SELECT c.country, CAST(substr(o.order_date, 1, 4) AS INTEGER) AS y,
               (CAST(substr(o.order_date, 6, 2) AS INTEGER) + 2) / 3 AS q,
               ROUND(SUM(oi.quantity * oi.unit_price), 2) AS r
        FROM order_items oi JOIN orders o ON o.order_id = oi.order_id AND o.status = 'completed'
        JOIN customers c ON c.customer_id = o.customer_id
        GROUP BY 1, 2, 3 ORDER BY y, q, r DESC, c.country""")]
    sub.build_star(db)
    db.executescript("PRAGMA foreign_keys = OFF; DROP TABLE order_items; DROP TABLE orders; "
                     "DROP TABLE customers; DROP TABLE products;")  # the query must use only the star
    cols, got = run_query(db)
    assert cols == ["country", "year", "quarter", "revenue"], f"columns {cols}"
    assert got == want


def test_scd2_change_adds_version_and_closes_old(star):
    snap = snapshot(star)
    old_key = versions(star, 3)[0][0]
    snap[2] = {**snap[2], "country": "DE"}
    assert sub.apply_scd2(star, snap, "2025-07-01") == {"inserted": 0, "updated": 1, "unchanged": 23}
    snap[2] = {**snap[2], "name": "Chen Sato-Weber"}
    sub.apply_scd2(star, snap, "2025-10-01")
    v = versions(star, 3)
    assert len(v) == 3, f"each change must add a new row (type 2), found {len(v)} versions"
    assert v[0][0] == old_key and v[0][3] == "US", "the original row keeps its key and its old values"
    assert [(r[4], r[5], r[6]) for r in v] == [("1900-01-01", "2025-07-01", 0), ("2025-07-01", "2025-10-01", 0),
                                               ("2025-10-01", OPEN_END, 1)], "previous versions must be closed"
    assert (v[1][3], v[2][3], v[2][2]) == ("DE", "DE", "Chen Sato-Weber")
    assert len({r[0] for r in v}) == 3, "every version needs its own surrogate key"


def test_scd2_unchanged_rows_untouched(star):
    before = star.execute(f"SELECT {DIM_COLS} FROM dim_customer WHERE customer_id != 7 ORDER BY customer_key").fetchall()
    snap = snapshot(star)
    snap[6] = {**snap[6], "country": "FR"}
    sub.apply_scd2(star, snap, "2025-08-15")
    after = star.execute(f"SELECT {DIM_COLS} FROM dim_customer WHERE customer_id != 7 ORDER BY customer_key").fetchall()
    assert after == before, "rows whose attributes didn't change must not be modified or re-versioned"


def test_scd2_is_idempotent(star):
    snap = snapshot(star)
    snap[0] = {**snap[0], "country": "IT"}
    snap.append({"customer_id": 25, "name": "Zoe Park", "country": "KR"})
    frozen = copy.deepcopy(snap)
    first = sub.apply_scd2(star, snap, "2025-09-01")
    state = star.execute(f"SELECT {DIM_COLS} FROM dim_customer ORDER BY customer_key").fetchall()
    second = sub.apply_scd2(star, snap, "2025-09-01")
    assert first == {"inserted": 1, "updated": 1, "unchanged": 23}
    assert second == {"inserted": 0, "updated": 0, "unchanged": 25}, "re-running the same snapshot changes nothing"
    assert star.execute(f"SELECT {DIM_COLS} FROM dim_customer ORDER BY customer_key").fetchall() == state
    assert snap == frozen, "apply_scd2 must not modify its input"


def test_scd2_new_customer_inserted(star):
    snap = snapshot(star) + [{"customer_id": 25, "name": "Zoe Park", "country": "KR"}]
    res = sub.apply_scd2(star, snap, "2025-11-02")
    assert res["inserted"] == 1
    v = versions(star, 25)
    assert len(v) == 1 and v[0][2:] == ("Zoe Park", "KR", "2025-11-02", OPEN_END, 1)


def test_history_preserved_for_old_facts(star):
    _, before = run_query(star)
    old_key = sub.customer_key_at(star, 3, "2025-02-24")
    snap = snapshot(star)
    snap[2] = {**snap[2], "country": "DE"}
    sub.apply_scd2(star, snap, "2025-07-01")
    new_key = sub.customer_key_at(star, 3, "2025-07-01")
    assert old_key is not None and new_key is not None and old_key != new_key
    assert sub.customer_key_at(star, 3, "2025-06-30") == old_key
    assert sub.customer_key_at(star, 3, "2026-01-01") == new_key
    assert sub.customer_key_at(star, 999, "2025-06-30") is None
    current = star.execute("SELECT customer_id, COUNT(*) FROM dim_customer WHERE is_current = 1 "
                           "GROUP BY 1 HAVING COUNT(*) != 1").fetchall()
    assert current == [], "exactly one current row per customer"
    _, after = run_query(star)
    assert after == before, "past sales must still report the country the customer had when they bought"
