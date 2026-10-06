"""Point-in-time correct joins, the core of every feature store's training-data retrieval."""
from bisect import bisect_right
from collections import defaultdict


def point_in_time_join(labels: list[dict], features: list[dict], ttl: int | None = None) -> list[dict]:
    """Attach to each label the newest feature row with feature_ts <= event_ts (same entity)."""
    raise NotImplementedError


def detect_leakage(rows: list[dict]) -> list[int]:
    """Indices of rows whose feature_ts is after their event_ts."""
    raise NotImplementedError
