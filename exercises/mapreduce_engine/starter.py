"""A mini MapReduce engine: input splits, map tasks, combiners, a stable partitioner, the shuffle and reduce tasks."""
import zlib


def record_size(key, value) -> int:
    """Bytes one intermediate (key, value) pair costs on the wire (given; don't change)."""
    return len(repr((key, value)).encode("utf-8"))


def partition_for(key, num_reducers: int) -> int:
    """Reducer index for key, stable across processes and machines."""
    raise NotImplementedError


def split_input(records: list, num_splits: int) -> list[list]:
    """Cut records into num_splits contiguous chunks whose sizes differ by at most one (bigger chunks first)."""
    raise NotImplementedError


def run_mapreduce(records, mapper, reducer, num_splits=4, num_reducers=3, combiner=None) -> dict:
    """Run a MapReduce job and return {'output', 'partitions', 'stats'}."""
    raise NotImplementedError


def word_count_mapper(line: str):
    """(word, 1) for every lower-cased, whitespace-separated word."""
    raise NotImplementedError


def sum_reducer(key, values):
    """[(key, sum(values))]; also a valid combiner because + is associative and commutative."""
    raise NotImplementedError


def inverted_index_mapper(doc):
    """doc is (doc_id, text): emit (word, doc_id) once per distinct lower-cased word."""
    raise NotImplementedError


def inverted_index_reducer(word, doc_ids):
    """[(word, sorted list of distinct doc ids)]."""
    raise NotImplementedError


def mean_mapper(record):
    """record is (key, number): emit (key, (number, 1)), a partial (sum, count)."""
    raise NotImplementedError


def sum_count_combiner(key, values):
    """Merge partial (sum, count) pairs into one (sum, count) pair."""
    raise NotImplementedError


def mean_reducer(key, values):
    """[(key, total_sum / total_count)] from partial (sum, count) pairs."""
    raise NotImplementedError

