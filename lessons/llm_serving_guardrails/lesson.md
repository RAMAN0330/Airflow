# Serving LLMs: Caching, Limits & Guardrails

A model endpoint is the easy part. In production, every LLM call is **slow** (seconds), **metered**
(you pay per input and output token), and **full of user text** that may include an email address or a
card number. Teams put a gateway in front of the model to handle all three. The OWASP Top 10 for LLM
Applications names the risks it addresses: *Sensitive Information Disclosure* (LLM02) and *Unbounded
Consumption* (LLM10). The NIST AI RMF asks you to manage these risks deliberately, not after an incident.

## Rate limiting with a token bucket

A token bucket holds up to `capacity` tokens and refills at `rate` tokens per second. Each request
spends tokens or is rejected (HTTP 429). AWS API Gateway throttles this way: the *rate* is the refill
speed and the *burst* is the bucket size.

```python
tokens = min(capacity, tokens + (now - last) * rate)    # refill, capped
if tokens >= cost: tokens -= cost; allow
```

The `min` is essential. Without it, a client that's idle for an hour banks 3,600 seconds of tokens and
can then flood the model. For LLMs, set `cost` to the request's estimated tokens rather than 1, so a
40k-token prompt costs more than a "hi". Pass in the **clock** (`clock=time.monotonic`), so tests can
move time forward instead of sleeping.

## Exact cache: normalized key + TTL + LRU

Identical requests, such as retries, popular FAQs or batch re-runs, shouldn't hit the model twice.

- **Key** = normalized prompt (collapse whitespace) + generation params serialized with sorted keys.
  The params belong in the key: the same prompt at `temperature=0.9` is a different request.
- **TTL**: answers go stale when prices, policies or documents change. Store a timestamp and treat
  `now − stored_at ≥ ttl` as a miss.
- **LRU**: memory is finite. `OrderedDict.move_to_end` on every hit, `popitem(last=False)` to evict.

## Semantic cache

"How do I reset my password?" and "password reset steps?" never collide in an exact cache. A semantic
cache, such as the open-source GPTCache, embeds each prompt and returns a stored answer when cosine
similarity exceeds a **threshold**. That threshold is a precision/recall knob. Set it too low and users
get an answer to a different question. Never cache across users for personalized prompts.

## PII redaction that doesn't over-redact

Regexes find candidates, and validation keeps false positives down. A 16-digit order number looks like a
card number, but real card numbers satisfy the **Luhn** checksum: from the right, double every second
digit (subtract 9 if the result is over 9), and the sum must be divisible by 10.

```
4111 1111 1111 1111  → Luhn OK  → [CREDIT_CARD]
4111 1111 1111 1112  → fails    → left alone (probably an ID)
```

Run redaction **before** logging and before forwarding text to a third-party model.

## Fitting the context window

When a conversation outgrows the budget, drop the **oldest** turns, but always keep the **system
prompt**. It holds the instructions and guardrails, and losing it silently changes the bot's behavior.
Walk backwards from the newest message and stop at the first one that doesn't fit, so the kept history
has no gaps.

## Cost accounting

Providers price input and output tokens separately, per million tokens. Record both for every call and
sum by model. That's how you notice that a prompt change tripled the bill.

In the exercise you'll build each piece: the token bucket, the TTL+LRU cache, the semantic cache, Luhn-
checked redaction, history truncation, and the cost report.
