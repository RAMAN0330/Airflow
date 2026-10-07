# Distributed Join Strategies

`orders JOIN customers ON cust` is one line of SQL, but on a cluster the two tables are split into
partitions on different machines. Rows with the same key must meet on one machine before they can be
joined. Spark SQL picks between three ways to make that happen, and in this exercise you build all three
plus the planner that chooses.

A **table** is a list of partitions, and each partition is a list of row dicts:

```python
orders = [[{"oid": 1, "cust": 7}, {"oid": 2, "cust": None}], [{"oid": 3, "cust": 9}]]
customers = [[{"cid": 10, "cust": 7}], [{"cid": 11, "cust": 7}, {"cid": 12, "cust": None}]]
```

A join returns `(rows, stats)`. `rows` is a list of `(left_row, right_row)` pairs. In a left join, an
unmatched left row appears as `(left_row, None)`. `stats` is `{"strategy": ..., "network_rows": int}`.
`how` is `"inner"` or `"left"`. Raise `ValueError` for anything else.

## What to implement (`starter.py`)

| Function | Strategy | `network_rows` |
|---|---|---|
| `broadcast_hash_join(left, right, on, how)` | Build a hash table from **all** of `right`, send a copy to every `left` partition, and probe it locally. `left` is never moved | `count_rows(right) * len(left)` |
| `shuffle_hash_join(left, right, on, how, num_partitions)` | Route every row of both sides to `partition_for(row[on], num_partitions)`, then hash-join partition *i* with partition *i* | `count_rows(left) + count_rows(right)` |
| `sort_merge_join(left, right, on, how, num_partitions)` | Same shuffle, then sort each partition by key and merge | same as shuffle hash |
| `choose_strategy(left, right, how, broadcast_threshold)` | The planner (below) | n/a |
| `execute_join(left, right, on, how, broadcast_threshold, num_partitions)` | Plan, then run the chosen join | the chosen join's |

`partition_for` and `count_rows` are given.

## SQL semantics

- **Duplicate keys** produce every combination: 3 left rows and 2 right rows with key `3` give 6 pairs.
- **NULL never matches.** A `None` key doesn't equal anything, including another `None`. In a left join,
  a `None`-key left row is still emitted, as `(row, None)`.
- **Left join** keeps every left row at least once, even when the right side is empty.

## The planner

Size is `count_rows`. Like Spark's `spark.sql.autoBroadcastJoinThreshold`:

1. A side can be broadcast if its size is `<= broadcast_threshold`. In a **left** join only the right side
   can be broadcast. The left side must be streamed so its unmatched rows can be emitted.
2. If several sides qualify, broadcast the **smaller** one (ties go to the right).
3. Return `{"strategy": "broadcast", "build_side": "left" | "right"}`, or `{"strategy": "sort_merge"}` if
   nothing qualifies (Spark's default for large equi-joins).

`execute_join` runs the plan. If it builds the left side, call `broadcast_hash_join(right, left, ...)`
and swap the pairs back so the output is still `(left_row, right_row)`.

```python
choose_strategy(big, small, "inner", broadcast_threshold=100)   # {"strategy": "broadcast", "build_side": "right"}
choose_strategy(small, big, "left", broadcast_threshold=100)    # {"strategy": "sort_merge"}
```

## What the hidden tests check

Each strategy against a nested-loop reference on random partitioned data, many-to-many keys in the
merge, NULL keys in inner and left joins, unmatched left rows, exact network row counts, planner
decisions including the left-join restriction and an inclusive threshold, output orientation when the
left side is broadcast, and no input mutation.
