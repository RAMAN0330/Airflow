# MapReduce & the Shuffle

Counting words in one file is a `Counter`. Counting words in 20 TB of logs spread over 1,000 machines
is a distributed systems problem: who reads what, where do the counts for `"error"` meet, and what
happens when a machine dies halfway? Google's **MapReduce** (Dean & Ghemawat, 2004) answered this with
a deal: you write two pure functions, and the framework handles everything else.

```python
def map(line):              # runs on every input record, anywhere
    for word in line.lower().split():
        yield (word, 1)

def reduce(word, counts):   # runs once per key, after all its values are gathered
    yield (word, sum(counts))
```

## The execution model

1. **Split** the input into M chunks. Each chunk gets a **map task**, and map tasks don't talk to each other.
2. Each map task buckets its output pairs into R buckets with a **partitioner**: `hash(key) mod R`.
3. **Shuffle.** Reducer *r* fetches bucket *r* from every map task. This is all-to-all communication:
   M × R transfers over the network.
4. **Sort.** Each reducer sorts what it received by key, so all values for one key are adjacent.
5. **Reduce.** Call `reduce(key, values)` once per key, in key order.

Spark runs the same pattern: `reduceByKey`, `groupByKey` and `join` all trigger a shuffle, and Spark's
docs call it "a complex and costly operation" because it involves disk I/O, serialization and network I/O.
Most tuning of batch jobs comes down to **moving fewer bytes through the shuffle**.

## The partitioner must be stable

Every map task, on every machine, must agree that `"fox"` belongs to reducer 2. Python's built-in
`hash()` of a string is salted per process (`PYTHONHASHSEED`), so two workers would send `"fox"` to
different reducers and you'd get two partial counts. Use a hash that is part of the data format instead:

```python
zlib.crc32(str(key).encode("utf-8")) % R
```

## Sorted reducer input

The framework guarantees that each reducer sees its keys in sorted order. That turns grouping into a
streaming merge (no giant in-memory dict), and it makes each output file sorted, which is handy when it
feeds a later join. Your engine has to preserve that contract: sort a reducer's keys before calling `reduce`.

## Combiners: reduce before the network

If one map task sees `"the"` 50,000 times, it would ship 50,000 `("the", 1)` pairs. A **combiner** runs
the reduce logic locally first and ships `("the", 50000)` once. Counting shuffle **records and bytes**
with and without a combiner shows the saving directly. Hadoop's tutorial uses the reducer as the combiner
for word count.

The catch: the combiner runs on an arbitrary, uneven subset of the values, and maybe not at all. That's
only safe if the operation is **associative and commutative**. `sum`, `max` and `count` are. `mean` isn't:

```
split A: [1, 1, 1]   split B: [10]
true mean            = 13 / 4 = 3.25
mean of split means  = (1 + 10) / 2 = 5.5   ✗
```

The fix is to make the partial result mergeable: the mapper emits `(x, 1)`, the combiner adds
`(sum, count)` pairs, and only the reducer divides.

## Fault tolerance and stragglers

Map and reduce are deterministic functions of their input, so a failed task can simply be re-run on
another machine. The paper also launches **backup copies** of the last few running tasks, because one
slow machine (a straggler) can hold up the whole job. The next two lessons look at stragglers caused
by the data itself: joins, and hot keys.

## In the exercise

You'll build `run_mapreduce`: splits, map tasks, an optional combiner, a CRC32 partitioner, a sorted
shuffle and reducers, plus shuffle statistics. Then you'll write word count, an inverted index and an
exact mean on top of it.
