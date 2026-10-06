"""Reference solution — never shipped to learners."""
from collections import Counter

SAMPLE = 5


def _is_null(v):
    return v is None or (isinstance(v, str) and not v.strip())


def _result(check, column, failing):
    return {"check": check, "column": column, "passed": not failing, "failures": len(failing), "sample": failing[:SAMPLE]}


def check_not_null(rows, column):
    return _result("not_null", column, [i for i, r in enumerate(rows) if _is_null(r.get(column))])


def check_unique(rows, column):
    counts = Counter(r.get(column) for r in rows if not _is_null(r.get(column)))
    return _result("unique", column, [i for i, r in enumerate(rows) if not _is_null(r.get(column)) and counts[r[column]] > 1])


def check_accepted_values(rows, column, values):
    allowed = set(values)
    return _result("accepted_values", column,
                   [i for i, r in enumerate(rows) if not _is_null(r.get(column)) and r[column] not in allowed])


def check_range(rows, column, min=None, max=None):
    failing = []
    for i, r in enumerate(rows):
        v = r.get(column)
        if _is_null(v):
            continue
        if isinstance(v, bool) or not isinstance(v, (int, float)):
            failing.append(i)
        elif (min is not None and v < min) or (max is not None and v > max):
            failing.append(i)
    return _result("range", column, failing)


def check_relationships(rows, column, parents):
    keys = set(parents)
    return _result("relationships", column,
                   [i for i, r in enumerate(rows) if not _is_null(r.get(column)) and r[column] not in keys])


CHECKS = {
    "not_null": check_not_null,
    "unique": check_unique,
    "accepted_values": check_accepted_values,
    "range": check_range,
    "relationships": check_relationships,
}


def run_suite(rows, suite):
    results, errors, warnings = [], 0, 0
    for spec in suite:
        spec = dict(spec)
        name, column = spec.pop("check"), spec.pop("column")
        severity = spec.pop("severity", "error")
        if name not in CHECKS:
            raise ValueError(f"unknown check {name!r}")
        res = {**CHECKS[name](rows, column, **spec), "severity": severity}
        if not res["passed"]:
            if severity == "error":
                errors += 1
            else:
                warnings += 1
        results.append(res)
    return {"passed": errors == 0, "results": results, "summary": {"errors": errors, "warnings": warnings}}


def incremental_batch(rows, watermark):
    batch = sorted((r for r in rows if watermark is None or r["updated_at"] > watermark), key=lambda r: r["updated_at"])
    return batch, (batch[-1]["updated_at"] if batch else watermark)
