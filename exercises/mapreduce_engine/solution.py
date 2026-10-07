"""A mini MapReduce engine: input splits, map tasks, combiners, a stable partitioner, the shuffle and reduce tasks."""
import zlib


def record_size(key, value) -> int:
    """Bytes one intermediate (key, value) pair costs on the wire (given; don't change)."""
    return len(repr((key, value)).encode("utf-8"))


def partition_for(key, num_reducers: int) -> int:
    """Reducer index for key, stable across processes and machines."""
    if num_reducers < 1:
        raise ValueError("num_reducers must be >= 1")
    return zlib.crc32(str(key).encode("utf-8")) % num_reducers


def split_input(records: list, num_splits: int) -> list[list]:
    """Cut records into num_splits contiguous chunks whose sizes differ by at most one (bigger chunks first)."""
    if num_splits < 1:
        raise ValueError("num_splits must be >= 1")
    base, extra = divmod(len(records), num_splits)
    splits, start = [], 0
    for i in range(num_splits):
        size = base + (1 if i < extra else 0)
        splits.append(list(records[start:start + size]))
        start += size
    return splits


def _group(pairs):
    """{key: [values...]} keeping first-seen key order and value order."""
    groups = {}
    for k, v in pairs:
        groups.setdefault(k, []).append(v)
    return groups


def run_mapreduce(records, mapper, reducer, num_splits=4, num_reducers=3, combiner=None) -> dict:
    """Run a MapReduce job and return {'output', 'partitions', 'stats'}."""
    splits = split_input(records, num_splits)
    buckets = [[] for _ in range(num_reducers)]
    map_output_records = shuffle_records = shuffle_bytes = 0

    for split in splits:  # one map task per split
        emitted = [pair for record in split for pair in mapper(record)]
        map_output_records += len(emitted)
        if combiner is not None:
            groups = _group(emitted)
            emitted = [pair for key in sorted(groups) for pair in combiner(key, groups[key])]
        for k, v in emitted:  # spill to the reducer that owns k
            buckets[partition_for(k, num_reducers)].append((k, v))
            shuffle_records += 1
            shuffle_bytes += record_size(k, v)

    partitions = []
    for bucket in buckets:  # one reduce task per partition
        groups = _group(bucket)
        out = []
        for key in sorted(groups):
            out.extend(reducer(key, groups[key]))
        partitions.append(out)

    return {
        "output": [pair for part in partitions for pair in part],
        "partitions": partitions,
        "stats": {
            "map_output_records": map_output_records,
            "shuffle_records": shuffle_records,
            "shuffle_bytes": shuffle_bytes,
            "reducer_input_records": [len(b) for b in buckets],
        },
    }


# ---- Jobs -------------------------------------------------------------------

def word_count_mapper(line: str):
    """(word, 1) for every lower-cased, whitespace-separated word."""
    return [(word, 1) for word in line.lower().split()]


def sum_reducer(key, values):
    """[(key, sum(values))]; also a valid combiner because + is associative and commutative."""
    return [(key, sum(values))]


def inverted_index_mapper(doc):
    """doc is (doc_id, text): emit (word, doc_id) once per distinct lower-cased word."""
    doc_id, text = doc
    return [(word, doc_id) for word in sorted(set(text.lower().split()))]


def inverted_index_reducer(word, doc_ids):
    """[(word, sorted list of distinct doc ids)]."""
    return [(word, sorted(set(doc_ids)))]


def mean_mapper(record):
    """record is (key, number): emit (key, (number, 1)), a partial (sum, count)."""
    key, x = record
    return [(key, (x, 1))]


def sum_count_combiner(key, values):
    """Merge partial (sum, count) pairs into one (sum, count) pair."""
    s = sum(v[0] for v in values)
    c = sum(v[1] for v in values)
    return [(key, (s, c))]


def mean_reducer(key, values):
    """[(key, total_sum / total_count)] from partial (sum, count) pairs."""
    s = sum(v[0] for v in values)
    c = sum(v[1] for v in values)
    return [(key, s / c)]
