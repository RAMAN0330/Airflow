# Stream Processing: CDC, Windows & Effectively-Once

Nightly batch loads aren't fast enough anymore. The product team wants the warehouse copy of `accounts`
seconds behind production, live per-minute metrics, and a payments consumer that never loses or
double-counts money, even when its process crashes. Build the three pieces.

## 1. `apply_cdc(state, events, last_lsn=0) -> (new_state, last_lsn)`

A CDC connector (think Debezium) reads the database's write-ahead log and emits one event per row change:

```python
{"lsn": 103, "op": "u", "key": 1, "after": {"id": 1, "email": "ana@example.com", "plan": "pro"}}
```

`op` is `"c"` (insert), `"u"` (update) or `"d"` (delete, `after` is `None`). `lsn` is the log sequence
number: it strictly increases with commit order. `state` maps `key` to a row dict.

- Apply events in **LSN order**, whatever order they arrived in.
- **Skip** any event with `lsn <= last_lsn`, including ones already applied earlier in the same batch.
  Connectors redeliver after restarts, so this is what makes replays harmless.
- `c` and `u` store a copy of `after` (an update for a missing key inserts it). `d` removes the key if
  present.
- Return a **new** state (don't modify `state`, `events` or the row dicts) and the LSN of the last applied
  event, or the `last_lsn` you were given if nothing was applied.

## 2. `tumbling_windows(events, size, allowed_lateness=0) -> (windows, late)`

Each event has an `event_time` (when it happened, on the device) and an `arrival_time` (when it reached
you). Process the events **in list order**, which is arrival order.

- Window by **event time**: an event belongs to window `start = event_time - event_time % size`, covering
  `[start, start + size)`.
- The **watermark** is the largest `event_time` accepted so far. An event is **late** if
  `start + size + allowed_lateness <= watermark`: its window has already been finalized. Late events go
  in `late` (in arrival order) and don't count.
- `windows` maps each window `start` to the sum of its events' `value`.
- `size <= 0` raises `ValueError`.

## 3. `consume(log, store, batch_size=10, crash_after=None) -> int`

`log` is a partition: a list of messages `{"id", "account", "amount"}`, where the index is the offset. The
producer sometimes writes the same message twice (same `id`). `store` is durable state that survives
crashes. Initialize any missing keys:

```python
store["offset"]         # committed offset: the next message to read (starts at 0)
store["balances"]       # account -> total amount (the sink)
store["processed_ids"]  # set of message ids already applied to balances
```

Read batches of `batch_size` starting at `store["offset"]`. For each message, apply its amount to
`balances` unless its `id` is in `processed_ids`. After the **whole batch** is processed, commit by
setting `store["offset"]` to the end of the batch. Return the number of messages handled in this call.

**Simulated crash:** if `crash_after` isn't `None`, raise `Crash` right before handling the message when
`crash_after` messages have already been handled in this call. Whatever is in `store` at that moment
is what the restarted consumer sees.

The goal is **effectively-once**: after any crash and a restart (`consume(log, store)` again), the balances
must equal processing every distinct message exactly once.

## What the hidden tests check

Insert/update/delete, replays and duplicates, out-of-order batches, purity and idempotency, event-time vs
arrival-time windows, the watermark and allowed lateness, offsets and dedup, and a crash at every
possible point for several batch sizes.
