"""Reference solution — never shipped to learners."""
import csv
import io
import sqlite3
from datetime import datetime

COLUMNS = ["order_id", "customer_email", "amount", "currency", "order_date", "country", "updated_at"]


def extract(csv_text):
    reader = csv.DictReader(io.StringIO(csv_text))
    return [{(k or "").strip(): (v or "").strip() for k, v in row.items()} for row in reader]


def _parse_date(value):
    for fmt in ("%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(value, fmt).date().isoformat()
        except ValueError:
            pass
    return None


def transform(rows):
    valid, rejects = {}, []
    for row in rows:
        try:
            order_id = int(row.get("order_id", ""))
        except ValueError:
            rejects.append({**row, "reason": "invalid order_id"})
            continue
        try:
            amount = float(row.get("amount", ""))
        except ValueError:
            rejects.append({**row, "reason": "invalid amount"})
            continue
        if amount < 0:
            rejects.append({**row, "reason": "negative amount"})
            continue
        order_date = _parse_date(row.get("order_date", ""))
        if order_date is None:
            rejects.append({**row, "reason": "invalid order_date"})
            continue
        clean = {
            "order_id": order_id,
            "customer_email": row.get("customer_email", "").strip().lower(),
            "amount": amount,
            "currency": row.get("currency", "").strip().upper(),
            "order_date": order_date,
            "country": row.get("country", "").strip().upper(),
            "updated_at": row.get("updated_at", ""),
        }
        current = valid.get(order_id)
        if current is None or clean["updated_at"] > current["updated_at"]:
            valid[order_id] = clean
    return list(valid.values()), rejects


def load(conn, clean):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS fact_orders (
            order_id INTEGER PRIMARY KEY, customer_email TEXT, amount REAL, currency TEXT,
            order_date TEXT, country TEXT, updated_at TEXT)
    """)
    updates = ", ".join(f"{c} = excluded.{c}" for c in COLUMNS[1:])
    with conn:
        conn.executemany(
            f"INSERT INTO fact_orders ({', '.join(COLUMNS)}) VALUES ({', '.join('?' * len(COLUMNS))}) "
            f"ON CONFLICT (order_id) DO UPDATE SET {updates}",
            [[r[c] for c in COLUMNS] for r in clean],
        )
    return len(clean)


def run_pipeline(conn, csv_text):
    rows = extract(csv_text)
    clean, rejects = transform(rows)
    loaded = load(conn, clean)
    return {"extracted": len(rows), "loaded": loaded, "rejected": len(rejects)}
