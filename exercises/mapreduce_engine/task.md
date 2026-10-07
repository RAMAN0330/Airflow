# Build a Mini MapReduce Engine

Google's MapReduce (Dean & Ghemawat, 2004) made one idea famous: if you can phrase a job as a `map`
function and a `reduce` function, the framework handles the parallelism. It splits the input, runs map
tasks, moves every intermediate pair to the reducer that owns its key (**the shuffle**), sorts it, and runs
reduce tasks. Hadoop and Spark's `reduceByKey` work the same way. In this exercise you build that engine
as a deterministic, single-process simulation.

## The pieces (`starter.py`)

| Function | Does |
|---|---|
| `partition_for(key, num_reducers) -> int` | `zlib.crc32(str(key).encode("utf-8")) % num_reducers`. `ValueError` if `num_reducers < 1` |
| `split_input(records, num_splits) -> list[list]` | Exactly `num_splits` **contiguous** chunks whose sizes differ by at most one, bigger ones first. `ValueError` if `num_splits < 1` |
| `run_mapreduce(records, mapper, reducer, num_splits=4, num_reducers=3, combiner=None) -> dict` | Runs the job (below) |
| `record_size(key, value)` | **Given.** Bytes a pair costs on the wire |

Do **not** use Python's built-in `hash()` for partitioning: string hashes are salted per process, so
two workers would disagree about which reducer owns `"fox"`.

### `run_mapreduce` semantics

`mapper(record)` returns an iterable of `(key, value)` pairs. `reducer(key, values)` and
`combiner(key, values)` return an iterable of `(key, value)` pairs.

1. **Map.** One map task per split from `split_input`. Collect the task's output pairs in order.
2. **Combine** (optional). Inside each map task, group the output by key and replace it with
   `combiner(key, values)` for each key in **sorted** key order. The combiner only sees one task's data.
3. **Partition + shuffle.** Send each pair to reducer `partition_for(key, num_reducers)`, preserving order.
4. **Sort + reduce.** Each reducer groups its pairs by key and calls `reducer` once per key, in **sorted
   key order**. Values keep arrival order (map task order, then emission order).

Return:

```python
{
    "output": [...],          # all reducers' output pairs, reducer 0 first
    "partitions": [[...], ...],   # one list of output pairs per reducer
    "stats": {
        "map_output_records": int,       # pairs emitted by mappers (before combining)
        "shuffle_records": int,          # pairs that crossed the network (after combining)
        "shuffle_bytes": int,            # sum of record_size(k, v) over shuffled pairs
        "reducer_input_records": [int],  # pairs received by each reducer
    },
}
```

## Jobs to write

- **Word count.** `word_count_mapper(line)` emits `(word, 1)` per lower-cased whitespace-separated word.
  `sum_reducer(key, values)` returns `[(key, sum(values))]`. It doubles as the combiner.
- **Inverted index.** `inverted_index_mapper((doc_id, text))` emits `(word, doc_id)` once per **distinct**
  word. `inverted_index_reducer(word, doc_ids)` returns `[(word, sorted distinct doc ids)]`.
- **Mean per key.** `mean_mapper((key, x))` emits `(key, (x, 1))`. `sum_count_combiner` merges
  partial `(sum, count)` pairs into one, and `mean_reducer` returns `[(key, sum / count)]`.

A combiner must be associative and commutative. `sum` is. `mean` isn't: the mean of `[1, 1, 1]` and
`[10]` is 3.25, but the mean of their means is 5.5. That's why the combiner carries `(sum, count)`.

```python
res = run_mapreduce(["a b a", "b a"], word_count_mapper, sum_reducer, num_splits=2, num_reducers=2,
                    combiner=sum_reducer)
dict(res["output"])               # {"a": 3, "b": 2}
res["stats"]["shuffle_records"]   # 4: one (word, partial count) per map task and word, instead of 5
```

## What the hidden tests check

CRC32 partition ids that don't change under different `PYTHONHASHSEED`s, balanced contiguous splits,
word counts against `collections.Counter`, each key on exactly one reducer, sorted reducer input,
exact shuffle record/byte counts with and without a combiner, an exact mean across unevenly sized splits,
the inverted index, and no input mutation.
