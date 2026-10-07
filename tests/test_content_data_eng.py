"""Bug-injection checks for the data_eng content group: each realistic bug must be caught by a specific test."""
from pathlib import Path

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(ex, *pairs):
    src = (EX / ex / "solution.py").read_text()
    out = src
    for old, new in pairs:
        assert old in out, f"mutation anchor not found in {ex}: {old!r}"
        out = out.replace(old, new)
    assert out != src
    return out


# --- star_schema_scd2 -------------------------------------------------------------------------------------

_CLOSE = 'conn.execute("UPDATE dim_customer SET valid_to = ?, is_current = 0 WHERE customer_key = ?", (as_of, cur[0]))'


def test_scd2_type1_overwrite_is_caught():
    buggy = _mutate("star_schema_scd2", (_CLOSE, 'conn.execute("UPDATE dim_customer SET name = ?, country = ? '
                                                 'WHERE customer_key = ?", (row["name"], row["country"], cur[0])); '
                                                 'counts["updated"] += 1; continue'))
    r, failed = _failed(buggy, EX / "star_schema_scd2")
    assert r["status"] == "failed"
    assert {"test_scd2_change_adds_version_and_closes_old", "test_history_preserved_for_old_facts"} <= failed


def test_scd2_not_closing_previous_version_is_caught():
    buggy = _mutate("star_schema_scd2", (_CLOSE, "pass"))
    r, failed = _failed(buggy, EX / "star_schema_scd2")
    assert r["status"] == "failed"
    assert {"test_scd2_change_adds_version_and_closes_old", "test_history_preserved_for_old_facts"} <= failed


def test_fact_at_order_grain_is_caught():
    buggy = _mutate("star_schema_scd2", ("ORDER BY oi.order_id, oi.product_id",
                                         "GROUP BY oi.order_id ORDER BY oi.order_id"))
    r, failed = _failed(buggy, EX / "star_schema_scd2")
    assert r["status"] == "failed"
    assert "test_fact_grain_is_order_line" in failed


# --- columnar_partitioning --------------------------------------------------------------------------------

def test_builtin_hash_partitioning_is_caught():
    buggy = _mutate("columnar_partitioning", ('zlib.crc32(str(key).encode("utf-8"))', "hash(key)"))
    r, failed = _failed(buggy, EX / "columnar_partitioning")
    assert r["status"] == "failed"
    assert {"test_hash_partition_matches_crc32", "test_hash_partition_stable_across_processes"} <= failed


def test_rle_off_by_one_is_caught():
    buggy = _mutate("columnar_partitioning", ("runs.append((v, 1))", "runs.append((v, 0))"))
    r, failed = _failed(buggy, EX / "columnar_partitioning")
    assert r["status"] == "failed"
    assert "test_rle_roundtrip_and_runs" in failed


def test_pruning_drops_boundary_partition_is_caught():
    buggy = _mutate("columnar_partitioning",
                    ("from bisect import bisect_right", "from bisect import bisect_left, bisect_right"),
                    ("else range_partition(hi, bounds)", "else bisect_left(bounds, hi)"))
    r, failed = _failed(buggy, EX / "columnar_partitioning")
    assert r["status"] == "failed"
    assert failed == {"test_prune_includes_boundary_partitions"}


def test_reading_every_column_is_caught():
    buggy = _mutate("columnar_partitioning", ("    keys = table[group_by]\n",
                                              "    _all = dict(table.items())\n    keys = table[group_by]\n"))
    r, failed = _failed(buggy, EX / "columnar_partitioning")
    assert failed == {"test_aggregate_touches_only_needed_columns"}


# --- stream_cdc_processor ---------------------------------------------------------------------------------

def test_cdc_applying_duplicates_is_caught():
    buggy = _mutate("stream_cdc_processor", ('if ev["lsn"] <= last_lsn:', "if False:"))
    r, failed = _failed(buggy, EX / "stream_cdc_processor")
    assert r["status"] == "failed"
    assert "test_cdc_skips_already_applied_lsns" in failed


def test_processing_time_windows_are_caught():
    buggy = _mutate("stream_cdc_processor", ('t = ev["event_time"]', 't = ev["arrival_time"]'))
    r, failed = _failed(buggy, EX / "stream_cdc_processor")
    assert r["status"] == "failed"
    assert "test_windows_use_event_time" in failed


def test_commit_before_processing_is_caught():
    buggy = _mutate("stream_cdc_processor", ("        for msg in batch:\n",
                                             '        store["offset"] = start + len(batch)\n        for msg in batch:\n'))
    r, failed = _failed(buggy, EX / "stream_cdc_processor")
    assert r["status"] == "failed"
    assert failed == {"test_crash_restart_is_effectively_once"}


def test_consumer_without_dedup_is_caught():
    buggy = _mutate("stream_cdc_processor", ('if msg["id"] in store["processed_ids"]:', "if False:"))
    r, failed = _failed(buggy, EX / "stream_cdc_processor")
    assert {"test_consumer_dedupes_redelivered_messages", "test_crash_restart_is_effectively_once"} <= failed
