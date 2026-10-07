# Data Skew & Partitioning

Hash partitioning spreads **keys** evenly, not **rows**. If one wholesale customer has 60% of all
sales, every one of those rows hashes to the same partition. 199 tasks finish in ten seconds, and one
task runs for twenty minutes. The stage is only as fast as its slowest task, so adding machines doesn't
help. Kleppmann calls these **hot keys**, and they are the most common reason a "simple" Spark job
crawls.

## Detecting skew

Look at partition sizes after a shuffle and compare the biggest with the **median** (the mean is pulled
up by the outlier you're trying to find):

```
sizes = [100, 110, 90, 105, 2000, 95, 600]     median = 105
skew ratio = 2000 / 105 ≈ 19
```

Spark's adaptive query execution (AQE) uses exactly this test for skew joins. A partition is skewed if
it is larger than `skewedPartitionFactor` (default 5) × the median **and** larger than
`skewedPartitionThresholdInBytes` (default 256 MB). The second condition stops it from "fixing" tiny
partitions.

## Salting an aggregation

To spread a hot key, give its rows different sub-keys: `(key, salt)` with `salt = i % S`. Now the whale
customer's rows land in up to S partitions. But each partition only has **part** of the whale's total,
so one shuffle isn't enough:

```
phase 1: shuffle by (key, salt)  → partial sums  {("whale",0): 812, ("whale",1): 790, ...}
phase 2: shuffle by key          → add partials  {"whale": 812 + 790 + ...}
```

Phase 2 moves at most S records per key, which is tiny. The common bug is stopping after phase 1, or
**overwriting** instead of adding in phase 2. Both give a result that looks plausible and is wrong.
Like a combiner, this only works for associative operations: sum, count, min, max, or (sum, count) for a mean.

## Salting a join

For `sales JOIN profiles`, salting the big side alone breaks the join: a sales row tagged
`("whale", 3)` only meets profile rows tagged `("whale", 3)`. So **replicate** each hot row of the
other side once per salt. That costs S − 1 extra copies per hot row, which is cheap when that side is
small. AQE's skew join does the same thing automatically: it splits the skewed partition and duplicates
the matching partition of the other side.

## Range partitioning from samples

Sorting and range-partitioned writes need boundaries. Equal-width ranges (`0–1000`, `1000–2000`, ...)
fail on skewed values, because almost everything falls in the first bucket. Spark's `RangePartitioner`
**samples** the data and uses its quantiles instead:

```python
s = sorted(sample)
bounds = [s[i * len(s) // n] for i in range(1, n)]   # then partition = bisect_right(bounds, v)
```

## Directory partitioning and pruning

Hive-style tables encode partition columns in the path: `sales/year=2024/month=03/part-0.parquet`.
Spark discovers these columns from the paths, and NULL values go to `__HIVE_DEFAULT_PARTITION__`. A
query with `WHERE year = 2024` can **prune** every other directory without opening it. A predicate on
a non-partition column can't prune anything. Delta Lake extends the idea to files with per-file min/max
statistics (**data skipping**). Choose partition columns with moderate cardinality: partitioning by
`user_id` creates millions of tiny files, which is a skew problem of its own.

## In the exercise

You'll compute skew ratios and the AQE rule, write an exact salted two-phase sum, salt a join by
replicating the small side, derive balanced range boundaries from a sample, and build and prune
Hive-style paths.
