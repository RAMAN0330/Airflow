# Feature Stores & Point-in-Time Correctness

Uber's Michelangelo platform popularized the **feature store**: a shared catalog of features (say
`avg_spend_7d` or `n_chargebacks_30d`) that teams compute once and reuse, served **offline** for building
training data and **online** for low-latency predictions. Using the same definitions in both places is
what prevents training/serving skew.

The hardest part of the offline side is subtle: getting the **time** right.

## Leakage: when training sees the future

You're predicting whether a transaction is fraudulent. For each labeled transaction you attach the user's
features. If you attach the **latest** values in the table, a transaction from March can receive a
chargeback count computed in May, *after* the fraud was discovered. The model learns "high chargebacks →
fraud", scores brilliantly offline, and fails in production, where May hasn't happened yet.

Kaufman et al. call this **leakage**: information in the training data about the target that wouldn't
legitimately be available at prediction time. It's one of the most common reasons offline metrics don't
hold up.

## The point-in-time join

For each label event `(entity, event_ts)`, attach the feature row for the same entity with the
**largest `feature_ts ≤ event_ts`**, the newest value that already existed. Feast describes it as
scanning backwards in time from each event's timestamp, up to a maximum age (TTL).

| event_ts | feature rows (ts → value) | correct match |
|---|---|---|
| 250 | 100 → 10, 200 → 20, 300 → 30 | **200 → 20** |
| 300 | same | **300 → 30** (equal timestamps were known) |
| 50 | same | **none**, because nothing existed yet |

### Staleness: TTL

A value from six months ago probably shouldn't stand in for "current spend". With a **TTL**, a match where
`event_ts − feature_ts > ttl` is treated as missing. Missing is honest. Stale data dressed up as current
is not.

## Doing it at scale

The naive approach compares every label with every feature row: **O(n·m)**. That's 4.8 billion
comparisons for 40k labels × 120k features. Instead:

1. **Group** feature rows by entity.
2. **Sort** each group by timestamp, once.
3. For each label, **binary-search** its entity's timestamps with `bisect_right(stamps, event_ts) − 1`.

That's **O((n + m) log m)**, which turns minutes into milliseconds. Data warehouses offer the same thing as
an *as-of join* (`ASOF JOIN`, or `pandas.merge_asof`).

## Trust, but verify

When you inherit a training set, audit it: **any row with `feature_ts > event_ts` is leakage.** A
one-line check catches what a week of model debugging might not.
