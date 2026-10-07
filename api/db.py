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

CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    plan         TEXT NOT NULL DEFAULT 'free',
    created_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS lesson_completions (
    user_id      TEXT NOT NULL,
    lesson_id    TEXT NOT NULL,
    completed_at TEXT NOT NULL,
    PRIMARY KEY (user_id, lesson_id)
);
"""


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


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
            "created_at": now_iso(),
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

    def active_days(self, user_id: str) -> list[str]:
        """UTC days (YYYY-MM-DD, ascending) with a passing submission or a lesson completion."""
        sql = """
            SELECT substr(created_at, 1, 10) AS day FROM submissions WHERE user_id = ? AND status = 'passed'
            UNION
            SELECT substr(completed_at, 1, 10) AS day FROM lesson_completions WHERE user_id = ?
            ORDER BY day
        """
        with self.connect() as conn:
            return [r["day"] for r in conn.execute(sql, [user_id, user_id])]

    def latest_passing_code(self, user_id: str, exercise_id: str) -> str | None:
        with self.connect() as conn:
            row = conn.execute(
                "SELECT code FROM submissions WHERE user_id = ? AND exercise_id = ? AND status = 'passed' "
                "ORDER BY created_at DESC LIMIT 1",
                [user_id, exercise_id],
            ).fetchone()
            return row["code"] if row else None

    # ------------------------------------------------------------- users

    def ensure_user(self, user_id: str, default_name: str) -> dict:
        with self.connect() as conn:
            conn.execute(
                "INSERT OR IGNORE INTO users (id, display_name, plan, created_at) VALUES (?, ?, 'free', ?)",
                [user_id, default_name, now_iso()],
            )
            return dict(conn.execute("SELECT * FROM users WHERE id = ?", [user_id]).fetchone())

    def update_user(self, user_id: str, **fields) -> dict:
        assert set(fields) <= {"display_name", "plan"}
        with self.connect() as conn:
            conn.execute(
                f"UPDATE users SET {', '.join(f'{k} = ?' for k in fields)} WHERE id = ?",
                [*fields.values(), user_id],
            )
            return dict(conn.execute("SELECT * FROM users WHERE id = ?", [user_id]).fetchone())

    # ------------------------------------------------------------- lessons

    def completed_lessons(self, user_id: str) -> dict[str, str]:
        with self.connect() as conn:
            rows = conn.execute("SELECT lesson_id, completed_at FROM lesson_completions WHERE user_id = ?", [user_id])
            return {r["lesson_id"]: r["completed_at"] for r in rows}

    def complete_lesson(self, user_id: str, lesson_id: str) -> bool:
        """Record a completion; returns True only the first time."""
        with self.connect() as conn:
            cur = conn.execute(
                "INSERT OR IGNORE INTO lesson_completions (user_id, lesson_id, completed_at) VALUES (?, ?, ?)",
                [user_id, lesson_id, now_iso()],
            )
            return cur.rowcount == 1

    # ------------------------------------------------------------- leaderboard

    def xp_events(self) -> list[dict]:
        """Every XP-earning event: first pass of each exercise and each lesson completion, per user."""
        sql = """
            SELECT user_id, 'exercise' AS kind, exercise_id AS ref, MIN(created_at) AS at
            FROM submissions WHERE status = 'passed' GROUP BY user_id, exercise_id
            UNION ALL
            SELECT user_id, 'lesson' AS kind, lesson_id AS ref, completed_at AS at FROM lesson_completions
        """
        with self.connect() as conn:
            return [dict(r) for r in conn.execute(sql)]

    def users_by_id(self, ids: list[str]) -> dict[str, dict]:
        if not ids:
            return {}
        with self.connect() as conn:
            rows = conn.execute(f"SELECT * FROM users WHERE id IN ({', '.join('?' * len(ids))})", ids)
            return {r["id"]: dict(r) for r in rows}
