"""Hidden validation suite for data_quality_checks."""
import pytest

import submission as sub

ROWS = [
    {"order_id": 1, "email": "a@x.io", "status": "completed", "amount": 10.0, "customer_id": 7},
    {"order_id": 2, "email": "", "status": "completed", "amount": 25.5, "customer_id": 8},
    {"order_id": 3, "email": "c@x.io", "status": "shipped??", "amount": -4, "customer_id": 99},
    {"order_id": 3, "email": None, "status": None, "amount": None, "customer_id": None},
    {"order_id": 5, "email": "  ", "status": "pending", "amount": "12", "customer_id": 7},
    {"order_id": None, "email": "f@x.io", "status": "cancelled", "amount": 1e9, "customer_id": 8},
]


def test_not_null():
    r = sub.check_not_null(ROWS, "email")
    assert (r["passed"], r["failures"], r["sample"]) == (False, 3, [1, 3, 4])
    assert sub.check_not_null(ROWS, "customer_id")["failures"] == 1


def test_unique():
    r = sub.check_unique(ROWS, "order_id")
    assert (r["failures"], r["sample"]) == (2, [2, 3]), "both copies of order_id 3 fail; None is ignored"
    assert sub.check_unique(ROWS, "customer_id")["failures"] == 4


def test_accepted_values():
    r = sub.check_accepted_values(ROWS, "status", ["completed", "pending", "cancelled"])
    assert (r["passed"], r["sample"]) == (False, [2])


def test_range():
    r = sub.check_range(ROWS, "amount", min=0, max=10_000)
    assert r["sample"] == [2, 4, 5], "negative, non-numeric string and too-large values fail; None is skipped"
    assert sub.check_range(ROWS, "amount", min=0)["sample"] == [2, 4]


def test_relationships():
    r = sub.check_relationships(ROWS, "customer_id", parents=[7, 8, 9])
    assert (r["failures"], r["sample"]) == (1, [2])


def test_result_shape_and_sample_cap():
    rows = [{"x": None} for _ in range(12)]
    r = sub.check_not_null(rows, "x")
    assert set(r) == {"check", "column", "passed", "failures", "sample"}
    assert r["check"] == "not_null" and r["column"] == "x"
    assert r["failures"] == 12 and r["sample"] == [0, 1, 2, 3, 4]
    ok = sub.check_not_null([{"x": 1}], "x")
    assert ok["passed"] is True and ok["sample"] == []


def test_suite_severity():
    suite = [
        {"check": "not_null", "column": "order_id"},
        {"check": "accepted_values", "column": "status", "values": ["completed", "pending", "cancelled"], "severity": "warn"},
    ]
    report = sub.run_suite(ROWS, suite)
    assert report["passed"] is False and report["summary"] == {"errors": 1, "warnings": 1}
    assert [r["severity"] for r in report["results"]] == ["error", "warn"]
    only_warn = sub.run_suite(ROWS, suite[1:])
    assert only_warn["passed"] is True and only_warn["summary"] == {"errors": 0, "warnings": 1}
    clean = sub.run_suite([{"order_id": 1}], [{"check": "unique", "column": "order_id"}])
    assert clean["passed"] is True and clean["results"][0]["passed"] is True


def test_suite_rejects_unknown_check():
    with pytest.raises(ValueError):
        sub.run_suite(ROWS, [{"check": "is_vibes", "column": "status"}])


EVENTS = [
    {"id": 3, "updated_at": "2025-03-03T00:00:00"},
    {"id": 1, "updated_at": "2025-03-01T00:00:00"},
    {"id": 2, "updated_at": "2025-03-02T00:00:00"},
]


def test_incremental_first_and_next_runs():
    batch, wm = sub.incremental_batch(EVENTS, None)
    assert [r["id"] for r in batch] == [1, 2, 3] and wm == "2025-03-03T00:00:00"
    more = EVENTS + [{"id": 4, "updated_at": "2025-03-04T00:00:00"}, {"id": 5, "updated_at": "2025-03-03T00:00:00"}]
    batch, wm2 = sub.incremental_batch(more, wm)
    assert [r["id"] for r in batch] == [4], "rows at or before the watermark were already loaded"
    assert wm2 == "2025-03-04T00:00:00"


def test_incremental_no_new_rows_keeps_watermark():
    batch, wm = sub.incremental_batch(EVENTS, "2025-03-03T00:00:00")
    assert batch == [] and wm == "2025-03-03T00:00:00"
