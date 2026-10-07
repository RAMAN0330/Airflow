# Build an LLM Gateway: Limits, Caches & Guardrails

Every request to your hosted model costs money and latency, and every prompt might contain a customer's
email or card number. Teams put a **gateway** in front of the model to handle that. You'll build its core
pieces. There's no real model here: everything is deterministic, and every time-dependent class takes
an injectable `clock` (a zero-argument callable returning seconds) so tests can control time.

## 1. `TokenBucket(capacity, refill_rate, clock=time.monotonic)`

The bucket starts **full** with `capacity` tokens and refills at `refill_rate` tokens per second.

- `allow(cost=1.0)`: first refill (`tokens = min(capacity, tokens + elapsed × refill_rate)`), then if
  `tokens >= cost` spend them and return `True`; otherwise return `False` and spend nothing.
- `available()`: refill, then return the current token count.
- `capacity <= 0` or `refill_rate < 0` raises `ValueError`.

The `min` matters: without it an hour of idle time banks thousands of tokens and the next burst
overwhelms the model.

## 2. `ResponseCache(max_entries, ttl_seconds, clock=time.monotonic)`

An exact-match cache for repeated requests.

- `make_key(prompt, params)` (static): `" ".join(prompt.split())` plus `json.dumps(params, sort_keys=True)`.
  Whitespace differences and dict ordering don't matter. Case and parameter values do
  (`temperature=0.7` is a different request).
- `get(prompt, params)`: return the cached response and mark it most recently used. Return `None` on a
  miss. An entry is **expired** once `now − stored_at >= ttl_seconds`: delete it and treat it as a miss.
- `put(prompt, params, response)`: store with the current time (overwriting refreshes it), then evict
  least-recently-used entries while there are more than `max_entries`.
- Track `hits` and `misses` attributes, and support `len(cache)`.

## 3. `SemanticCache(threshold=0.9)`

Users rarely repeat a prompt byte for byte. A semantic cache compares **embeddings** instead.
`add(embedding, response)` stores a vector. `lookup(embedding)` computes cosine similarity against every
stored vector (0 when either vector has zero norm) and returns `(response, similarity)` for the best
match if `similarity >= threshold`, else `None`. Ties go to the earliest entry.

## 4. `luhn_valid(number)` and `redact_pii(text)`

`luhn_valid`: the string may contain only digits, spaces and dashes, and must have 13–19 digits. From the
rightmost digit, double every second digit (subtract 9 if the result exceeds 9), sum everything, and the
number is valid when `sum % 10 == 0`.

`redact_pii` uses the three regexes given in `starter.py`, in this order:

1. `EMAIL_RE` → `[EMAIL]`
2. `CARD_RE` → `[CREDIT_CARD]`, **only if `luhn_valid`**. Order and tracking numbers are left alone.
3. `PHONE_RE` → `[PHONE]`

Return `(redacted_text, {"EMAIL": n, "CREDIT_CARD": n, "PHONE": n})`.

## 5. `truncate_history(messages, max_tokens, count_tokens=<word count>)`

`messages` is a chat history of `{"role", "content"}` dicts. When it exceeds the context budget:

- **Always keep every `system` message.** It holds the instructions and guardrails. If the system
  messages alone exceed `max_tokens`, raise `ValueError`.
- Walk backwards from the newest message, keeping each one while it fits the remaining budget. Stop at
  the first one that doesn't fit, so older turns are never kept once a newer one has been dropped.
- Return the kept messages in their **original order**, without modifying the input.

## 6. `cost_report(usage, prices)`

`usage` is a list of `{"model", "input_tokens", "output_tokens"}`. `prices[model]` is
`{"input": $, "output": $}` **per million tokens**. Return `{"total": float, "by_model": {model: float}}`.
An unknown model raises `KeyError`.

## Example

```python
>>> redact_pii("card 4111 1111 1111 1111, order 4111 1111 1111 1112")
('card [CREDIT_CARD], order 4111 1111 1111 1112', {'EMAIL': 0, 'CREDIT_CARD': 1, 'PHONE': 0})
```
