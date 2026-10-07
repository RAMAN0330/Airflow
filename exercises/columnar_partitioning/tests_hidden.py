"""Hidden validation suite for columnar_partitioning."""
import copy
import os
import random
import subprocess
import sys
import zlib
from collections.abc import Mapping

import pytest

import submission as sub

ROWS = [
    {"order_id": 1, "country": "DE", "amount": 30.0, "status": "completed"},
    {"order_id": 2, "country": "DE", "amount": 12.5, "status": "completed"},
    {"order_id": 3, "country": "US", "amount": 99.0},
    {"order_id": 4, "country": "GB", "amount": 7.25, "status": "cancelled", "coupon": "SPRING"},
    {"order_id": 5, "country": "US", "amount": 1.0, "status": "completed"},
]

DOCS = [
    {"_id": 1, "name": "Ana", "address": {"city": "Berlin", "geo": {"country": "DE"}}, "age": 34, "tags": ["vip"]},
    {"_id": 2, "name": "Ben", "address": {"city": "Lagos", "geo": {"country": "NG"}}, "age": 27},
    {"_id": 3, "name": "Chen", "address": {"city": "Berlin", "geo": {"country": "DE"}}, "age": 19},
    {"_id": 4, "name": "Dara", "address": "unknown", "age": 41},
    {"_id": 5, "name": "Eli", "age": "n/a"},
]


class TrackingTable(Mapping):
    """A columnar table that records which columns were read."""

    def __init__(self, cols):
        self._cols, self.touched = cols, set()

    def __getitem__(self, k):
        self.touched.add(k)
        return self._cols[k]

    def __iter__(self):
        return iter(self._cols)

    def __len__(self):
        return len(self._cols)


def test_to_columnar_shapes_and_missing():
    rows = copy.deepcopy(ROWS)
    cols = sub.to_columnar(rows)
    assert list(cols) == ["order_id", "country", "amount", "status", "coupon"], "columns in first-seen order"
    assert all(len(v) == len(ROWS) for v in cols.values()), "every column has one entry per row"
    assert cols["amount"] == [30.0, 12.5, 99.0, 7.25, 1.0]
    assert cols["status"][2] is None and cols["coupon"] == [None, None, None, "SPRING", None]
    assert rows == ROWS, "to_columnar must not modify its input"
    assert sub.to_columnar([]) == {}


def test_rle_roundtrip_and_runs():
    assert sub.rle_encode(["DE", "DE", "DE", "US", "GB", "GB"]) == [("DE", 3), ("US", 1), ("GB", 2)]
    assert sub.rle_encode([]) == [] and sub.rle_decode([]) == []
    assert sub.rle_encode([None, None, 0, 0, 0]) == [(None, 2), (0, 3)]
    assert sub.rle_encode(["x"]) == [("x", 1)]
    rng = random.Random(0)
    for _ in range(50):
        vals = [rng.choice("aab") for _ in range(rng.randint(0, 40))]
        runs = sub.rle_encode(vals)
        assert sub.rle_decode(runs) == vals
        assert sum(n for _, n in runs) == len(vals) and all(n >= 1 for _, n in runs)
        assert all(a[0] != b[0] for a, b in zip(runs, runs[1:])), "adjacent runs must have different values"


def test_dictionary_encoding_roundtrip():
    dictionary, codes = sub.dict_encode(["US", "DE", "US", "GB", "DE", "US"])
    assert dictionary == ["US", "DE", "GB"], "dictionary in first-seen order"
    assert codes == [0, 1, 0, 2, 1, 0]
    assert sub.dict_decode(dictionary, codes) == ["US", "DE", "US", "GB", "DE", "US"]
    rng = random.Random(1)
    vals = [rng.choice(["completed", "cancelled", "pending", None]) for _ in range(500)]
    d, c = sub.dict_encode(vals)
    assert len(d) == len(set(vals)) and sub.dict_decode(d, c) == vals
    assert sub.dict_encode([]) == ([], [])


def test_hash_partition_matches_crc32():
    keys = ["alice", "bob", "carol", "user-42", "DE", 17, 3.5, ""]
    for n in (1, 3, 8, 16):
        for k in keys:
            got = sub.hash_partition(k, n)
            assert got == zlib.crc32(str(k).encode("utf-8")) % n, f"hash_partition({k!r}, {n})"
            assert 0 <= got < n
    with pytest.raises(ValueError):
        sub.hash_partition("x", 0)


def test_hash_partition_stable_across_processes():
    code = "import submission as s; print([s.hash_partition(k, 7) for k in ['alice', 'bob', 'carol', 'dave', 'eve']])"
    outs = set()
    for seed in ("1", "2", "3"):
        env = {**os.environ, "PYTHONHASHSEED": seed}
        p = subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True, timeout=10)
        assert p.returncode == 0, p.stderr[-500:]
        outs.add(p.stdout.strip())
    assert len(outs) == 1, "partition ids changed between runs: built-in hash() of str is salted per process"


def test_partition_rows_preserves_all_rows():
    rng = random.Random(2)
    rows = [{"user": f"u{rng.randint(0, 30)}", "v": i} for i in range(200)]
    parts = sub.partition_rows(rows, "user", 4)
    assert len(parts) == 4
    assert sorted(r["v"] for p in parts for r in p) == list(range(200)), "every row lands in exactly one partition"
    for i, p in enumerate(parts):
        assert all(sub.hash_partition(r["user"], 4) == i for r in p)
        assert [r["v"] for r in p] == sorted(r["v"] for r in p), "keep input order inside a partition"
    owners = {}
    for i, p in enumerate(parts):
        for r in p:
            assert owners.setdefault(r["user"], i) == i, "all rows with one key go to one partition"


def test_range_partition_boundaries():
    bounds = ["2025-04-01", "2025-07-01", "2025-10-01"]
    assert sub.range_partition("2025-01-15", bounds) == 0
    assert sub.range_partition("2025-03-31", bounds) == 0
    assert sub.range_partition("2025-04-01", bounds) == 1, "lower bound is inclusive"
    assert sub.range_partition("2025-06-30", bounds) == 1
    assert sub.range_partition("2025-10-01", bounds) == 3
    assert sub.range_partition("2026-02-01", bounds) == 3
    assert sub.range_partition(5, []) == 0


def test_prune_includes_boundary_partitions():
    bounds = [10, 20, 30, 40]
    assert sub.prune_partitions(bounds, 12, 18) == [1]
    assert sub.prune_partitions(bounds, 15, 20) == [1, 2], "hi == 20 lives in partition 2, which can't be pruned"
    assert sub.prune_partitions(bounds, 10, 10) == [1]
    assert sub.prune_partitions(bounds, None, 9) == [0]
    assert sub.prune_partitions(bounds, 35, None) == [3, 4]
    assert sub.prune_partitions(bounds) == [0, 1, 2, 3, 4]
    rng = random.Random(3)
    for _ in range(300):
        lo, hi = sorted(rng.randint(0, 50) for _ in range(2))
        brute = sorted({sub_range for v in range(lo, hi + 1) for sub_range in [sum(v >= b for b in bounds)]})
        got = sub.prune_partitions(bounds, lo, hi)
        assert set(brute) <= set(got), f"[{lo}, {hi}] pruned a partition holding matching values"
        assert got == brute, f"[{lo}, {hi}]: scanned {got}, only {brute} can match"


def test_find_nested_paths_and_operators():
    docs = copy.deepcopy(DOCS)
    ids = lambda f: [d["_id"] for d in sub.find(docs, f)]
    assert ids({"address.city": "Berlin"}) == [1, 3]
    assert ids({"address.geo.country": "DE", "age": {"$gte": 20}}) == [1]
    assert ids({"age": {"$gt": 20, "$lt": 40}}) == [1, 2]
    assert ids({"address.geo.country": {"$in": ["NG", "FR"]}}) == [2]
    assert ids({"address.city": {"$eq": "Berlin"}, "name": "Chen"}) == [3]
    assert ids({"address.zip": "10115"}) == [], "a missing path never matches"
    assert ids({"address.city": "unknown"}) == [], "can't descend into a non-document value"
    assert ids({"age": {"$lt": 30}}) == [2, 3], "comparisons with incompatible types just don't match"
    assert ids({}) == [1, 2, 3, 4, 5]
    assert ids({"address": {"city": "Lagos", "geo": {"country": "NG"}}}) == [2], "a plain dict is an equality match"
    assert docs == DOCS, "find must not modify the documents"


def test_aggregate_touches_only_needed_columns():
    cols = sub.to_columnar(ROWS)
    t = TrackingTable(cols)
    assert sub.aggregate_sum(t, "country", "amount") == {"DE": 42.5, "US": 100.0, "GB": 7.25}
    assert t.touched == {"country", "amount"}, f"read columns {sorted(t.touched)}; a column store reads only what it needs"
    t2 = TrackingTable(cols)
    assert sub.aggregate_sum(t2, "country", "amount", where={"status": "completed"}) == {"DE": 42.5, "US": 1.0}
    assert t2.touched == {"country", "amount", "status"}
    wide = {f"c{i}": [i] * 1000 for i in range(50)}
    wide["k"] = [j % 3 for j in range(1000)]
    t3 = TrackingTable(wide)
    assert sub.aggregate_sum(t3, "k", "c7") == {0: 7 * 334, 1: 7 * 333, 2: 7 * 333}
    assert t3.touched == {"k", "c7"}
