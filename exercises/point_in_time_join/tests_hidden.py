"""Hidden validation suite for point_in_time_join."""
import copy
import random
import time

import submission as sub

FEATURES = [
    {"entity_id": "u1", "feature_ts": 100, "avg_spend": 10.0, "n_cb": 0},
    {"entity_id": "u1", "feature_ts": 300, "avg_spend": 30.0, "n_cb": 1},
    {"entity_id": "u1", "feature_ts": 200, "avg_spend": 20.0, "n_cb": 0},
    {"entity_id": "u2", "feature_ts": 150, "avg_spend": 99.0, "n_cb": 2},
]
LABELS = [
    {"entity_id": "u1", "event_ts": 250, "label": 0},
    {"entity_id": "u1", "event_ts": 300, "label": 1},
    {"entity_id": "u2", "event_ts": 100, "label": 0},
    {"entity_id": "u3", "event_ts": 999, "label": 1},
    {"entity_id": "u1", "event_ts": 50, "label": 0},
]


def brute(labels, features, ttl=None):
    out = []
    for lab in labels:
        best = None
        for pos, f in enumerate(features):
            if f["entity_id"] == lab["entity_id"] and f["feature_ts"] <= lab["event_ts"]:
                if best is None or (f["feature_ts"], pos) >= (best[0]["feature_ts"], best[1]):
                    best = (f, pos)
        if best and ttl is not None and lab["event_ts"] - best[0]["feature_ts"] > ttl:
            best = None
        out.append(None if best is None else best[0]["feature_ts"])
    return out


def test_joins_latest_feature_at_or_before_event():
    rows = sub.point_in_time_join(LABELS, FEATURES)
    assert rows[0]["feature_ts"] == 200 and rows[0]["features"] == {"avg_spend": 20.0, "n_cb": 0}
    assert rows[1]["feature_ts"] == 300, "a feature computed at exactly event time was already known"


def test_never_uses_future_features():
    rows = sub.point_in_time_join(LABELS, FEATURES)
    assert all(r["feature_ts"] is None or r["feature_ts"] <= r["event_ts"] for r in rows)


def test_missing_entity_or_no_history_gives_none():
    rows = sub.point_in_time_join(LABELS, FEATURES)
    assert rows[2]["features"] is None and rows[2]["feature_ts"] is None, "u2's only feature row is in the future"
    assert rows[3]["features"] is None, "unknown entity"
    assert rows[4]["features"] is None, "no u1 feature before ts=50"


def test_ttl_expires_stale_features():
    rows = sub.point_in_time_join(LABELS, FEATURES, ttl=60)
    assert rows[0]["features"] == {"avg_spend": 20.0, "n_cb": 0}, "250 - 200 = 50 <= ttl"
    rows = sub.point_in_time_join([{"entity_id": "u1", "event_ts": 290, "label": 0}], FEATURES, ttl=60)
    assert rows[0]["features"] is None and rows[0]["feature_ts"] is None, "290 - 200 = 90 > ttl"


def test_ties_prefer_last_written():
    feats = [
        {"entity_id": "u1", "feature_ts": 100, "v": "first"},
        {"entity_id": "u1", "feature_ts": 100, "v": "second"},
    ]
    assert sub.point_in_time_join([{"entity_id": "u1", "event_ts": 100}], feats)[0]["features"] == {"v": "second"}


def test_output_order_and_shape():
    rows = sub.point_in_time_join(LABELS, FEATURES)
    assert [r["event_ts"] for r in rows] == [l["event_ts"] for l in LABELS]
    assert all(set(r) == {"entity_id", "event_ts", "label", "feature_ts", "features"} for r in rows)


def test_inputs_not_mutated():
    labels, feats = copy.deepcopy(LABELS), copy.deepcopy(FEATURES)
    sub.point_in_time_join(labels, feats, ttl=100)
    assert labels == LABELS and feats == FEATURES


def test_detect_leakage():
    rows = [
        {"event_ts": 10, "feature_ts": 5},
        {"event_ts": 10, "feature_ts": 11},
        {"event_ts": 10, "feature_ts": None},
        {"event_ts": 10, "feature_ts": 10},
        {"event_ts": 3, "feature_ts": 50},
    ]
    assert sub.detect_leakage(rows) == [1, 4]


def test_scales_to_large_inputs():
    rnd = random.Random(7)
    ents = [f"e{i}" for i in range(2000)]
    feats = [{"entity_id": rnd.choice(ents), "feature_ts": rnd.randint(0, 10**6), "x": i} for i in range(120_000)]
    labels = [{"entity_id": rnd.choice(ents), "event_ts": rnd.randint(0, 10**6)} for _ in range(40_000)]
    t0 = time.perf_counter()
    rows = sub.point_in_time_join(labels, feats, ttl=50_000)
    elapsed = time.perf_counter() - t0
    assert elapsed < 4.0, f"took {elapsed:.1f}s; group by entity and binary-search instead of scanning"
    sample = rnd.sample(range(len(labels)), 150)
    want = brute([labels[i] for i in sample], feats, ttl=50_000)
    assert [rows[i]["feature_ts"] for i in sample] == want
