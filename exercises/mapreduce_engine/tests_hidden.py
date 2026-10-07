"""Hidden validation suite for mapreduce_engine."""
import copy
import os
import random
import subprocess
import sys
import zlib
from collections import Counter, defaultdict

import pytest

import submission as sub

LINES = [
    "the quick brown fox",
    "the lazy dog",
    "The fox jumps over the dog",
    "a dog a fox a THE",
    "",
    "zebra apple mango apple",
    "fox fox fox",
]


def _rng_lines(seed, n=60):
    rng = random.Random(seed)
    vocab = ["alpha", "beta", "gamma", "delta", "eps", "zeta", "eta", "theta", "iota", "kappa"]
    weights = [30, 10, 8, 6, 5, 4, 3, 2, 1, 1]
    return [" ".join(rng.choices(vocab, weights, k=rng.randint(0, 12))) for _ in range(n)]


def _splits(records, n):
    base, extra = divmod(len(records), n)
    out, start = [], 0
    for i in range(n):
        size = base + (i < extra)
        out.append(records[start:start + size])
        start += size
    return out


def _crc(key, n):
    return zlib.crc32(str(key).encode("utf-8")) % n


def test_partitioner_is_stable_crc32():
    for n in (1, 2, 3, 7, 16):
        for k in ["fox", "dog", "", "user-42", 17, ("a", 1), None]:
            got = sub.partition_for(k, n)
            assert got == _crc(k, n), f"partition_for({k!r}, {n}) must be zlib.crc32(str(key).encode('utf-8')) % n"
    with pytest.raises(ValueError):
        sub.partition_for("x", 0)
    code = "import submission as s; print([s.partition_for(k, 5) for k in ['alice', 'bob', 'carol', 'dave', 'eve', 'fox']])"
    outs = set()
    for seed in ("1", "2", "3"):
        env = {**os.environ, "PYTHONHASHSEED": seed}
        p = subprocess.run([sys.executable, "-c", code], env=env, capture_output=True, text=True, timeout=10)
        assert p.returncode == 0, p.stderr[-500:]
        outs.add(p.stdout.strip())
    assert len(outs) == 1, "reducer ids changed between processes: built-in hash() of str is salted per process"


def test_split_input_contiguous_and_balanced():
    recs = list(range(10))
    assert sub.split_input(recs, 3) == [[0, 1, 2, 3], [4, 5, 6], [7, 8, 9]]
    assert sub.split_input(recs, 1) == [recs]
    assert sub.split_input([1, 2], 4) == [[1], [2], [], []]
    assert sub.split_input([], 2) == [[], []]
    with pytest.raises(ValueError):
        sub.split_input(recs, 0)


def test_word_count_matches_counter():
    for lines, splits, reducers in [(LINES, 3, 2), (_rng_lines(0), 5, 4), (_rng_lines(1), 1, 1)]:
        res = sub.run_mapreduce(lines, sub.word_count_mapper, sub.sum_reducer, num_splits=splits, num_reducers=reducers)
        expected = Counter(w for line in lines for w in line.lower().split())
        assert dict(res["output"]) == dict(expected)
        assert len(res["output"]) == len(expected), "each word must be reduced exactly once"
        assert len(res["partitions"]) == reducers
        assert res["output"] == [p for part in res["partitions"] for p in part], "output = partitions concatenated in order"


def test_each_key_lands_on_exactly_one_reducer():
    lines = _rng_lines(3)
    res = sub.run_mapreduce(lines, sub.word_count_mapper, sub.sum_reducer, num_splits=4, num_reducers=5)
    for i, part in enumerate(res["partitions"]):
        for k, _ in part:
            assert _crc(k, 5) == i, f"key {k!r} was reduced on reducer {i}, but the partitioner sends it to {_crc(k, 5)}"
    n_pairs = sum(len(line.split()) for line in lines)
    assert sum(res["stats"]["reducer_input_records"]) == n_pairs
    for i in range(5):
        expected = sum(1 for line in lines for w in line.lower().split() if _crc(w, 5) == i)
        assert res["stats"]["reducer_input_records"][i] == expected


def test_reducer_input_is_sorted_by_key():
    calls = defaultdict(list)

    def recording_reducer(key, values):
        calls[_crc(key, 2)].append(key)
        return [(key, list(values))]

    records = [("pear", 1), ("apple", 2), ("zucchini", 3), ("fig", 4), ("banana", 5), ("apple", 6), ("kiwi", 7),
               ("cherry", 8), ("pear", 9), ("date", 10), ("melon", 11), ("grape", 12)]
    res = sub.run_mapreduce(records, lambda r: [r], recording_reducer, num_splits=3, num_reducers=2)
    for r, keys in calls.items():
        assert keys == sorted(keys), f"reducer {r} saw keys in order {keys}; the shuffle must sort each reducer's input by key"
    for part in res["partitions"]:
        assert [k for k, _ in part] == sorted(k for k, _ in part)
    out = dict(res["output"])
    assert out["apple"] == [2, 6] and out["pear"] == [1, 9], "values keep map-task order, then emission order"


def _reference_shuffle(records, mapper, combiner, num_splits, num_reducers):
    recs = bts = 0
    for split in _splits(records, num_splits):
        emitted = [p for r in split for p in mapper(r)]
        if combiner is not None:
            g = {}
            for k, v in emitted:
                g.setdefault(k, []).append(v)
            emitted = [p for k in sorted(g) for p in combiner(k, g[k])]
        recs += len(emitted)
        bts += sum(len(repr((k, v)).encode("utf-8")) for k, v in emitted)
    return recs, bts


def test_combiner_reduces_shuffle_volume():
    lines = _rng_lines(7, n=80)
    plain = sub.run_mapreduce(lines, sub.word_count_mapper, sub.sum_reducer, num_splits=4, num_reducers=3)
    comb = sub.run_mapreduce(lines, sub.word_count_mapper, sub.sum_reducer, num_splits=4, num_reducers=3,
                             combiner=sub.sum_reducer)
    n_pairs = sum(len(line.split()) for line in lines)
    assert plain["stats"]["map_output_records"] == comb["stats"]["map_output_records"] == n_pairs
    assert plain["stats"]["shuffle_records"] == n_pairs, "without a combiner every map output pair is shuffled"
    exp_recs, exp_bytes = _reference_shuffle(lines, sub.word_count_mapper, sub.sum_reducer, 4, 3)
    assert comb["stats"]["shuffle_records"] == exp_recs, "with a combiner, one pair per (map task, word) is shuffled"
    assert comb["stats"]["shuffle_bytes"] == exp_bytes
    assert plain["stats"]["shuffle_bytes"] == _reference_shuffle(lines, sub.word_count_mapper, None, 4, 3)[1]
    assert comb["stats"]["shuffle_bytes"] < plain["stats"]["shuffle_bytes"] / 3
    assert comb["output"] == plain["output"], "a correct combiner never changes the job's result"


def test_mean_via_sum_and_count_is_exact():
    rng = random.Random(11)
    records = [("DE", 100.0)] * 1 + [("DE", 1.0)] * 9 + [("US", float(rng.randint(1, 50))) for _ in range(23)]
    records += [("FR", 7.0), ("US", 1000.0)]
    expected = defaultdict(list)
    for k, x in records:
        expected[k].append(x)
    for splits in (1, 2, 4, 7):
        res = sub.run_mapreduce(records, sub.mean_mapper, sub.mean_reducer, num_splits=splits, num_reducers=2,
                                combiner=sub.sum_count_combiner)
        got = dict(res["output"])
        for k, xs in expected.items():
            assert got[k] == pytest.approx(sum(xs) / len(xs)), (
                f"mean for {k} with {splits} splits; a mean of per-split means is wrong when splits differ in size")
    assert sub.sum_count_combiner("k", [(3.0, 2), (5.0, 3)]) == [("k", (8.0, 5))]


def test_inverted_index():
    docs = [(3, "Spark and MapReduce"), (1, "the shuffle in MapReduce"), (2, "spark spark shuffle"), (4, "")]
    res = sub.run_mapreduce(docs, sub.inverted_index_mapper, sub.inverted_index_reducer, num_splits=2, num_reducers=3)
    assert dict(res["output"]) == {
        "and": [3], "in": [1], "mapreduce": [1, 3], "shuffle": [1, 2], "spark": [2, 3], "the": [1],
    }
    assert sorted(sub.inverted_index_mapper((9, "b a b"))) == [("a", 9), ("b", 9)], "one posting per distinct word"
    assert res["stats"]["map_output_records"] == 9


def test_inputs_not_mutated_and_deterministic():
    lines = _rng_lines(5)
    snapshot = copy.deepcopy(lines)
    a = sub.run_mapreduce(lines, sub.word_count_mapper, sub.sum_reducer, num_splits=3, num_reducers=4,
                          combiner=sub.sum_reducer)
    b = sub.run_mapreduce(lines, sub.word_count_mapper, sub.sum_reducer, num_splits=3, num_reducers=4,
                          combiner=sub.sum_reducer)
    assert lines == snapshot
    assert a == b
    assert sub.split_input(lines, 3)[0] is not lines
