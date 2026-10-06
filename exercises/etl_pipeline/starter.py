"""Extract → Transform → Load: CSV export to a clean, idempotent fact table."""
import csv
import io
import sqlite3
from datetime import datetime


def extract(csv_text: str) -> list[dict]:
    """Parse CSV text into dicts with whitespace-stripped keys and values."""
    # TODO: csv.DictReader(io.StringIO(csv_text))
    raise NotImplementedError


def transform(rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Return (clean, rejects). Rejects keep the original fields plus a 'reason'."""
    # TODO: validate + normalize each row, then keep the latest updated_at per order_id
    raise NotImplementedError


def load(conn: sqlite3.Connection, clean: list[dict]) -> int:
    """Create fact_orders if needed and upsert every row. Return the number of rows written."""
    # TODO: CREATE TABLE IF NOT EXISTS ...; INSERT ... ON CONFLICT(order_id) DO UPDATE ...
    raise NotImplementedError


def run_pipeline(conn: sqlite3.Connection, csv_text: str) -> dict:
    """Run extract → transform → load and return {'extracted', 'loaded', 'rejected'}."""
    # TODO
    raise NotImplementedError
