# Distributed Joins: Broadcast, Shuffle Hash & Sort-Merge

On one machine, `orders JOIN customers ON cust` is a hash table lookup. On a cluster, `orders` is 500
partitions on 100 machines and `customers` is 20 partitions somewhere else. A row can only join with
rows **on the same machine**, so every distributed join strategy answers one question first: how do
matching keys end up together, and what does it cost in network traffic?

## Strategy 1: broadcast hash join

If one side is small (a dimension table, a lookup list), copy **all** of it to every partition of the
big side, build a hash table there, and probe it with the big side's rows in place.

```
network rows = rows(small) × partitions(big)        the big side never moves
```

This is a "map-side join" in Kleppmann's terms. It's the cheapest strategy by far, as long as the small
side really is small: broadcast the big side by mistake and you copy the biggest table N times and
probably run out of memory.

## Strategy 2: shuffle hash join

If both sides are big, **repartition both** by `crc32(key) mod N`. Equal keys get equal partition
indices, so partition *i* of the left only has to meet partition *i* of the right. Then build a hash
table from one side of each pair and probe with the other.

```
network rows = rows(left) + rows(right)
```

## Strategy 3: sort-merge join

Same shuffle, but each partition is **sorted** by key and the two sorted runs are merged with two
pointers. Equal-key runs produce their full cross product (3 left × 2 right rows with key 7 → 6 pairs).
Sorting can spill to disk, so this works even when no partition fits in a hash table. That's why it is
Spark SQL's default for large equi-joins.

## SQL semantics don't change with the strategy

Whichever plan runs, the answer must match the textbook definition:

- **Duplicates:** every left row pairs with every matching right row.
- **NULL never matches.** `NULL = NULL` is unknown, not true, so `None` keys never join, not even with
  each other. Hash joins must keep them out of the table, and merges must skip them.
- **Left join:** every left row appears at least once. Unmatched rows, including NULL-key rows, come out
  as `(row, NULL)`.

## The planner

Spark SQL's optimizer (Catalyst, Armbrust et al. 2015) picks a strategy from size estimates:

1. A side is **broadcastable** if its estimated size is ≤ `spark.sql.autoBroadcastJoinThreshold`
   (10 MB by default).
2. In a **left outer** join, only the right side can be broadcast. The left side is the one whose
   unmatched rows must be emitted, and only a task that sees all the matches for a left row can know
   it's unmatched. That means streaming the left side past a complete copy of the right.
3. If both sides qualify, broadcast the smaller one. If neither does, use sort-merge.

You can override the planner with hints: `/*+ BROADCAST(c) */`, `MERGE` or `SHUFFLE_HASH`. **Adaptive
query execution** (AQE) re-plans at runtime: if a shuffle reveals that one side is actually small, it
switches a sort-merge join to a broadcast join.

## In the exercise

You'll implement all three joins over partitioned row lists, count the rows each one moves, get NULLs,
duplicates and left joins right, and write `choose_strategy` and `execute_join`. When the planner builds
the left side, flip the pairs back so the output is still `(left_row, right_row)`.
