# Beyond Relational: Documents, Columns & Partitions

A row store like SQLite or PostgreSQL keeps each row's fields together on disk. That's ideal for "fetch
order 42 and everything about it". An analytics query is the opposite: "sum `amount` by `country` over a
billion events" needs two fields from every row and nothing else. Analytical systems reorganize storage
around that access pattern.

## Store columns, not rows

A **column store** keeps each column's values contiguously:

```
rows:     (1, DE, 30.0) (2, DE, 12.5) (3, US, 99.0) ...
columns:  order_id [1, 2, 3, ...]   country [DE, DE, US, ...]   amount [30.0, 12.5, 99.0, ...]
```

Value `i` of every column belongs to row `i`. A query that reads 2 of 50 columns now reads roughly 4% of
the bytes. C-Store argued for this design in 2005; Google's Dremel (BigQuery's engine) extended it to
nested records, and Parquet made it the default file format of the data lake.

## Compression comes almost free

A column holds one type and often few distinct values, so it compresses far better than mixed rows.

**Run-length encoding** stores repeats as `(value, count)`. It shines on sorted or clustered columns:

```
[DE, DE, DE, US, GB, GB]  →  [(DE, 3), (US, 1), (GB, 2)]
```

**Dictionary encoding** replaces values with small integer codes:

```
[US, DE, US, GB]  →  dictionary [US, DE, GB], codes [0, 1, 0, 2]
```

Parquet combines both: dictionary codes are RLE / bit-packed. Engines can even filter on the codes
without decoding (`country = 'DE'` becomes `code = 1`). The classic bug is an off-by-one in run counting.
Always check that `decode(encode(x)) == x`.

## Documents: nested data without joins

Document stores such as MongoDB keep each record as a nested JSON-like document. A customer embeds its
address instead of joining to an `addresses` table. Queries address nested fields with **dotted paths**:

```python
db.customers.find({"address.geo.country": "DE", "age": {"$gte": 20}})
```

Schemas are flexible, so a query must cope with documents where a path is missing, or where `address`
is a string instead of an object. Those just don't match. Convert documents to columns (shredding, as
Dremel does) and you get analytical speed on nested data.

## Partitioning: splitting data so you can skip it

Large tables are split into **partitions** by a partition key.

**Hash partitioning** puts a row in partition `hash(key) mod N`. Equal keys always land together, and
load spreads evenly. The hash must be **identical on every machine and every run**. Python's built-in
`hash()` of a string is salted per process (`PYTHONHASHSEED`), so a producer and a consumer would
disagree about where `"alice"` lives. Use a fixed function such as CRC32 or MurmurHash (Kafka's default
partitioner uses murmur2).

**Range partitioning** splits by ordered bounds, typically dates. As in PostgreSQL, the lower bound is
inclusive and the upper is exclusive:

```
bounds [Apr 1, Jul 1, Oct 1]  →  p0: < Apr 1 | p1: [Apr 1, Jul 1) | p2: [Jul 1, Oct 1) | p3: ≥ Oct 1
```

Its payoff is **partition pruning**: a query for `date BETWEEN May 15 AND Jul 1` only opens p1 and p2.
Note p2: `Jul 1` equals a bound, so it lives in the *next* partition. Pruning that drops it returns
silently wrong answers, which is worse than being slow. With `bisect_right`, the partitions to scan are
`range(part(lo), part(hi) + 1)`.

## Putting it together

A warehouse query first prunes **partitions** (by WHERE bounds), then prunes **columns** (by what it
references), then decodes and aggregates only what's left. In the exercise you'll build each piece:
columnar conversion, RLE and dictionary codecs, stable hash and range partitioning with pruning, a
dotted-path `find`, and an aggregation that reads only the columns it needs.
