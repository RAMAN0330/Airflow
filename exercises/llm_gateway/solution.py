"""An LLM gateway in miniature: rate limiting, exact and semantic caching, PII redaction, context truncation and cost."""
import json
import re
import time
from collections import OrderedDict

import numpy as np

# Use these patterns as given (see task.md).
EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
CARD_RE = re.compile(r"\b(?:\d[ -]?){12,18}\d\b")
PHONE_RE = re.compile(r"(?<!\w)(?:\+\d{1,2}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]\d{4}(?!\w)")


class TokenBucket:
    """Allow bursts up to `capacity`; refill at `refill_rate` tokens per second."""

    def __init__(self, capacity: float, refill_rate: float, clock=time.monotonic):
        if capacity <= 0 or refill_rate < 0:
            raise ValueError("capacity must be > 0 and refill_rate >= 0")
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.clock = clock
        self.tokens = float(capacity)
        self.last = clock()

    def _refill(self):
        now = self.clock()
        self.tokens = min(self.capacity, self.tokens + (now - self.last) * self.refill_rate)
        self.last = now

    def available(self) -> float:
        """Tokens available right now."""
        self._refill()
        return self.tokens

    def allow(self, cost: float = 1.0) -> bool:
        """Spend `cost` tokens if available; return whether the request may proceed."""
        self._refill()
        if self.tokens >= cost:
            self.tokens -= cost
            return True
        return False


class ResponseCache:
    """Exact-match LRU cache with a time-to-live, keyed by normalized prompt + generation params."""

    def __init__(self, max_entries: int, ttl_seconds: float, clock=time.monotonic):
        self.max_entries = max_entries
        self.ttl = ttl_seconds
        self.clock = clock
        self._data = OrderedDict()
        self.hits = 0
        self.misses = 0

    @staticmethod
    def make_key(prompt: str, params: dict) -> str:
        """Collapse whitespace in the prompt; serialize params with sorted keys."""
        return " ".join(prompt.split()) + "\x00" + json.dumps(params or {}, sort_keys=True)

    def get(self, prompt: str, params: dict):
        """Cached response, or None on a miss or an expired entry."""
        key = self.make_key(prompt, params)
        entry = self._data.get(key)
        if entry is not None and self.clock() - entry[1] >= self.ttl:
            del self._data[key]
            entry = None
        if entry is None:
            self.misses += 1
            return None
        self._data.move_to_end(key)
        self.hits += 1
        return entry[0]

    def put(self, prompt: str, params: dict, response) -> None:
        """Store a response; evict the least recently used entry when over capacity."""
        key = self.make_key(prompt, params)
        self._data[key] = (response, self.clock())
        self._data.move_to_end(key)
        while len(self._data) > self.max_entries:
            self._data.popitem(last=False)

    def __len__(self):
        return len(self._data)


class SemanticCache:
    """Return a stored response when a new prompt's embedding is close enough to a cached one."""

    def __init__(self, threshold: float = 0.9):
        self.threshold = threshold
        self._vectors = []
        self._responses = []

    def add(self, embedding, response) -> None:
        self._vectors.append(np.array(embedding, dtype=float))
        self._responses.append(response)

    def lookup(self, embedding):
        """(response, similarity) of the most similar entry if similarity >= threshold, else None."""
        if not self._vectors:
            return None
        q = np.asarray(embedding, dtype=float)
        m = np.vstack(self._vectors)
        norms = np.linalg.norm(m, axis=1) * np.linalg.norm(q)
        sims = np.divide(m @ q, norms, out=np.zeros(len(m)), where=norms > 0)
        best = int(np.argmax(sims))
        if sims[best] >= self.threshold:
            return self._responses[best], float(sims[best])
        return None


def luhn_valid(number: str) -> bool:
    """Luhn checksum over the digits of `number` (spaces and dashes ignored); 13-19 digits."""
    digits = [int(c) for c in number if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19 or len(digits) != len(re.sub(r"[ -]", "", number)):
        return False
    total = 0
    for i, d in enumerate(reversed(digits)):
        if i % 2 == 1:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


def redact_pii(text: str) -> tuple:
    """Replace emails, Luhn-valid card numbers and phone numbers; return (text, counts)."""
    counts = {"EMAIL": 0, "CREDIT_CARD": 0, "PHONE": 0}

    def sub(label, valid=lambda s: True):
        def repl(m):
            if not valid(m.group()):
                return m.group()
            counts[label] += 1
            return f"[{label}]"
        return repl

    text = EMAIL_RE.sub(sub("EMAIL"), text)
    text = CARD_RE.sub(sub("CREDIT_CARD", luhn_valid), text)
    text = PHONE_RE.sub(sub("PHONE"), text)
    return text, counts


def _word_count(text: str) -> int:
    return len(text.split())


def truncate_history(messages: list, max_tokens: int, count_tokens=_word_count) -> list:
    """Keep every system message plus the most recent turns that fit in max_tokens, in original order."""
    system = [i for i, m in enumerate(messages) if m["role"] == "system"]
    budget = max_tokens - sum(count_tokens(messages[i]["content"]) for i in system)
    if budget < 0:
        raise ValueError("system prompt alone exceeds the token budget")
    keep = set(system)
    for i in range(len(messages) - 1, -1, -1):
        if i in keep:
            continue
        cost = count_tokens(messages[i]["content"])
        if cost > budget:
            break
        budget -= cost
        keep.add(i)
    return [dict(messages[i]) for i in sorted(keep)]


def cost_report(usage: list, prices: dict) -> dict:
    """Dollar cost of calls; prices are per million input/output tokens per model."""
    by_model = {}
    for call in usage:
        model = call["model"]
        if model not in prices:
            raise KeyError(f"no price for model {model!r}")
        p = prices[model]
        dollars = (call["input_tokens"] * p["input"] + call["output_tokens"] * p["output"]) / 1_000_000
        by_model[model] = by_model.get(model, 0.0) + dollars
    return {"total": sum(by_model.values()), "by_model": by_model}
