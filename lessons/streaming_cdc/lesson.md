# Streaming & Change Data Capture

Batch pipelines answer "what happened up to last night". Streaming pipelines answer "what is happening
now": fraud checks, live dashboards, a search index that's seconds behind the database. The data never
"finishes", events arrive out of order, and processes crash mid-flight. Three ideas make it manageable.

## Change data capture: the database as a stream

Every committed change in PostgreSQL or MySQL is first written to a **write-ahead log** (WAL). **CDC**
tools such as Debezium read that log and emit one event per row change:

```python
{"lsn": 103, "op": "u", "key": 1, "after": {"id": 1, "plan": "pro"}}   # c = insert, u = update, d = delete
```

Replaying those events in **LSN order** rebuilds an exact copy of the table elsewhere, with no nightly
full extract and no missed deletes. Connectors deliver **at least once**, though: after a restart they
re-send events you've already seen. The fix is cheap, because LSNs only increase. Remember the last
applied LSN and skip anything at or below it.

```python
for ev in sorted(events, key=lambda e: e["lsn"]):
    if ev["lsn"] <= last_lsn:
        continue            # replay or duplicate: already applied
    ...apply...
    last_lsn = ev["lsn"]
```

Without that check, a replayed old update overwrites a newer value, and a replayed insert resurrects a
deleted row.

## Event time, watermarks and lateness

A phone records a page view at 10:00:05, goes offline, and delivers it at 10:03. If you bucket by
**processing time** (when it arrived), it lands in the wrong minute, and replaying the same data
tomorrow gives different numbers. Bucket by **event time** instead: a tumbling window of size 60 puts
every event in `[t - t % 60, t - t % 60 + 60)`.

But when is the 10:00 window *done*? The Dataflow model (Akidau et al.) answers with a **watermark**: a
running estimate of how far event time has progressed. In the exercise it's simply the largest event
time seen. Once the watermark passes a window's end, the window is final. An event arriving for a
finalized window is **late**. **Allowed lateness** keeps windows open a little longer
(`end + allowed_lateness > watermark`), trading latency for completeness. Late events are reported, never
silently dropped.

## Delivery guarantees and offsets

A Kafka consumer reads a partition by **offset** and periodically **commits** how far it got. Where you
commit decides what a crash costs:

| Commit… | On crash | Guarantee |
|---|---|---|
| before processing | the rest of the batch is never processed | at-most-once (data loss) |
| after processing | part of the batch is processed again | at-least-once (duplicates) |

True exactly-once *delivery* is impossible over an unreliable network, but exactly-once *results* aren't.
Commit after processing, and make processing **idempotent**: dedupe by message id (or LSN), and write the
"seen" marker atomically with the result. Redelivered messages then change nothing. That's
**effectively-once**, and it's the same principle as Kafka's idempotent producer and transactions, which
write output and offsets in a single transaction.

```
poll → skip seen ids → update sink + seen ids → commit offset
```

## Beyond this exercise

Production systems add partition-parallel consumers, state checkpoints (Flink), triggers that emit early
and updated window results, and exactly-once sinks. The core contracts you'll implement here are the same:
apply CDC in LSN order exactly once, window by event time with a watermark, and commit only what you've
safely processed.
