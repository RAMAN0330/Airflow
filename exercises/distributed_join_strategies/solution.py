"""Distributed join strategies over partitioned rows: broadcast hash, shuffle hash and sort-merge, plus a planner."""
import zlib


def partition_for(key, num_partitions: int) -> int:
    """Stable hash partitioner (given; don't change)."""
    return zlib.crc32(str(key).encode("utf-8")) % num_partitions


def count_rows(table: list[list[dict]]) -> int:
    """Total rows across all partitions (given; don't change)."""
    return sum(len(p) for p in table)


def _build_table(rows, on):
    """Hash table {key: [rows...]} in input order. NULL keys are left out: in SQL, NULL never equals anything."""
    table = {}
    for row in rows:
        key = row[on]
        if key is None:
            continue
        table.setdefault(key, []).append(row)
    return table


def _probe(probe_rows, table, on, how):
    out = []
    for row in probe_rows:
        matches = table.get(row[on], [])
        for match in matches:
            out.append((row, match))
        if not matches and how == "left":
            out.append((row, None))
    return out


def _check_how(how):
    if how not in ("inner", "left"):
        raise ValueError(f"unsupported join type: {how!r}")


def broadcast_hash_join(left, right, on, how="inner"):
    """Ship every row of `right` to every partition of `left`, then hash-join locally."""
    _check_how(how)
    table = _build_table([row for part in right for row in part], on)
    out = []
    for part in left:
        out.extend(_probe(part, table, on, how))
    return out, {"strategy": "broadcast", "network_rows": count_rows(right) * len(left)}


def _shuffle(table, on, num_partitions):
    parts = [[] for _ in range(num_partitions)]
    for part in table:
        for row in part:
            parts[partition_for(row[on], num_partitions)].append(row)
    return parts


def shuffle_hash_join(left, right, on, how="inner", num_partitions=4):
    """Hash-partition both sides by the join key, then hash-join each partition pair."""
    _check_how(how)
    lparts, rparts = _shuffle(left, on, num_partitions), _shuffle(right, on, num_partitions)
    out = []
    for lp, rp in zip(lparts, rparts):
        out.extend(_probe(lp, _build_table(rp, on), on, how))
    return out, {"strategy": "shuffle_hash", "network_rows": count_rows(left) + count_rows(right)}


def _merge(lrows, rrows, on, how):
    """Merge two partitions. Non-NULL rows are sorted by key (stable); NULL-key rows never match."""
    lnull = [r for r in lrows if r[on] is None]
    ls = sorted((r for r in lrows if r[on] is not None), key=lambda r: r[on])
    rs = sorted((r for r in rrows if r[on] is not None), key=lambda r: r[on])
    out, i, j = [], 0, 0
    while i < len(ls):
        key = ls[i][on]
        while j < len(rs) and rs[j][on] < key:
            j += 1
        i_end = i
        while i_end < len(ls) and ls[i_end][on] == key:
            i_end += 1
        j_end = j
        while j_end < len(rs) and rs[j_end][on] == key:
            j_end += 1
        for lrow in ls[i:i_end]:
            if j_end > j:
                out.extend((lrow, rrow) for rrow in rs[j:j_end])
            elif how == "left":
                out.append((lrow, None))
        i, j = i_end, j_end
    if how == "left":
        out.extend((row, None) for row in lnull)
    return out


def sort_merge_join(left, right, on, how="inner", num_partitions=4):
    """Hash-partition both sides, sort each partition by key, and merge equal-key runs."""
    _check_how(how)
    lparts, rparts = _shuffle(left, on, num_partitions), _shuffle(right, on, num_partitions)
    out = []
    for lp, rp in zip(lparts, rparts):
        out.extend(_merge(lp, rp, on, how))
    return out, {"strategy": "sort_merge", "network_rows": count_rows(left) + count_rows(right)}


def choose_strategy(left, right, how="inner", broadcast_threshold=1000):
    """Pick {'strategy': 'broadcast', 'build_side': 'left'|'right'} or {'strategy': 'sort_merge'}."""
    _check_how(how)
    sizes = {"left": count_rows(left), "right": count_rows(right)}
    candidates = ["right"] if how == "left" else ["right", "left"]
    small = [side for side in candidates if sizes[side] <= broadcast_threshold]
    if not small:
        return {"strategy": "sort_merge"}
    side = min(small, key=lambda s: sizes[s])
    return {"strategy": "broadcast", "build_side": side}


def execute_join(left, right, on, how="inner", broadcast_threshold=1000, num_partitions=4):
    """Plan with choose_strategy and run it. Output pairs are always (left_row, right_row_or_None)."""
    plan = choose_strategy(left, right, how, broadcast_threshold)
    if plan["strategy"] == "sort_merge":
        return sort_merge_join(left, right, on, how, num_partitions)
    if plan["build_side"] == "right":
        return broadcast_hash_join(left, right, on, how)
    rows, stats = broadcast_hash_join(right, left, on, how)
    return [(lrow, rrow) for rrow, lrow in rows], stats
