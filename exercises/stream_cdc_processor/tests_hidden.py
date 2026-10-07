"""Hidden validation suite for stream_cdc_processor."""
import copy
import random

import pytest

import submission as sub

CDC = [
    {"lsn": 101, "op": "c", "key": 1, "after": {"id": 1, "email": "ana@example.com", "plan": "free"}},
    {"lsn": 102, "op": "c", "key": 2, "after": {"id": 2, "email": "ben@example.com", "plan": "free"}},
    {"lsn": 103, "op": "u", "key": 1, "after": {"id": 1, "email": "ana@example.com", "plan": "pro"}},
    {"lsn": 104, "op": "c", "key": 3, "after": {"id": 3, "email": "chen@example.com", "plan": "team"}},
    {"lsn": 105, "op": "d", "key": 2, "after": None},
]
FINAL = {1: {"id": 1, "email": "ana@example.com", "plan": "pro"},
         3: {"id": 3, "email": "chen@example.com", "plan": "team"}}


def make_log(n=37, seed=0, dup_every=6):
    rng = random.Random(seed)
    log = []
    for i in range(n):
        msg = {"id": f"tx-{i}", "account": rng.choice("ABC"), "amount": rng.randint(1, 100)}
        log.append(msg)
        if i % dup_every == 0:
            log.append(dict(msg))  # producer retry: the same message written twice
    return log


def expected_balances(log):
    seen, out = set(), {}
    for m in log:
        if m["id"] not in seen:
            seen.add(m["id"])
            out[m["account"]] = out.get(m["account"], 0) + m["amount"]
    return out


def test_cdc_applies_insert_update_delete():
    state, lsn = sub.apply_cdc({}, CDC)
    assert state == FINAL
    assert lsn == 105, "return the LSN of the last applied event"


def test_cdc_skips_already_applied_lsns():
    state, lsn = sub.apply_cdc({}, CDC)
    replay = [CDC[0], CDC[1], CDC[3],  # redelivered after a connector restart
              {"lsn": 106, "op": "u", "key": 3, "after": {"id": 3, "email": "chen@example.com", "plan": "pro"}}]
    state, lsn = sub.apply_cdc(state, replay, lsn)
    assert 2 not in state, "a replayed insert (lsn 102) must not resurrect a deleted row"
    assert state[1]["plan"] == "pro", "a replayed old image (lsn 101) must not overwrite a newer one"
    assert state[3]["plan"] == "pro" and lsn == 106
    dup = sub.apply_cdc({}, CDC + [CDC[2], CDC[1]])
    assert dup == (FINAL, 105), "duplicate events within one batch are applied once"


def test_cdc_orders_events_by_lsn():
    shuffled = CDC[:]
    random.Random(4).shuffle(shuffled)
    assert sub.apply_cdc({}, shuffled) == (FINAL, 105), "apply events in LSN order, not arrival order"
    late_upd = [{"lsn": 201, "op": "u", "key": 1, "after": {"id": 1, "plan": "old"}},
                {"lsn": 200, "op": "u", "key": 1, "after": {"id": 1, "plan": "older"}}]
    state, lsn = sub.apply_cdc({}, late_upd)
    assert state[1]["plan"] == "old" and lsn == 201


def test_cdc_is_idempotent_and_pure():
    start = {9: {"id": 9, "plan": "free"}}
    frozen_state, frozen_events = copy.deepcopy(start), copy.deepcopy(CDC)
    once = sub.apply_cdc(start, CDC)
    assert start == frozen_state and CDC == frozen_events, "don't modify the input state or events"
    twice = sub.apply_cdc(once[0], CDC, once[1])
    assert twice == once, "re-applying the same batch from the returned LSN changes nothing"
    once[0][1]["plan"] = "hacked"
    assert sub.apply_cdc(start, CDC)[0][1]["plan"] == "pro", "state rows must be copies, not shared dicts"
    assert sub.apply_cdc({}, [], 42) == ({}, 42)


def test_windows_use_event_time():
    # Arrival (processing) order differs from event order: a phone was offline for a while.
    events = [
        {"event_time": 5, "arrival_time": 100, "value": 1},
        {"event_time": 61, "arrival_time": 101, "value": 2},
        {"event_time": 30, "arrival_time": 125, "value": 4},
        {"event_time": 119, "arrival_time": 170, "value": 8},
        {"event_time": 120, "arrival_time": 171, "value": 16},
    ]
    windows, late = sub.tumbling_windows(events, 60, allowed_lateness=60)
    assert windows == {0: 5, 60: 10, 120: 16}, "assign windows by event_time, not arrival_time"
    assert late == []


def test_late_events_dropped_after_watermark():
    events = [
        {"event_time": 10, "arrival_time": 0, "value": 1},
        {"event_time": 59, "arrival_time": 1, "value": 1},   # window [0,60) still open: watermark 10 < 60
        {"event_time": 70, "arrival_time": 2, "value": 1},   # watermark -> 70, closes [0,60)
        {"event_time": 130, "arrival_time": 3, "value": 1},  # watermark -> 130
        {"event_time": 50, "arrival_time": 4, "value": 1},   # [0,60) closed (60 <= 130): late
        {"event_time": 119, "arrival_time": 5, "value": 1},  # [60,120) closed (120 <= 130): late
        {"event_time": 125, "arrival_time": 6, "value": 1},
    ]
    windows, late = sub.tumbling_windows(events, 60)
    assert windows == {0: 2, 60: 1, 120: 2}
    assert [e["event_time"] for e in late] == [50, 119], "late events are returned in arrival order"
    with pytest.raises(ValueError):
        sub.tumbling_windows(events, 0)


def test_allowed_lateness_accepts_stragglers():
    events = [
        {"event_time": 10, "arrival_time": 0, "value": 3},
        {"event_time": 125, "arrival_time": 1, "value": 1},
        {"event_time": 20, "arrival_time": 2, "value": 4},   # window end 60 + 30 <= watermark 125: late
        {"event_time": 100, "arrival_time": 3, "value": 5},  # window end 120 + 30 > 125: accepted
        {"event_time": 200, "arrival_time": 4, "value": 1},
        {"event_time": 140, "arrival_time": 5, "value": 2},  # window end 180 + 30 > 200: accepted
        {"event_time": 110, "arrival_time": 6, "value": 9},  # window end 120 + 30 <= 200: late
    ]
    windows, late = sub.tumbling_windows(events, 60, allowed_lateness=30)
    assert windows == {0: 3, 60: 5, 120: 3, 180: 1}
    assert [e["value"] for e in late] == [4, 9]
    assert sub.tumbling_windows([], 60) == ({}, [])


def test_consumer_processes_everything_and_commits():
    log = make_log()
    store = {}
    handled = sub.consume(log, store, batch_size=5)
    assert handled == len(log), "return how many messages were handled in this run"
    assert store["offset"] == len(log), "commit the offset after the last batch"
    assert store["balances"] == expected_balances(log)
    assert sub.consume(log, store, batch_size=5) == 0, "a restart with nothing new handles nothing"


def test_consumer_dedupes_redelivered_messages():
    log = make_log(n=20, dup_every=1)  # every message written twice
    store = {}
    sub.consume(log, store, batch_size=3)
    assert store["balances"] == expected_balances(log), "a message id already processed must not count again"
    assert len(store["processed_ids"]) == 20


def test_crash_restart_is_effectively_once():
    log = make_log(n=23, seed=7)
    want = expected_balances(log)
    for batch_size in (1, 4, 10):
        for crash_after in range(len(log)):
            store = {}
            with pytest.raises(sub.Crash):
                sub.consume(log, store, batch_size=batch_size, crash_after=crash_after)
            assert store["offset"] == (crash_after // batch_size) * batch_size, (
                f"batch_size={batch_size}, crash after {crash_after}: the committed offset must be the start of "
                f"the unfinished batch ({(crash_after // batch_size) * batch_size}), got {store['offset']}")
            sub.consume(log, store, batch_size=batch_size)  # restart from the committed offset
            assert store["balances"] == want, (
                f"batch_size={batch_size}, crash after {crash_after}: balances differ after restart "
                "(lost or double-counted messages)")
