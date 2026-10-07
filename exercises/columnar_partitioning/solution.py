"""Columnar layout, encodings, partitioning with pruning, and document queries in pure Python."""
import zlib
from bisect import bisect_right


def to_columnar(rows: list[dict]) -> dict[str, list]:
    columns: list[str] = []
    for row in rows:
        for k in row:
            if k not in columns:
                columns.append(k)
    return {c: [row.get(c) for row in rows] for c in columns}


def rle_encode(values: list) -> list[tuple]:
    runs: list[tuple] = []
    for v in values:
        if runs and runs[-1][0] == v:
            runs[-1] = (v, runs[-1][1] + 1)
        else:
            runs.append((v, 1))
    return runs


def rle_decode(runs: list[tuple]) -> list:
    out: list = []
    for v, n in runs:
        out.extend([v] * n)
    return out


def dict_encode(values: list) -> tuple[list, list[int]]:
    index: dict = {}
    dictionary: list = []
    codes: list[int] = []
    for v in values:
        if v not in index:
            index[v] = len(dictionary)
            dictionary.append(v)
        codes.append(index[v])
    return dictionary, codes


def dict_decode(dictionary: list, codes: list[int]) -> list:
    return [dictionary[c] for c in codes]


def hash_partition(key, num_partitions: int) -> int:
    if num_partitions < 1:
        raise ValueError("num_partitions must be >= 1")
    return zlib.crc32(str(key).encode("utf-8")) % num_partitions


def partition_rows(rows: list[dict], key: str, num_partitions: int) -> list[list[dict]]:
    parts: list[list[dict]] = [[] for _ in range(num_partitions)]
    for row in rows:
        parts[hash_partition(row[key], num_partitions)].append(row)
    return parts


def range_partition(value, bounds: list) -> int:
    return bisect_right(bounds, value)


def prune_partitions(bounds: list, lo=None, hi=None) -> list[int]:
    first = 0 if lo is None else range_partition(lo, bounds)
    last = len(bounds) if hi is None else range_partition(hi, bounds)
    return list(range(first, last + 1))


_OPS = {
    "$eq": lambda a, b: a == b,
    "$gt": lambda a, b: a > b,
    "$gte": lambda a, b: a >= b,
    "$lt": lambda a, b: a < b,
    "$lte": lambda a, b: a <= b,
    "$in": lambda a, b: a in b,
}
_MISSING = object()


def _get_path(doc, path: str):
    cur = doc
    for part in path.split("."):
        if not isinstance(cur, dict) or part not in cur:
            return _MISSING
        cur = cur[part]
    return cur


def _matches(value, cond) -> bool:
    if value is _MISSING:
        return False
    if isinstance(cond, dict) and cond and all(k.startswith("$") for k in cond):
        for op, arg in cond.items():
            if op not in _OPS:
                raise ValueError(f"unknown operator {op}")
            try:
                if not _OPS[op](value, arg):
                    return False
            except TypeError:
                return False
        return True
    return value == cond


def find(docs: list[dict], filt: dict) -> list[dict]:
    return [d for d in docs if all(_matches(_get_path(d, p), c) for p, c in filt.items())]


def aggregate_sum(table, group_by: str, value_col: str, where: dict | None = None) -> dict:
    where = where or {}
    keys = table[group_by]
    vals = table[value_col]
    filters = [(table[c], v) for c, v in where.items()]
    out: dict = {}
    for i, k in enumerate(keys):
        if all(col[i] == v for col, v in filters):
            out[k] = out.get(k, 0) + vals[i]
    return out
