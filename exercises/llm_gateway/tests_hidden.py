"""Hidden validation suite for llm_gateway."""
import copy

import numpy as np
import pytest

import submission as sub


class FakeClock:
    def __init__(self, t=0.0):
        self.t = t

    def __call__(self):
        return self.t

    def advance(self, dt):
        self.t += dt


def test_token_bucket_burst_and_refill():
    clock = FakeClock(100.0)
    bucket = sub.TokenBucket(capacity=3, refill_rate=1.0, clock=clock)
    assert [bucket.allow() for _ in range(4)] == [True, True, True, False]
    clock.advance(0.5)
    assert bucket.allow() is False
    clock.advance(0.5)
    assert bucket.allow() is True
    clock.advance(2.0)
    assert bucket.allow(cost=2) is True
    assert bucket.available() == pytest.approx(0.0)
    assert bucket.allow(cost=0.5) is False


def test_token_bucket_never_exceeds_capacity():
    clock = FakeClock()
    bucket = sub.TokenBucket(capacity=5, refill_rate=2.0, clock=clock)
    clock.advance(3600)
    assert bucket.available() == pytest.approx(5.0)
    assert sum(bucket.allow() for _ in range(20)) == 5   # an idle hour still allows only one burst
    clock.advance(1.0)
    assert bucket.available() == pytest.approx(2.0)
    assert bucket.allow(cost=6) is False
    with pytest.raises(ValueError):
        sub.TokenBucket(capacity=0, refill_rate=1.0, clock=clock)


def test_response_cache_key_normalization():
    clock = FakeClock()
    cache = sub.ResponseCache(max_entries=10, ttl_seconds=60, clock=clock)
    cache.put("What is  MLOps?\n", {"temperature": 0, "model": "m"}, "answer-1")
    assert cache.get("  What is MLOps? ", {"model": "m", "temperature": 0}) == "answer-1"
    assert cache.get("What is MLOps?", {"model": "m", "temperature": 0.7}) is None   # params are part of the key
    assert cache.get("what is mlops?", {"model": "m", "temperature": 0}) is None       # case is kept
    assert (cache.hits, cache.misses) == (1, 2)


def test_response_cache_lru_eviction():
    clock = FakeClock()
    cache = sub.ResponseCache(max_entries=2, ttl_seconds=1000, clock=clock)
    cache.put("a", {}, 1)
    cache.put("b", {}, 2)
    assert cache.get("a", {}) == 1          # a is now most recently used
    cache.put("c", {}, 3)                   # evicts b
    assert len(cache) == 2
    assert cache.get("b", {}) is None
    assert cache.get("a", {}) == 1 and cache.get("c", {}) == 3
    cache.put("a", {}, 10)                  # overwrite refreshes, no growth
    assert len(cache) == 2 and cache.get("a", {}) == 10


def test_response_cache_ttl_expiry():
    clock = FakeClock(50.0)
    cache = sub.ResponseCache(max_entries=10, ttl_seconds=30, clock=clock)
    cache.put("q", {"t": 0}, "fresh")
    clock.advance(29.9)
    assert cache.get("q", {"t": 0}) == "fresh"
    clock.advance(0.1)                       # exactly ttl seconds old: expired
    assert cache.get("q", {"t": 0}) is None
    assert len(cache) == 0
    cache.put("q", {"t": 0}, "again")
    clock.advance(10)
    assert cache.get("q", {"t": 0}) == "again"
    assert cache.misses == 1 and cache.hits == 2


def test_semantic_cache_threshold():
    cache = sub.SemanticCache(threshold=0.9)
    assert cache.lookup([1.0, 0.0]) is None
    cache.add([1.0, 0.0, 0.0], "refund policy")
    cache.add([0.0, 1.0, 0.0], "shipping times")
    hit = cache.lookup([2.0, 0.2, 0.0])                  # same direction, different length
    assert hit[0] == "refund policy"
    assert hit[1] == pytest.approx(2.0 / np.hypot(2.0, 0.2))
    assert cache.lookup([1.0, 1.0, 0.0]) is None          # cos = 0.707 < 0.9
    assert cache.lookup([0.0, 0.0, 0.0]) is None          # zero vector never matches
    exact = sub.SemanticCache(threshold=1.0)
    exact.add([3.0, 4.0], "x")
    assert exact.lookup([3.0, 4.0])[0] == "x"
    rng = np.random.default_rng(0)
    vecs = rng.normal(size=(50, 16))
    big = sub.SemanticCache(threshold=-1.0)
    for i, v in enumerate(vecs):
        big.add(v, i)
    q = rng.normal(size=16)
    sims = vecs @ q / (np.linalg.norm(vecs, axis=1) * np.linalg.norm(q))
    assert big.lookup(q) == (int(np.argmax(sims)), pytest.approx(sims.max()))


def test_luhn_valid():
    for good in ["4111111111111111", "4111 1111 1111 1111", "5555-5555-5555-4444", "378282246310005",
                 "6011111111111117"]:
        assert sub.luhn_valid(good) is True, good
    for bad in ["4111111111111112", "1234567890123", "79927398713", "4111a111111111111", ""]:
        assert sub.luhn_valid(bad) is False, bad


def test_redact_pii():
    text = ("Contact jane.doe+billing@example.co.uk or (555) 123-4567. Card: 4111 1111 1111 1111. "
            "Order #4111 1111 1111 1112 shipped. Backup line +1 555-987-6543, ticket 2024.")
    out, counts = sub.redact_pii(text)
    assert out == ("Contact [EMAIL] or [PHONE]. Card: [CREDIT_CARD]. "
                   "Order #4111 1111 1111 1112 shipped. Backup line [PHONE], ticket 2024.")
    assert counts == {"EMAIL": 1, "CREDIT_CARD": 1, "PHONE": 2}
    out, counts = sub.redact_pii("Tracking 1234567812345678 and 5555555555554444")
    assert out == "Tracking 1234567812345678 and [CREDIT_CARD]"
    assert counts["CREDIT_CARD"] == 1
    assert sub.redact_pii("nothing here") == ("nothing here", {"EMAIL": 0, "CREDIT_CARD": 0, "PHONE": 0})


def test_truncate_history_keeps_system_and_recent():
    history = [
        {"role": "system", "content": "you are a helpful support bot"},          # 6 words
        {"role": "user", "content": "hi there"},                                # 2
        {"role": "assistant", "content": "hello how can i help"},               # 5
        {"role": "user", "content": "my order never arrived please check"},     # 6
        {"role": "assistant", "content": "sorry about that"},                   # 3
        {"role": "user", "content": "order 42"},                                # 2
    ]
    original = copy.deepcopy(history)
    out = sub.truncate_history(history, max_tokens=12)
    assert out == [history[0], history[4], history[5]]
    assert sub.truncate_history(history, max_tokens=17) == [history[0], history[3], history[4], history[5]]
    assert sub.truncate_history(history, max_tokens=100) == history
    assert sub.truncate_history(history, max_tokens=7) == [history[0]]
    # the newest turn that doesn't fit stops truncation: no skipping ahead to older, shorter turns
    assert sub.truncate_history(history, max_tokens=15) == [history[0], history[4], history[5]]
    assert sub.truncate_history(history, max_tokens=40, count_tokens=len) == [history[0], history[5]]
    with pytest.raises(ValueError):
        sub.truncate_history(history, max_tokens=5)
    assert history == original


def test_cost_report():
    prices = {"small": {"input": 0.25, "output": 1.25}, "large": {"input": 3.0, "output": 15.0}}
    usage = [
        {"model": "small", "input_tokens": 1_000_000, "output_tokens": 200_000},
        {"model": "large", "input_tokens": 2_000, "output_tokens": 1_000},
        {"model": "small", "input_tokens": 400_000, "output_tokens": 0},
    ]
    report = sub.cost_report(usage, prices)
    assert report["by_model"]["small"] == pytest.approx(0.25 + 0.25 + 0.1)
    assert report["by_model"]["large"] == pytest.approx(0.006 + 0.015)
    assert report["total"] == pytest.approx(0.6 + 0.021)
    assert sub.cost_report([], prices) == {"total": 0.0, "by_model": {}}
    with pytest.raises(KeyError):
        sub.cost_report([{"model": "mystery", "input_tokens": 1, "output_tokens": 1}], prices)
