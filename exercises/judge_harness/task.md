# Build an LLM-as-a-Judge Harness

Your team compares two chatbot versions by asking a strong LLM "which answer is better, A or B?". The
numbers look great for whichever model you happen to list first. That's **position bias**, a known
failure of LLM judges. Build the harness that corrects for it, turns verdicts into rankings, and
measures whether the judge agrees with humans at all.

No real LLM is called here. A **judge** is any callable:

```python
judge(question, first_answer, second_answer) -> "A" | "B" | "tie"   # "A" = the answer shown first
```

## 1. `judge_pair(judge, question, answer_a, answer_b)`

Call the judge **twice**: `judge(q, a, b)` and `judge(q, b, a)`. Translate both verdicts into
`"a"`, `"b"` or `"tie"` (in the second call, `"A"` means **b** won). Return the winner only if both
orders agree; otherwise return `"tie"`. A judge that always says `"A"` therefore produces only ties.

## 2. `pairwise_eval(judge, questions, answers_a, answers_b)` and `win_rate(outcomes)`

`pairwise_eval` runs `judge_pair` on each question in order and returns the list of outcomes. Raise
`ValueError` if the three lists differ in length.

`win_rate` is model a's score: `(wins + 0.5 × ties) / n`. An empty list raises `ValueError`.

## 3. `elo_ratings(matches, k=32.0, initial=1000.0)`

`matches` is a list of `(x, y, winner)` where `winner` is `x`, `y` or `"tie"`. Process them **in order**.
A player's rating starts at `initial` the first time it appears.

```
E_x = 1 / (1 + 10 ** ((R_y − R_x) / 400))        S_x = 1, 0.5 or 0
R_x ← R_x + k·(S_x − E_x)      R_y ← R_y + k·((1 − S_x) − (1 − E_x))
```

Both updates use the ratings from *before* the match. Return `{player: rating}`.

## 4. `bradley_terry(matches, max_iter=1000, tol=1e-10)`

Elo depends on match order. Bradley–Terry fits one strength `p_i > 0` per player, with
`P(i beats j) = p_i / (p_i + p_j)`, to all matches at once. Use Hunter's MM algorithm:

- `W_i` = wins of player i, where a tie gives 0.5 to each side. `n_ij` = games between i and j.
- Start at `p_i = 1/n`, then repeat: `p_i ← W_i / Σ_j n_ij / (p_i + p_j)`, normalize `p` to sum to 1.
- Stop after `max_iter` sweeps, or when the largest change in `p` is below `tol`.

Return `{player: strength}` as floats summing to 1.

## 5. `cohens_kappa(labels_a, labels_b)`

Before trusting the judge, check it against human labels on the same items. Raw agreement `p_o` is
misleading: two raters who both say "a" 90% of the time agree 82% of the time **by chance**. Cohen's
kappa corrects for that:

```
p_o = fraction of items where the labels match
p_e = Σ_label  P_a(label) · P_b(label)
κ   = (p_o − p_e) / (1 − p_e)        (return 1.0 when p_e == 1)
```

Raise `ValueError` for empty or unequal-length inputs.

## Example

```python
>>> judge_pair(lambda q, x, y: "A", "q", "first", "second")
'tie'
>>> elo_ratings([("m1", "m2", "m1")])
{'m1': 1016.0, 'm2': 984.0}
>>> bradley_terry([("a", "b", "a")] * 3 + [("a", "b", "b")])   # ≈ {'a': 0.75, 'b': 0.25}
```
