"""Distributed join strategies over partitioned rows: broadcast hash, shuffle hash and sort-merge, plus a planner."""
import zlib


def partition_for(key, num_partitions: int) -> int:
    """Stable hash partitioner (given; don't change)."""
    return zlib.crc32(str(key).encode("utf-8")) % num_partitions


def count_rows(table: list[list[dict]]) -> int:
    """Total rows across all partitions (given; don't change)."""
    return sum(len(p) for p in table)


def broadcast_hash_join(left, right, on, how="inner"):
    """Ship every row of `right` to every partition of `left`, then hash-join locally."""
    raise NotImplementedError


def shuffle_hash_join(left, right, on, how="inner", num_partitions=4):
    """Hash-partition both sides by the join key, then hash-join each partition pair."""
    raise NotImplementedError


def sort_merge_join(left, right, on, how="inner", num_partitions=4):
    """Hash-partition both sides, sort each partition by key, and merge equal-key runs."""
    raise NotImplementedError


def choose_strategy(left, right, how="inner", broadcast_threshold=1000):
    """Pick {'strategy': 'broadcast', 'build_side': 'left'|'right'} or {'strategy': 'sort_merge'}."""
    raise NotImplementedError


def execute_join(left, right, on, how="inner", broadcast_threshold=1000, num_partitions=4):
    """Plan with choose_strategy and run it. Output pairs are always (left_row, right_row_or_None)."""
    raise NotImplementedError
