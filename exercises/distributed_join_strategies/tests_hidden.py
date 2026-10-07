"""Hidden validation suite for distributed_join_strategies."""
import copy
import random

import pytest

import submission as sub


def _partitioned(rows, n):
    return [rows[i::n] for i in range(n)]


def _orders(seed, n=120, keys=12, nulls=5):
    rng = random.Random(seed)
    rows = [{"oid": i, "cust": rng.randint(0, keys - 1), "amount": rng.randint(1, 99)} for i in range(n)]
    for i in rng.sample(range(n), nulls):
        rows[i]["cust"] = None
    return rows


def _customers(seed, keys=12):
    rng = random.Random(seed)
    rows = []
    rid = 0
    for k in range(keys):
        for _ in range(rng.choice([0, 1, 1, 1, 2])):  # missing keys and duplicate keys
            rows.append({"cid": rid, "cust": k, "tier": rng.choice("ABC")})
            rid += 1
    rows.append({"cid": rid, "cust": None, "tier": "Z"})
    return rows


def _reference(left_rows, right_rows, on, how):
    out = []
    for lrow in left_rows:
        matched = False
        for rrow in right_rows:
            if lrow[on] is not None and rrow[on] is not None and lrow[on] == rrow[on]:
                out.append((lrow, rrow))
                matched = True
        if how == "left" and not matched:
            out.append((lrow, None))
    return out


def _canon(pairs, lid="oid", rid="cid"):
    return sorted((lrow[lid], -1 if rrow is None else rrow[rid]) for lrow, rrow in pairs)


def _flat(table):
    return [r for p in table for r in p]


ORDERS = _partitioned(_orders(1), 4)
CUSTOMERS = _partitioned(_customers(2), 3)
STRATEGIES = [
    ("broadcast", lambda l, r, how: sub.broadcast_hash_join(l, r, "cust", how)),
    ("shuffle_hash", lambda l, r, how: sub.shuffle_hash_join(l, r, "cust", how, num_partitions=5)),
    ("sort_merge", lambda l, r, how: sub.sort_merge_join(l, r, "cust", how, num_partitions=5)),
]


def test_broadcast_inner_join_matches_reference():
    rows, stats = sub.broadcast_hash_join(ORDERS, CUSTOMERS, "cust")
    assert _canon(rows) == _canon(_reference(_flat(ORDERS), _flat(CUSTOMERS), "cust", "inner"))
    assert stats["strategy"] == "broadcast"
    for lrow, rrow in rows:
        assert lrow["cust"] == rrow["cust"] and "oid" in lrow and "cid" in rrow, "pairs are (left_row, right_row)"


def test_shuffle_hash_inner_join_matches_reference():
    for n in (1, 3, 8):
        rows, stats = sub.shuffle_hash_join(ORDERS, CUSTOMERS, "cust", num_partitions=n)
        assert _canon(rows) == _canon(_reference(_flat(ORDERS), _flat(CUSTOMERS), "cust", "inner")), f"n={n}"
        assert stats["strategy"] == "shuffle_hash"


def test_sort_merge_handles_duplicate_keys():
    left = _partitioned([{"oid": i, "cust": k} for i, k in enumerate([3, 1, 3, 2, 3, 5, 1, 9])], 3)
    right = _partitioned([{"cid": i, "cust": k} for i, k in enumerate([3, 3, 1, 4, 9, 9, 9])], 2)
    rows, stats = sub.sort_merge_join(left, right, "cust", num_partitions=3)
    expected = _reference(_flat(left), _flat(right), "cust", "inner")
    assert len(rows) == len(expected) == 6 + 2 + 3, "every equal-key pair: 3x2 for key 3, 2x1 for key 1, 1x3 for key 9"
    assert _canon(rows) == _canon(expected)
    big, _ = sub.sort_merge_join(ORDERS, CUSTOMERS, "cust", num_partitions=4)
    assert _canon(big) == _canon(_reference(_flat(ORDERS), _flat(CUSTOMERS), "cust", "inner"))
    assert stats["strategy"] == "sort_merge"


def test_null_keys_never_match():
    left = _partitioned([{"oid": 0, "cust": None}, {"oid": 1, "cust": 7}, {"oid": 2, "cust": None}], 2)
    right = _partitioned([{"cid": 0, "cust": None}, {"cid": 1, "cust": 7}], 2)
    for name, join in STRATEGIES:
        rows, _ = join(left, right, "inner")
        assert _canon(rows) == [(1, 1)], f"{name}: in SQL, NULL = NULL is not true, so NULL keys never join"
        rows, _ = join(left, right, "left")
        assert _canon(rows) == [(0, -1), (1, 1), (2, -1)], f"{name}: NULL-key left rows survive a left join unmatched"


def test_left_join_keeps_unmatched_rows():
    expected = _canon(_reference(_flat(ORDERS), _flat(CUSTOMERS), "cust", "left"))
    for name, join in STRATEGIES:
        rows, _ = join(ORDERS, CUSTOMERS, "left")
        assert _canon(rows) == expected, f"{name}: every left row appears at least once"
        unmatched = [lrow for lrow, rrow in rows if rrow is None]
        assert unmatched, "the fixture has left rows without a match"
    for name, join in STRATEGIES:
        rows, _ = join(ORDERS, [[]], "left")
        assert _canon(rows) == sorted((r["oid"], -1) for r in _flat(ORDERS)), f"{name}: left join with an empty right side"
    with pytest.raises(ValueError):
        sub.shuffle_hash_join(ORDERS, CUSTOMERS, "cust", how="full")


def test_network_cost_counters():
    n_left, n_right = sub.count_rows(ORDERS), sub.count_rows(CUSTOMERS)
    _, stats = sub.broadcast_hash_join(ORDERS, CUSTOMERS, "cust")
    assert stats["network_rows"] == n_right * len(ORDERS), "broadcast ships the whole build side to every partition"
    _, stats = sub.shuffle_hash_join(ORDERS, CUSTOMERS, "cust", num_partitions=6)
    assert stats["network_rows"] == n_left + n_right, "a shuffle moves every row of both sides"
    _, stats = sub.sort_merge_join(ORDERS, CUSTOMERS, "cust", num_partitions=6)
    assert stats["network_rows"] == n_left + n_right


def test_planner_broadcasts_the_small_side():
    big = _partitioned(_orders(3, n=200), 4)
    small = _partitioned(_customers(4), 2)
    assert sub.choose_strategy(big, small, "inner", broadcast_threshold=100) == {"strategy": "broadcast", "build_side": "right"}
    assert sub.choose_strategy(small, big, "inner", broadcast_threshold=100) == {"strategy": "broadcast", "build_side": "left"}
    assert sub.choose_strategy(big, small, "inner", broadcast_threshold=10_000) == {"strategy": "broadcast", "build_side": "right"}, \
        "when both sides fit, broadcast the smaller one"
    assert sub.choose_strategy(small, big, "inner", broadcast_threshold=10_000)["build_side"] == "left"
    assert sub.choose_strategy(big, small, "inner", broadcast_threshold=5) == {"strategy": "sort_merge"}
    assert sub.choose_strategy(small, big, "left", broadcast_threshold=100) == {"strategy": "sort_merge"}, \
        "a left join can't broadcast its left (preserved) side"
    assert sub.choose_strategy(big, small, "left", broadcast_threshold=100) == {"strategy": "broadcast", "build_side": "right"}
    n_small = sub.count_rows(small)
    assert sub.choose_strategy(big, small, "inner", broadcast_threshold=n_small)["strategy"] == "broadcast", "threshold is inclusive"


def test_execute_join_follows_plan_and_keeps_orientation():
    big = _partitioned(_orders(5, n=150), 5)
    small = _partitioned(_customers(6), 2)
    expected = _canon(_reference(_flat(small), _flat(big), "cust", "inner"), lid="cid", rid="oid")
    rows, stats = sub.execute_join(small, big, "cust", "inner", broadcast_threshold=100, num_partitions=4)
    assert stats["strategy"] == "broadcast"
    assert stats["network_rows"] == sub.count_rows(small) * len(big), "the small left side is broadcast to the big side"
    assert _canon(rows, lid="cid", rid="oid") == expected, "pairs stay (left_row, right_row) even when the left side is built"
    rows, stats = sub.execute_join(big, small, "cust", "left", broadcast_threshold=3, num_partitions=4)
    assert stats["strategy"] == "sort_merge"
    assert _canon(rows) == _canon(_reference(_flat(big), _flat(small), "cust", "left"))


def test_inputs_not_mutated():
    left, right = copy.deepcopy(ORDERS), copy.deepcopy(CUSTOMERS)
    for _, join in STRATEGIES:
        for how in ("inner", "left"):
            join(left, right, how)
    sub.execute_join(left, right, "cust", "left", broadcast_threshold=1)
    assert left == ORDERS and right == CUSTOMERS
