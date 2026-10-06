"""Hidden validation suite for sql_indexes_transactions."""
import sqlite3
from pathlib import Path

import pytest

import submission as sub

DB_SQL = (Path(__file__).parent / "fixtures" / "shop.sql").read_text()
Q_CUSTOMER = "SELECT order_id, order_date FROM orders WHERE customer_id = ? AND order_date >= ?"
Q_PRODUCT = "SELECT SUM(quantity) FROM order_items WHERE product_id = ?"


@pytest.fixture
def db():
    conn = sqlite3.connect(":memory:")
    conn.executescript(DB_SQL)
    conn.executescript("""
        CREATE TABLE inventory (warehouse TEXT NOT NULL, product_id INTEGER NOT NULL,
                                qty INTEGER NOT NULL CHECK (qty >= 0), PRIMARY KEY (warehouse, product_id));
        INSERT INTO inventory VALUES ('berlin', 1, 10), ('lagos', 1, 3), ('o''hare', 2, 5);
    """)
    yield conn
    conn.close()


def plan(conn, sql, params):
    return [r[3] for r in conn.execute("EXPLAIN QUERY PLAN " + sql, params).fetchall()]


def qty(conn, wh, pid):
    row = conn.execute("SELECT qty FROM inventory WHERE warehouse = ? AND product_id = ?", (wh, pid)).fetchone()
    return None if row is None else row[0]


def test_customer_orders_query_uses_index(db):
    before = plan(db, Q_CUSTOMER, (3, "2025-06-01"))
    assert any(d.startswith("SCAN") for d in before), "sanity: query should scan before indexing"
    sub.create_indexes(db)
    after = plan(db, Q_CUSTOMER, (3, "2025-06-01"))
    assert not any(d.startswith("SCAN orders") for d in after), f"still scanning: {after}"
    assert any("USING INDEX" in d or "USING COVERING INDEX" in d for d in after), f"plan: {after}"


def test_product_lookup_uses_index(db):
    sub.create_indexes(db)
    p = plan(db, Q_PRODUCT, (2,))
    assert not any(d.startswith("SCAN order_items") for d in p), f"still scanning order_items: {p}"


def test_create_indexes_is_idempotent(db):
    sub.create_indexes(db)
    sub.create_indexes(db)


def test_keyset_pagination(db):
    seen, after = [], 0
    while True:
        page = sub.orders_page(db, after, 7)
        assert len(page) <= 7
        if not page:
            break
        ids = [r[0] for r in page]
        assert ids == sorted(ids) and ids[0] > after, "pages must be ordered and start after the cursor"
        seen += ids
        after = ids[-1]
    assert seen == [r[0] for r in db.execute("SELECT order_id FROM orders ORDER BY order_id")]
    assert len(sub.orders_page(db, 0, 3)[0]) == 2, "rows are (order_id, order_date)"


def test_transfer_moves_stock(db):
    assert sub.transfer_stock(db, 1, "berlin", "lagos", 4) == (6, 7)
    assert (qty(db, "berlin", 1), qty(db, "lagos", 1)) == (6, 7)


def test_transfer_creates_destination_row(db):
    assert sub.transfer_stock(db, 1, "berlin", "tokyo", 10) == (0, 10)
    assert qty(db, "tokyo", 1) == 10


def test_insufficient_stock_rolls_back(db):
    with pytest.raises(ValueError):
        sub.transfer_stock(db, 1, "lagos", "berlin", 4)
    assert (qty(db, "lagos", 1), qty(db, "berlin", 1)) == (3, 10)
    assert not db.in_transaction, "a transaction was left open"


def test_invalid_quantity_rejected(db):
    for bad in (0, -5):
        with pytest.raises(ValueError):
            sub.transfer_stock(db, 1, "berlin", "lagos", bad)
    assert qty(db, "berlin", 1) == 10


def test_failure_midway_is_atomic(db):
    # The destination write fails *after* the source was decremented.
    db.executescript("""
        CREATE TRIGGER no_broken_insert BEFORE INSERT ON inventory WHEN NEW.warehouse = 'broken'
        BEGIN SELECT RAISE(ABORT, 'disk on fire'); END;
    """)
    with pytest.raises(sqlite3.DatabaseError):
        sub.transfer_stock(db, 1, "berlin", "broken", 4)
    assert not db.in_transaction, "the failed transaction must be rolled back, not left open"
    db.commit()  # would persist a half-done transfer if it hadn't been rolled back
    assert qty(db, "berlin", 1) == 10, "source was decremented even though the transfer failed"


def test_queries_are_parameterized(db):
    assert sub.transfer_stock(db, 2, "o'hare", "x'); DROP TABLE inventory; --", 2) == (3, 2)
    assert db.execute("SELECT count(*) FROM sqlite_master WHERE name = 'inventory'").fetchone()[0] == 1
