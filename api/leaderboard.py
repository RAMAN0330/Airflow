"""XP standings computed from XP events (first pass of an exercise, lesson completion).

Computed in Python over all events. At larger scale, maintain an xp_ledger
table or a Redis sorted set instead.
"""
from datetime import datetime, timedelta, timezone

from .catalog import Catalog


def standings(catalog: Catalog, events: list[dict], period: str = "all") -> list[dict]:
    cutoff = None
    if period == "week":
        cutoff = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat(timespec="milliseconds")

    by_user: dict[str, dict] = {}
    for e in events:
        if cutoff and e["at"] < cutoff:
            continue
        if e["kind"] == "exercise" and e["ref"] in catalog.exercises:
            xp = catalog.exercises[e["ref"]].xp
        elif e["kind"] == "lesson" and e["ref"] in catalog.lessons:
            xp = catalog.lessons[e["ref"]].xp
        else:
            continue  # content that has since been removed
        row = by_user.setdefault(e["user_id"], {"user_id": e["user_id"], "xp": 0, "exercises": 0, "lessons": 0, "last_at": ""})
        row["xp"] += xp
        row["exercises" if e["kind"] == "exercise" else "lessons"] += 1
        row["last_at"] = max(row["last_at"], e["at"])

    # Highest XP first; on a tie, whoever got there first ranks higher.
    rows = sorted(by_user.values(), key=lambda r: (-r["xp"], r["last_at"]))
    for i, r in enumerate(rows, start=1):
        r["rank"] = i
    return rows
