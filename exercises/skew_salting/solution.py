"""Data skew in distributed jobs: detect hot partitions, salt keys, balance ranges and prune Hive-style partitions."""
import statistics
import zlib
from bisect import bisect_right

HIVE_DEFAULT_PARTITION = "__HIVE_DEFAULT_PARTITION__"


def partition_for(key, num_partitions: int) -> int:
    """Stable hash partitioner (given; don't change)."""
    return zlib.crc32(str(key).encode("utf-8")) % num_partitions


# ---- Detecting skew -----------------------------------------------------------

def skew_ratio(partition_sizes: list[int]) -> float:
    """max / median of the partition sizes. 1.0 for perfectly even (or all-empty) partitions."""
    if not partition_sizes:
        raise ValueError("no partitions")
    biggest, median = max(partition_sizes), statistics.median(partition_sizes)
    if biggest == 0:
        return 1.0
    if median == 0:
        return float("inf")
    return biggest / median


def detect_skew(partition_sizes: list[int], factor: float = 5.0, min_size: int = 0) -> list[int]:
    """Indices of partitions bigger than factor * median AND bigger than min_size (Spark AQE's rule)."""
    if not partition_sizes:
        return []
    median = statistics.median(partition_sizes)
    return [i for i, s in enumerate(partition_sizes) if s > factor * median and s > min_size]


# ---- Salted aggregation -----------------------------------------------------------

def two_phase_sum(partitions, key_col, value_col, num_salts, num_partitions):
    """SUM(value_col) GROUP BY key_col with salted keys: partial sums per (key, salt), then a final sum per key."""
    if num_salts < 1:
        raise ValueError("num_salts must be >= 1")
    # Phase 1: the i-th row overall gets salt i % num_salts, so a hot key is spread over num_salts partitions.
    phase1 = [[] for _ in range(num_partitions)]
    i = 0
    for part in partitions:
        for row in part:
            salted = (row[key_col], i % num_salts)
            phase1[partition_for(salted, num_partitions)].append((salted, row[value_col]))
            i += 1
    partials = []
    for bucket in phase1:
        acc = {}
        for salted, v in bucket:
            acc[salted] = acc.get(salted, 0) + v
        partials.extend(acc.items())
    # Phase 2: drop the salt and shuffle the (few) partial sums by the real key.
    phase2 = [[] for _ in range(num_partitions)]
    for (key, _salt), s in partials:
        phase2[partition_for(key, num_partitions)].append((key, s))
    final = {}
    for bucket in phase2:
        for key, s in bucket:
            final[key] = final.get(key, 0) + s
    stats = {"phase1_sizes": [len(b) for b in phase1], "phase2_sizes": [len(b) for b in phase2]}
    return final, stats


# ---- Salted join -----------------------------------------------------------------

def salted_join(left, right, on, hot_keys, num_salts, num_partitions):
    """Inner join where hot keys are salted on the big left side and replicated num_salts times on the right."""
    hot = set(hot_keys)
    lparts = [[] for _ in range(num_partitions)]
    rparts = [[] for _ in range(num_partitions)]
    counters = {}
    for part in left:
        for row in part:
            key = row[on]
            if key in hot:
                salt = counters.get(key, 0)
                counters[key] = salt + 1
                salt %= num_salts
            else:
                salt = 0
            lparts[partition_for((key, salt), num_partitions)].append(((key, salt), row))
    replicated = 0
    for part in right:
        for row in part:
            key = row[on]
            salts = range(num_salts) if key in hot else range(1)
            for salt in salts:
                rparts[partition_for((key, salt), num_partitions)].append(((key, salt), row))
            replicated += len(salts) - 1
    out = []
    for lp, rp in zip(lparts, rparts):
        table = {}
        for salted, row in rp:
            if salted[0] is not None:
                table.setdefault(salted, []).append(row)
        for salted, lrow in lp:
            for rrow in table.get(salted, []):
                out.append((lrow, rrow))
    stats = {
        "left_sizes": [len(p) for p in lparts],
        "right_sizes": [len(p) for p in rparts],
        "replicated_rows": replicated,
    }
    return out, stats


# ---- Range partitioning ------------------------------------------------------------

def range_boundaries(sample: list, num_partitions: int) -> list:
    """Split points at the sample's 1/n, 2/n, ... quantiles (sorted, duplicates removed)."""
    if num_partitions < 1:
        raise ValueError("num_partitions must be >= 1")
    s = sorted(sample)
    if not s:
        return []
    bounds = []
    for i in range(1, num_partitions):
        b = s[i * len(s) // num_partitions]
        if not bounds or b > bounds[-1]:
            bounds.append(b)
    return bounds


def range_partition(value, bounds: list) -> int:
    """Partition i holds bounds[i-1] <= value < bounds[i]."""
    return bisect_right(bounds, value)


# ---- Hive-style partition paths --------------------------------------------------------

def partition_path(row: dict, partition_cols: list[str]) -> str:
    """'col1=v1/col2=v2' in partition_cols order. None becomes __HIVE_DEFAULT_PARTITION__."""
    parts = []
    for col in partition_cols:
        v = row.get(col)
        parts.append(f"{col}={HIVE_DEFAULT_PARTITION if v is None else v}")
    return "/".join(parts)


def parse_partition_path(path: str) -> dict:
    """Inverse of partition_path: {col: value_string_or_None}. Segments without '=' are ignored."""
    out = {}
    for segment in path.split("/"):
        if "=" not in segment:
            continue
        col, value = segment.split("=", 1)
        out[col] = None if value == HIVE_DEFAULT_PARTITION else value
    return out


def prune_paths(paths: list[str], predicates: dict) -> list[str]:
    """Keep paths whose partition values satisfy every predicate on a column the path has."""
    kept = []
    for path in paths:
        values = parse_partition_path(path)
        if all(pred(values[col]) for col, pred in predicates.items() if col in values):
            kept.append(path)
    return kept
