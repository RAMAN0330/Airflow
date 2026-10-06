"""Run untrusted SQL against a sample dataset in a resource-limited subprocess (the SQL Playground).

Each run loads a fresh in-memory copy of the dataset, so writes are harmless and never persist.
"""
import json
import os
import signal
import sqlite3
import subprocess
import sys
from pathlib import Path

from grader.run import _limits

CHILD = Path(__file__).with_name("_sql_child.py")


def run_sql(sql: str, dataset: Path, *, timeout: float = 5.0, max_rows: int = 500) -> dict:
    proc = subprocess.Popen(
        [sys.executable, str(CHILD)],
        stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
        env={"PATH": os.environ.get("PATH", "/usr/bin:/bin"), "PYTHONDONTWRITEBYTECODE": "1"},
        preexec_fn=_limits(int(timeout) + 1, 512),
    )
    request = json.dumps({"sql": sql, "dataset": str(dataset), "max_rows": max_rows})
    try:
        out, err = proc.communicate(request, timeout=timeout)
    except subprocess.TimeoutExpired:
        os.killpg(proc.pid, signal.SIGKILL)
        proc.communicate()
        return _error(f"Query exceeded the {timeout:g}s time limit.")
    if proc.returncode != 0 or not out:
        return _error("Query was stopped: it exceeded the sandbox's resource limits.")
    return json.loads(out)


def _error(message: str) -> dict:
    return {"results": [], "statements": 0, "error": message, "duration_ms": 0.0}


def describe(dataset: Path) -> list[dict]:
    """Tables, columns, keys and row counts of a trusted dataset (runs in-process)."""
    conn = sqlite3.connect(":memory:")
    conn.executescript(dataset.read_text())
    tables = []
    for (name,) in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY rowid"):
        fks = {r[3]: f"{r[2]}.{r[4]}" for r in conn.execute(f"PRAGMA foreign_key_list({name})")}
        cols = [
            {"name": c[1], "type": c[2] or "ANY", "pk": bool(c[5]), "references": fks.get(c[1])}
            for c in conn.execute(f"PRAGMA table_info({name})")
        ]
        count = conn.execute(f"SELECT COUNT(*) FROM {name}").fetchone()[0]
        tables.append({"name": name, "row_count": count, "columns": cols})
    conn.close()
    return tables
