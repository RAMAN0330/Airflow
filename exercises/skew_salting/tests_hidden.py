"""Hidden validation suite for skew_salting."""
import copy
import math
import random
from collections import Counter, defaultdict

import pytest

import submission as sub


def _partitioned(rows, n):
    return [rows[i::n] for i in range(n)]


def _skewed_sales(seed, n=2000):
    """One hot customer owns ~60% of the rows: the classic 'one key is a celebrity' shape."""
    rng = random.Random(seed)
    rows = []
    for i in range(n):
        cust = "whale" if rng.random() < 0.6 else f"c{rng.randint(0, 99)}"
        rows.append({"sid": i, "cust": cust, "amount": rng.randint(1, 500)})
    return rows


def test_skew_ratio_known_values():
    assert sub.skew_ratio([10, 10, 10, 10]) == 1.0
    assert sub.skew_ratio([1, 2, 3, 100]) == pytest.approx(100 / 2.5)
    assert sub.skew_ratio([5, 1, 9]) == pytest.approx(9 / 5)
    assert sub.skew_ratio([0, 0, 0]) == 1.0
    assert math.isinf(sub.skew_ratio([0, 0, 0, 7]))
    with pytest.raises(ValueError):
        sub.skew_ratio([])


def test_detect_skew_needs_factor_and_min_size():
    sizes = [100, 110, 90, 105, 2000, 95, 600]
    assert sub.detect_skew(sizes) == [4, 6], "both partitions are more than 5x the median (100)"
    assert sub.detect_skew(sizes, factor=10) == [4]
    assert sub.detect_skew(sizes, factor=5, min_size=1000) == [4], "a partition must also exceed min_size"
    assert sub.detect_skew([100, 100, 500]) == [], "exactly 5x the median is not skewed"
    assert sub.detect_skew([]) == []


def _true_sums(rows):
    out = defaultdict(int)
    for r in rows:
        out[r["cust"]] += r["amount"]
    return dict(out)


def test_two_phase_sum_is_exact():
    rows = _skewed_sales(1)
    parts = _partitioned(rows, 6)
    for salts in (1, 4, 8, 16):
        result, _ = sub.two_phase_sum(parts, "cust", "amount", num_salts=salts, num_partitions=5)
        assert result == _true_sums(rows), f"num_salts={salts}: salting must never change the totals"
    with pytest.raises(ValueError):
        sub.two_phase_sum(parts, "cust", "amount", num_salts=0, num_partitions=5)


def test_salting_spreads_the_hot_key():
    rows = _skewed_sales(2)
    parts = _partitioned(rows, 4)
    _, plain = sub.two_phase_sum(parts, "cust", "amount", num_salts=1, num_partitions=8)
    _, salted = sub.two_phase_sum(parts, "cust", "amount", num_salts=8, num_partitions=8)
    assert sum(plain["phase1_sizes"]) == sum(salted["phase1_sizes"]) == len(rows), "phase 1 shuffles every row once"
    n_whale = sum(r["cust"] == "whale" for r in rows)
    assert max(plain["phase1_sizes"]) >= n_whale, "unsalted, one partition receives every whale row"
    assert max(salted["phase1_sizes"]) < 0.6 * max(plain["phase1_sizes"])
    expected = Counter(sub.partition_for((r["cust"], i % 8), 8) for i, r in enumerate(_flat(parts)))
    assert salted["phase1_sizes"] == [expected[p] for p in range(8)], "row i (in partition order) gets salt i % num_salts"


def _flat(parts):
    return [r for p in parts for r in p]


def test_phase_two_receives_at_most_num_salts_partials_per_key():
    rows = _skewed_sales(3, n=1500)
    parts = _partitioned(rows, 3)
    n_keys = len({r["cust"] for r in rows})
    _, stats = sub.two_phase_sum(parts, "cust", "amount", num_salts=6, num_partitions=4)
    distinct_salted = len({(r["cust"], i % 6) for i, r in enumerate(_flat(parts))})
    assert sum(stats["phase2_sizes"]) == distinct_salted, "phase 2 moves one partial sum per (key, salt)"
    assert n_keys <= sum(stats["phase2_sizes"]) <= 6 * n_keys
    assert sum(stats["phase2_sizes"]) < len(rows) / 3, "the second shuffle is tiny compared with the first"


def _reference_join(left, right, on):
    return sorted((l["sid"], r["pid"]) for l in left for r in right
                  if l[on] is not None and l[on] == r[on])


def test_salted_join_matches_plain_join():
    rows = _skewed_sales(4, n=600)
    rows[5]["cust"] = None
    profiles = [{"pid": i, "cust": c} for i, c in enumerate(["whale", "c1", "c2", "c3", "c50", "whale", None, "nobody"])]
    left, right = _partitioned(rows, 4), _partitioned(profiles, 2)
    expected = _reference_join(rows, profiles, "cust")
    for salts in (1, 3, 8):
        out, _ = sub.salted_join(left, right, "cust", hot_keys=["whale"], num_salts=salts, num_partitions=6)
        assert sorted((l["sid"], r["pid"]) for l, r in out) == expected, (
            f"num_salts={salts}: every salt of a hot key needs its own copy of the matching right rows")


def test_salted_join_replicates_small_side_and_balances():
    rows = _skewed_sales(5, n=1200)
    profiles = [{"pid": i, "cust": c} for i, c in enumerate(["whale"] + [f"c{k}" for k in range(100)])]
    left, right = _partitioned(rows, 4), _partitioned(profiles, 2)
    _, plain = sub.salted_join(left, right, "cust", hot_keys=[], num_salts=8, num_partitions=8)
    _, salted = sub.salted_join(left, right, "cust", hot_keys=["whale"], num_salts=8, num_partitions=8)
    assert plain["replicated_rows"] == 0
    assert salted["replicated_rows"] == 7, "one whale profile becomes 8 copies: 7 extra rows"
    assert sum(salted["right_sizes"]) == len(profiles) + 7
    assert sum(salted["left_sizes"]) == len(rows), "the big side is never replicated"
    assert max(salted["left_sizes"]) < 0.6 * max(plain["left_sizes"])


def test_range_boundaries_balance_skewed_data():
    assert sub.range_boundaries(list(range(100)), 4) == [25, 50, 75]
    assert sub.range_boundaries([5, 1, 3], 1) == []
    assert sub.range_boundaries([], 3) == []
    assert sub.range_boundaries([7] * 50 + [1, 2, 9], 4) == [7], "duplicate split points collapse"
    assert sub.range_partition(25, [25, 50, 75]) == 1 and sub.range_partition(24, [25, 50, 75]) == 0
    assert sub.range_partition(1000, [25, 50, 75]) == 3
    rng = random.Random(6)
    data = [int(rng.lognormvariate(3, 1.5)) for _ in range(20000)]
    sample = rng.sample(data, 400)
    bounds = sub.range_boundaries(sample, 8)
    assert bounds == sorted(set(bounds))
    sizes = Counter(sub.range_partition(v, bounds) for v in data)
    even_bounds = [i * (max(data) // 8) for i in range(1, 8)]
    even = Counter(sub.range_partition(v, even_bounds) for v in data)
    assert max(sizes.values()) < 0.25 * len(data), "sampled quantiles keep every range near 1/8 of the data"
    assert max(even.values()) > 0.9 * len(data), "equal-width ranges put almost everything in one partition"


def test_hive_partition_paths_and_pruning():
    row = {"year": 2024, "month": "03", "country": None, "amount": 9.5}
    path = sub.partition_path(row, ["year", "month", "country"])
    assert path == "year=2024/month=03/country=__HIVE_DEFAULT_PARTITION__"
    assert sub.parse_partition_path("s3://bucket/sales/" + path + "/part-0000.parquet") == {
        "year": "2024", "month": "03", "country": None}
    paths = [sub.partition_path({"year": y, "month": f"{m:02d}"}, ["year", "month"])
             for y in (2023, 2024, 2025) for m in (1, 6, 12)]
    kept = sub.prune_paths(paths, {"year": lambda v: v == "2024"})
    assert kept == ["year=2024/month=01", "year=2024/month=06", "year=2024/month=12"]
    kept = sub.prune_paths(paths, {"year": lambda v: int(v) >= 2024, "month": lambda v: int(v) > 5})
    assert kept == ["year=2024/month=06", "year=2024/month=12", "year=2025/month=06", "year=2025/month=12"]
    assert sub.prune_paths(paths, {"amount": lambda v: False}) == paths, \
        "a predicate on a non-partition column can't prune any directory"
    assert sub.prune_paths(paths, {}) == paths
    nulls = ["c=DE", "c=__HIVE_DEFAULT_PARTITION__"]
    assert sub.prune_paths(nulls, {"c": lambda v: v is None}) == ["c=__HIVE_DEFAULT_PARTITION__"]


def test_inputs_not_mutated():
    rows = _skewed_sales(7, n=300)
    left = _partitioned(rows, 3)
    right = [[{"pid": 0, "cust": "whale"}], [{"pid": 1, "cust": "c3"}]]
    l0, r0 = copy.deepcopy(left), copy.deepcopy(right)
    sample = [5, 3, 9, 1]
    sub.two_phase_sum(left, "cust", "amount", 4, 3)
    sub.salted_join(left, right, "cust", ["whale"], 4, 3)
    sub.range_boundaries(sample, 2)
    assert left == l0 and right == r0 and sample == [5, 3, 9, 1]
