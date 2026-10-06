"""Reference solution — never shipped to learners."""
from bisect import bisect_right
from collections import defaultdict


def point_in_time_join(labels, features, ttl=None):
    by_entity = defaultdict(list)
    for pos, row in enumerate(features):
        by_entity[row["entity_id"]].append((row["feature_ts"], pos, row))
    index = {}
    for entity, rows in by_entity.items():
        rows.sort(key=lambda t: (t[0], t[1]))  # ties: later input position sorts last, so it wins
        index[entity] = ([t[0] for t in rows], [t[2] for t in rows])

    out = []
    for label in labels:
        match = None
        if label["entity_id"] in index:
            stamps, rows = index[label["entity_id"]]
            i = bisect_right(stamps, label["event_ts"]) - 1
            if i >= 0 and (ttl is None or label["event_ts"] - stamps[i] <= ttl):
                match = rows[i]
        out.append({
            **label,
            "feature_ts": match["feature_ts"] if match else None,
            "features": {k: v for k, v in match.items() if k not in ("entity_id", "feature_ts")} if match else None,
        })
    return out


def detect_leakage(rows):
    return [i for i, r in enumerate(rows) if r.get("feature_ts") is not None and r["feature_ts"] > r["event_ts"]]
