"""Bug-injection checks for the distributed content group: each realistic bug must be caught by a specific hidden test."""
import ast
import json
from pathlib import Path

import pytest

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
EXERCISES = ["mapreduce_engine", "distributed_join_strategies", "skew_salting"]


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(ex, old, new):
    src = (EX / ex / "solution.py").read_text()
    buggy = src.replace(old, new)
    assert buggy != src, f"mutation {old!r} did not apply"
    return buggy


def _assert_caught(ex, old, new, test_name):
    r, failed = _failed(_mutate(ex, old, new), EX / ex)
    assert r["status"] == "failed"
    assert test_name in failed


@pytest.mark.parametrize("ex", EXERCISES)
def test_solution_passes_and_starter_fails(ex):
    r = grade((EX / ex / "solution.py").read_text(), EX / ex)
    assert r["status"] == "passed" and r["passed_tests"] == r["total_tests"]
    r = grade((EX / ex / "starter.py").read_text(), EX / ex)
    assert r["status"] == "failed" and r["passed_tests"] == 0


@pytest.mark.parametrize("ex", EXERCISES)
def test_hints_match_tests(ex):
    meta = json.loads((EX / ex / "exercise.json").read_text())
    tree = ast.parse((EX / ex / "tests_hidden.py").read_text())
    names = {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}
    assert set(meta["hints"]) == names
    assert meta["id"] == ex


# ---- mapreduce_engine ----

def test_python_hash_partitioner_is_caught():
    _assert_caught("mapreduce_engine", 'zlib.crc32(str(key).encode("utf-8"))', "hash(str(key))",
                   "test_partitioner_is_stable_crc32")


def test_mean_of_means_combiner_is_caught():
    _assert_caught("mapreduce_engine", "return [(key, (s, c))]", "return [(key, (s / c, 1))]",
                   "test_mean_via_sum_and_count_is_exact")


def test_unsorted_reducer_input_is_caught():
    _assert_caught("mapreduce_engine", "for key in sorted(groups):\n            out.extend",
                   "for key in groups:\n            out.extend", "test_reducer_input_is_sorted_by_key")


def test_ignored_combiner_is_caught():
    _assert_caught("mapreduce_engine", "if combiner is not None:", "if False:",
                   "test_combiner_reduces_shuffle_volume")


# ---- distributed_join_strategies ----

def test_null_keys_matching_is_caught():
    _assert_caught("distributed_join_strategies", "        if key is None:\n            continue\n", "",
                   "test_null_keys_never_match")


def test_left_join_dropping_unmatched_is_caught():
    _assert_caught("distributed_join_strategies", "            out.append((row, None))", "            pass",
                   "test_left_join_keeps_unmatched_rows")


def test_broadcasting_the_big_side_is_caught():
    _assert_caught("distributed_join_strategies", "side = min(small,", "side = max(small,",
                   "test_planner_broadcasts_the_small_side")


def test_broadcasting_preserved_side_of_left_join_is_caught():
    _assert_caught("distributed_join_strategies", 'candidates = ["right"] if how == "left" else ["right", "left"]',
                   'candidates = ["right", "left"]', "test_planner_broadcasts_the_small_side")


# ---- skew_salting ----

def test_single_phase_salted_aggregate_is_caught():
    _assert_caught("skew_salting", "final[key] = final.get(key, 0) + s", "final[key] = s",
                   "test_two_phase_sum_is_exact")


def test_salting_only_one_join_side_is_caught():
    _assert_caught("skew_salting", "salts = range(num_salts) if key in hot else range(1)", "salts = range(1)",
                   "test_salted_join_matches_plain_join")


def test_skew_rule_ignoring_min_size_is_caught():
    _assert_caught("skew_salting", "if s > factor * median and s > min_size]", "if s > factor * median]",
                   "test_detect_skew_needs_factor_and_min_size")
