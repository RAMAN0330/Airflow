"""Change data capture, event-time windows and an effectively-once consumer in pure Python."""


class Crash(Exception):
    """Raised to simulate the consumer process dying mid-batch."""


def apply_cdc(state: dict, events: list[dict], last_lsn: int = 0) -> tuple[dict, int]:
    new_state = {k: dict(v) for k, v in state.items()}
    for ev in sorted(events, key=lambda e: e["lsn"]):
        if ev["lsn"] <= last_lsn:
            continue  # already applied (replay or duplicate)
        if ev["op"] in ("c", "u"):
            new_state[ev["key"]] = dict(ev["after"])
        elif ev["op"] == "d":
            new_state.pop(ev["key"], None)
        else:
            raise ValueError(f"unknown op {ev['op']!r}")
        last_lsn = ev["lsn"]
    return new_state, last_lsn


def tumbling_windows(events: list[dict], size: int, allowed_lateness: int = 0) -> tuple[dict, list[dict]]:
    if size <= 0:
        raise ValueError("size must be positive")
    windows: dict = {}
    late: list[dict] = []
    watermark = None  # max event time seen so far
    for ev in events:
        t = ev["event_time"]
        start = t - t % size
        if watermark is not None and start + size + allowed_lateness <= watermark:
            late.append(ev)
            continue
        windows[start] = windows.get(start, 0) + ev["value"]
        watermark = t if watermark is None else max(watermark, t)
    return windows, late


def _handle(store: dict, msg: dict) -> None:
    if msg["id"] in store["processed_ids"]:
        return  # redelivered: already reflected in the sink
    balances = store["balances"]
    balances[msg["account"]] = balances.get(msg["account"], 0) + msg["amount"]
    store["processed_ids"].add(msg["id"])


def consume(log: list[dict], store: dict, batch_size: int = 10, crash_after: int | None = None) -> int:
    store.setdefault("offset", 0)
    store.setdefault("balances", {})
    store.setdefault("processed_ids", set())
    handled = 0
    while store["offset"] < len(log):
        start = store["offset"]
        batch = log[start:start + batch_size]
        for msg in batch:
            if crash_after is not None and handled == crash_after:
                raise Crash(f"crashed after {handled} messages")
            _handle(store, msg)
            handled += 1
        store["offset"] = start + len(batch)  # commit only after the whole batch is processed
    return handled
