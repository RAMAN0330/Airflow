"""Hidden validation suite for etl_pipeline."""
import sqlite3

import pytest

import submission as sub

CSV = """order_id,customer_email,amount,currency,order_date,country,updated_at
1001, Ana@Example.com ,120.50,usd,2025-03-01,us,2025-03-01T10:00:00
1002,"ben, jr@example.com",80,EUR,02/03/2025,de,2025-03-02T09:00:00
1003,chen@example.com,oops,USD,2025-03-03,jp,2025-03-03T08:00:00
1004,dara@example.com,-5,USD,2025-03-04,in,2025-03-04T08:00:00
1005,eli@example.com,30,USD,03-04-2025,br,2025-03-05T08:00:00
,ghost@example.com,10,USD,2025-03-06,us,2025-03-06T08:00:00
1001,ana@example.com,125.00,USD,2025-03-01,US,2025-03-01T12:00:00
1006,fatima@example.com,42.10,gbp,2025-03-07,gb,2025-03-07T08:00:00
1006,fatima@example.com,40.00,GBP,2025-03-07,GB,2025-03-06T23:00:00
"""
CORRECTION = """order_id,customer_email,amount,currency,order_date,country,updated_at
1002,ben@example.com,85,EUR,2025-03-02,DE,2025-03-09T09:00:00
1007,goran@example.com,15,EUR,2025-03-09,de,2025-03-09T10:00:00
"""
KEYS = {"order_id", "customer_email", "amount", "currency", "order_date", "country", "updated_at"}


@pytest.fixture
def conn():
    c = sqlite3.connect(":memory:")
    yield c
    c.close()


def by_id(rows):
    return {r["order_id"]: r for r in rows}


def test_extract_handles_quotes_and_whitespace():
    rows = sub.extract(CSV)
    assert len(rows) == 9
    assert rows[0]["customer_email"] == "Ana@Example.com"
    assert rows[1]["customer_email"] == "ben, jr@example.com", "a quoted comma must stay inside the field"
    assert set(rows[0]) == KEYS


def test_transform_normalizes_fields():
    clean, _ = sub.transform(sub.extract(CSV))
    row = by_id(clean)[1006]
    assert set(row) == KEYS
    assert row["currency"] == "GBP" and row["country"] == "GB"
    assert isinstance(row["order_id"], int) and isinstance(row["amount"], float)
    assert by_id(clean)[1001]["customer_email"] == "ana@example.com"


def test_transform_parses_both_date_formats():
    clean, _ = sub.transform(sub.extract(CSV))
    assert by_id(clean)[1002]["order_date"] == "2025-03-02"
    assert by_id(clean)[1001]["order_date"] == "2025-03-01"


def test_transform_rejects_bad_rows_with_reason():
    clean, rejects = sub.transform(sub.extract(CSV))
    assert {r.get("order_id") for r in rejects} == {"1003", "1004", "1005", ""}
    assert all(r.get("reason") for r in rejects), "every reject needs a reason"
    assert {r["order_id"] for r in clean} == {1001, 1002, 1006}


def test_transform_keeps_latest_version_per_order():
    clean, _ = sub.transform(sub.extract(CSV))
    assert len(clean) == 3
    assert by_id(clean)[1001]["amount"] == 125.0, "the 12:00 version of 1001 is newer"
    assert by_id(clean)[1006]["amount"] == 42.1, "the 2025-03-07 version of 1006 is newer"


def test_load_creates_table_and_upserts(conn):
    clean, _ = sub.transform(sub.extract(CSV))
    assert sub.load(conn, clean) == 3
    rows = conn.execute("SELECT order_id, amount FROM fact_orders ORDER BY order_id").fetchall()
    assert rows == [(1001, 125.0), (1002, 80.0), (1006, 42.1)]
    pk = [r[1] for r in conn.execute("PRAGMA table_info(fact_orders)") if r[5]]
    assert pk == ["order_id"], "order_id must be the primary key"


def test_pipeline_is_idempotent(conn):
    sub.run_pipeline(conn, CSV)
    first = conn.execute("SELECT * FROM fact_orders ORDER BY order_id").fetchall()
    sub.run_pipeline(conn, CSV)
    assert conn.execute("SELECT * FROM fact_orders ORDER BY order_id").fetchall() == first


def test_rerun_applies_corrections(conn):
    sub.run_pipeline(conn, CSV)
    sub.run_pipeline(conn, CORRECTION)
    rows = dict(conn.execute("SELECT order_id, amount FROM fact_orders").fetchall())
    assert rows[1002] == 85.0 and rows[1007] == 15.0 and len(rows) == 4


def test_pipeline_metrics(conn):
    assert sub.run_pipeline(conn, CSV) == {"extracted": 9, "loaded": 3, "rejected": 4}
