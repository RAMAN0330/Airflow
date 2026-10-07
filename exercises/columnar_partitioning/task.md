# Columnar Storage, Encodings & Partition Pruning

The shop's event log has outgrown the row store. Analysts only ever sum a couple of columns out of dozens,
filter by date, and the marketing team keeps its customer profiles as nested JSON documents. Build the
storage tricks that warehouses like BigQuery (Dremel) and file formats like Parquet use, in plain Python.

## 1. Columnar layout

`to_columnar(rows) -> dict[str, list]` pivots a list of row dicts into one list per column. Columns appear
in the order they're **first seen** across the rows, and a row missing a field gets `None`, so every
column has exactly `len(rows)` entries. Don't modify the input.

```python
to_columnar([{"a": 1, "b": "x"}, {"a": 2, "c": True}])
# {"a": [1, 2], "b": ["x", None], "c": [None, True]}
```

## 2. Encodings

| Function | Example |
|---|---|
| `rle_encode(values) -> [(value, count), ...]` | `["DE", "DE", "US"]` → `[("DE", 2), ("US", 1)]` |
| `rle_decode(runs) -> list` | the inverse |
| `dict_encode(values) -> (dictionary, codes)` | `["US", "DE", "US"]` → `(["US", "DE"], [0, 1, 0])` |
| `dict_decode(dictionary, codes) -> list` | the inverse |

Adjacent runs never share a value. The dictionary lists distinct values in first-seen order. `None` is an
ordinary value. Empty input gives `[]` / `([], [])`.

## 3. Hash partitioning

`hash_partition(key, num_partitions) -> int` must be **stable across processes and machines**:

```python
zlib.crc32(str(key).encode("utf-8")) % num_partitions
```

Do **not** use Python's built-in `hash()`. Raise `ValueError` if `num_partitions < 1`.

`partition_rows(rows, key, num_partitions) -> list[list[dict]]` returns `num_partitions` lists, routing each
row by `hash_partition(row[key], …)` and keeping input order inside each list.

## 4. Range partitioning and pruning

`bounds` is a sorted list of split points, giving `len(bounds) + 1` partitions. Partition `i` holds values
with `bounds[i-1] <= v < bounds[i]` (lower bound inclusive, upper exclusive, like PostgreSQL).

- `range_partition(value, bounds) -> int`: the partition a value belongs to.
- `prune_partitions(bounds, lo=None, hi=None) -> list[int]`: the sorted ids of the partitions that can hold
  any value in the **closed** range `[lo, hi]`. `None` means unbounded on that side. Return exactly those
  partitions: never skip one that might match, and never include one that can't.

```python
prune_partitions([10, 20, 30], 15, 20)   # [1, 2]  (20 lives in partition 2)
```

## 5. Document queries

`find(docs, filt) -> list[dict]` returns, in order, the documents that match **every** condition in `filt`:

- Keys are dotted paths (`"address.geo.country"`) that descend through nested dicts. If any step is
  missing or isn't a dict, the condition doesn't match.
- A value that's a dict whose keys all start with `$` holds operators: `$eq`, `$gt`, `$gte`, `$lt`, `$lte`,
  `$in`. All of them must hold. If a comparison raises `TypeError` (say `"n/a" > 20`), it doesn't match.
- Anything else is an equality match, including a plain dict.
- `{}` matches everything.

## 6. Column-pruned aggregation

`aggregate_sum(table, group_by, value_col, where=None) -> dict` computes `SUM(value_col) GROUP BY group_by`
over a columnar table (any mapping of column → list). `where` is an optional `{column: value}` equality
filter. **Read only the columns the query needs**: that's the whole point of a column store.

## What the hidden tests check

Column shapes and missing values, encode/decode round trips on random data, CRC32 partition ids, identical
partitioning under different `PYTHONHASHSEED`s, boundary values in range partitioning, pruning against a
brute-force scan, nested paths and operators, and which columns your aggregation reads.
