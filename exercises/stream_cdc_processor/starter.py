"""Change data capture, event-time windows and an effectively-once consumer in pure Python."""


class Crash(Exception):
    """Raised to simulate the consumer process dying mid-batch."""


def apply_cdc(state: dict, events: list[dict], last_lsn: int = 0) -> tuple[dict, int]:
    """Apply c/u/d change events in LSN order, skipping any with lsn <= last_lsn; return (new_state, last_lsn)."""
    # TODO: copy the state, sort by lsn, skip already-applied events, upsert on c/u, remove on d
    raise NotImplementedError


def tumbling_windows(events: list[dict], size: int, allowed_lateness: int = 0) -> tuple[dict, list[dict]]:
    """Sum 'value' per event-time window [start, start + size); return (windows, late_events)."""
    # TODO: window by event_time; drop events whose window end + allowed_lateness <= watermark (max event time seen)
    raise NotImplementedError


def consume(log: list[dict], store: dict, batch_size: int = 10, crash_after: int | None = None) -> int:
    """Process log from store['offset'] in batches, dedupe by message id, commit after each batch; return count."""
    # TODO: read batch -> process each message (raise Crash when crash_after messages were handled) -> commit
    raise NotImplementedError
