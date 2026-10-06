"""Executed in a resource-limited subprocess by grader.sql_runner. Reads a JSON request on stdin."""
import json
import sqlite3
import sys
import time

MAX_VM_STEPS = 50_000_000
MAX_RESULTS = 10


def split_statements(sql: str) -> list[str]:
    statements, buf = [], ""
    for ch in sql:
        buf += ch
        if ch == ";" and sqlite3.complete_statement(buf):
            if buf.strip(" \n\t;"):
                statements.append(buf.strip())
            buf = ""
    if buf.strip(" \n\t;"):
        statements.append(buf.strip())
    return statements


def cell(v):
    return v.hex() if isinstance(v, (bytes, bytearray)) else v


def main():
    req = json.loads(sys.stdin.read())
    conn = sqlite3.connect(":memory:")
    conn.executescript(open(req["dataset"]).read())
    steps = {"n": 0}

    def guard():
        steps["n"] += 1000
        return 1 if steps["n"] > MAX_VM_STEPS else 0  # non-zero aborts the statement

    conn.set_progress_handler(guard, 1000)
    out = {"results": [], "statements": 0, "error": None}
    start = time.perf_counter()
    try:
        statements = split_statements(req["sql"])
        if not statements:
            raise ValueError("Write a SQL statement to run.")
        for i, stmt in enumerate(statements):
            cur = conn.execute(stmt)
            out["statements"] = i + 1
            if cur.description:
                rows = cur.fetchmany(req["max_rows"] + 1)
                out["results"].append({
                    "statement": i + 1,
                    "sql": stmt[:200],
                    "columns": [d[0] for d in cur.description],
                    "rows": [[cell(v) for v in r] for r in rows[: req["max_rows"]]],
                    "truncated": len(rows) > req["max_rows"],
                })
                if len(out["results"]) >= MAX_RESULTS:
                    break
            else:
                out["results"].append({"statement": i + 1, "sql": stmt[:200], "columns": [], "rows": [],
                                       "truncated": False, "rows_affected": max(cur.rowcount, 0)})
    except sqlite3.OperationalError as e:
        out["error"] = "Query was stopped: it exceeded the work limit." if "interrupted" in str(e) else f"SQL error: {e}"
    except (sqlite3.Error, ValueError) as e:
        out["error"] = f"SQL error: {e}" if isinstance(e, sqlite3.Error) else str(e)
    out["duration_ms"] = round((time.perf_counter() - start) * 1000, 2)
    sys.stdout.write(json.dumps(out))


if __name__ == "__main__":
    main()
