"""SQLite persistence for submissions. Progress is derived from submissions."""
import json
import sqlite3
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = """
CREATE TABLE IF NOT EXISTS submissions (
    id           TEXT PRIMARY KEY,
    user_id      TEXT NOT NULL,
    exercise_id  TEXT NOT NULL,
    code         TEXT NOT NULL,
    status       TEXT NOT NULL,
    passed_tests INTEGER NOT NULL,
    total_tests  INTEGER NOT NULL,
    score        REAL NOT NULL,
    duration_ms  INTEGER NOT NULL,
    result_json  TEXT NOT NULL,
    created_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS ix_submissions_user_ex ON submissions (user_id, exercise_id, created_at);
CREATE INDEX IF NOT EXISTS ix_submissions_user_time ON submissions (user_id, created_at);
"""


class Database:
    def __init__(self, path: Path):
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with self.connect() as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(SCHEMA)

    @contextmanager
    def connect(self):
        conn = sqlite3.connect(self.path, timeout=10)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
            conn.commit()
        finally:
            conn.close()

    def add_submission(self, user_id: str, exercise_id: str, code: str, result: dict) -> dict:
        row = {
            "id": uuid.uuid4().hex,
            "user_id": user_id,
            "exercise_id": exercise_id,
            "code": code,
            "status": result["status"],
            "passed_tests": result["passed_tests"],
            "total_tests": result["total_tests"],
            "score": result["score"],
            "duration_ms": result["duration_ms"],
            "result_json": json.dumps(result),
            "created_at": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        }
        with self.connect() as conn:
            conn.execute(
                f"INSERT INTO submissions ({', '.join(row)}) VALUES ({', '.join('?' * len(row))})",
                list(row.values()),
            )
        return row

    def list_submissions(self, user_id: str, exercise_id: str | None = None, limit: int = 20) -> list[dict]:
        sql = "SELECT * FROM submissions WHERE user_id = ?"
        args: list = [user_id]
        if exercise_id:
            sql += " AND exercise_id = ?"
            args.append(exercise_id)
        sql += " ORDER BY created_at DESC LIMIT ?"
        args.append(limit)
        with self.connect() as conn:
            return [dict(r) for r in conn.execute(sql, args)]

    def exercise_stats(self, user_id: str) -> dict[str, dict]:
        sql = """
            SELECT exercise_id,
                   COUNT(*)                                   AS attempts,
                   MAX(score)                                 AS best_score,
                   SUM(status = 'passed')                     AS passes,
                   SUM(status = 'passed') > 0                 AS completed,
                   MIN(CASE WHEN status = 'passed' THEN created_at END) AS completed_at,
                   MAX(created_at)                            AS last_attempt_at
            FROM submissions WHERE user_id = ? GROUP BY exercise_id
        """
        with self.connect() as conn:
            return {r["exercise_id"]: dict(r) for r in conn.execute(sql, [user_id])}

    def activity(self, user_id: str, days: int = 84) -> list[dict]:
        sql = """
            SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS submissions, SUM(status = 'passed') AS passed
            FROM submissions WHERE user_id = ? AND created_at >= date('now', ?)
            GROUP BY day ORDER BY day
        """
        with self.connect() as conn:
            return [dict(r) for r in conn.execute(sql, [user_id, f"-{days} days"])]
