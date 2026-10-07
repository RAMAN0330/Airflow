# Tame Data Skew: Salting, Range Partitioning & Pruning

A shuffle sends every row with key `k` to partition `partition_for(k, n)`. That's what makes `GROUP BY`
and joins work, and it's also how one hot key ruins a job: if 60% of the sales belong to one wholesale
customer, 60% of the work lands on one task. The other 199 tasks finish in seconds, and the stage waits
for the straggler. In this exercise you detect that, fix it, and avoid reading data you don't need.

`partition_for(key, n)` (CRC32-based) is given. Tables are lists of partitions of row dicts.

## 1. Detect skew

- `skew_ratio(sizes) -> float`: `max(sizes) / median(sizes)` (`statistics.median`). All zeros → `1.0`.
  Median zero but max positive → `float("inf")`. Empty → `ValueError`.
- `detect_skew(sizes, factor=5.0, min_size=0) -> list[int]`: indices where `size > factor * median`
  **and** `size > min_size`. This is Spark AQE's rule (`skewedPartitionFactor`, `skewedPartitionThresholdInBytes`).

## 2. Salted two-phase aggregation

`two_phase_sum(partitions, key_col, value_col, num_salts, num_partitions) -> (result, stats)` computes
`SUM(value_col) GROUP BY key_col`:

1. **Salt.** Number rows across all partitions in order (`i = 0, 1, 2, ...`). Row `i` gets the salted key
   `(key, i % num_salts)`.
2. **Phase 1.** Shuffle each row to `partition_for((key, salt), num_partitions)` and sum per `(key, salt)`
   in each partition. The hot key is now spread over up to `num_salts` partitions.
3. **Phase 2.** Drop the salt, shuffle each partial sum to `partition_for(key, num_partitions)`, and
   **add** the partials for each key.

`result` is `{key: total}` and must equal the unsalted answer exactly. `stats` is
`{"phase1_sizes": [...], "phase2_sizes": [...]}`, the number of records each partition receives in each
shuffle. `ValueError` if `num_salts < 1`.

## 3. Salted join

`salted_join(left, right, on, hot_keys, num_salts, num_partitions) -> (pairs, stats)` is an inner join
where `left` is the big, skewed side:

- **Left:** a hot key's rows get salts `0, 1, 2, ...` round-robin, counted per key. Other keys get salt `0`.
- **Right:** each hot-key row is **replicated** once per salt `0 .. num_salts-1`. Other rows get salt `0`.
- Shuffle both sides by `partition_for((key, salt), num_partitions)` and hash-join on `(key, salt)`.
  `None` keys never match.

Output is `(left_row, right_row)` pairs, plus `stats = {"left_sizes", "right_sizes", "replicated_rows"}`,
where `replicated_rows` counts the **extra** copies. Salt only one side and most hot matches vanish.

## 4. Balanced range partitioning

- `range_boundaries(sample, n) -> list`: sort the sample and take `s[i * len(s) // n]` for
  `i = 1 .. n-1`, dropping any split point that isn't strictly greater than the previous one. An empty
  sample gives `[]`. `ValueError` if `n < 1`. This is how Spark's `RangePartitioner` and `sortBy` stay balanced.
- `range_partition(value, bounds) -> int`: `bisect_right(bounds, value)`. Partition *i* holds
  `bounds[i-1] <= v < bounds[i]`.

## 5. Hive-style partitions and pruning

- `partition_path(row, cols)`: `"year=2024/month=03"`, values via `str()`. `None` is written as
  `__HIVE_DEFAULT_PARTITION__`.
- `parse_partition_path(path) -> dict`: the inverse, giving string values, or `None` for the default
  partition. Segments without `=` (bucket names, file names) are ignored.
- `prune_paths(paths, predicates)`: `predicates` maps a column to a function of the value. Keep a path
  only if every predicate on a column **present in the path** returns true. A predicate on a column that
  isn't a partition column can't rule out a directory.

```python
prune_paths(["year=2023/month=06", "year=2024/month=06"], {"year": lambda v: v == "2024"})
# ["year=2024/month=06"]
```

## What the hidden tests check

Skew ratios and the AQE rule, exact salted totals for several salt counts, the phase-1 load spread and
the phase-2 record count, a salted join against a nested-loop reference (including NULLs and unmatched
keys), replication counts, balanced boundaries on log-normal data versus equal-width ranges, Hive paths
and pruning, and no input mutation.
