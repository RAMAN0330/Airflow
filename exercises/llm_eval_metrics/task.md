# Evaluate LLM Answers Against a Golden Set

You swapped the model behind your support-bot's question answering. Did it get better? "It looks fine on
five prompts" isn't an answer. You have a **golden set**: questions with human-written reference
answers. Score both runs the way SQuAD does, put an error bar on the score, and list exactly which
examples regressed.

## 1. `normalize_answer(text)`

The official SQuAD script normalizes before comparing, so `"The Eiffel Tower."` matches `"eiffel tower"`:

1. lowercase
2. remove every character in `string.punctuation`
3. remove the articles `a`, `an`, `the` as whole words (`re.sub(r"\b(a|an|the)\b", " ", text)`)
4. collapse whitespace: `" ".join(text.split())`

## 2. `exact_match(prediction, ground_truths)` and `token_f1(prediction, ground_truths)`

`ground_truths` is one string or a list of acceptable answers. Score against each and return the **max**.

- **EM**: `1.0` if the normalized strings are equal, else `0.0`.
- **Token F1**: split the normalized strings on whitespace. Overlap is the **multiset** intersection
  (`Counter(pred) & Counter(gold)`), so a repeated word only counts as often as it appears in both.
  `precision = overlap / len(pred)`, `recall = overlap / len(gold)`, `F1 = 2PR / (P + R)`, and 0 when
  there's no overlap.
- If either side normalizes to **no tokens**, F1 is `1.0` when both are empty and `0.0` otherwise
  (that's how SQuAD 2.0 scores "no answer").

## 3. `lcs_length(a, b)` and `rouge_l(candidate, reference)`

ROUGE-L scores longer, free-form answers by their **longest common subsequence**: words in the same
order, not necessarily adjacent. Fill the classic `(m+1) × (n+1)` dynamic-programming table.

`rouge_l` tokenizes with `re.findall(r"\w+", text.lower())` (no article removal) and returns
`{"precision": lcs/len(cand), "recall": lcs/len(ref), "f": 2PR/(P+R)}`. All three are `0.0` when the
LCS is 0 (including empty inputs).

## 4. `bootstrap_ci(scores, n_boot=1000, alpha=0.05, seed=0)`

Percentile bootstrap for the mean, done exactly like this so results are reproducible:

```python
rng = np.random.default_rng(seed)
idx = rng.integers(0, n, size=(n_boot, n))       # one resample per row
means = scores[idx].mean(axis=1)
low, high = np.quantile(means, [alpha / 2, 1 - alpha / 2])
```

Return `(mean, low, high)` as Python floats. Empty `scores` raises `ValueError`.

## 5. `evaluate(predictions, golden)`

`golden` is a list of `{"id": str, "question": str, "answers": [str, ...]}`. `predictions` maps id to the
model's answer. A missing prediction is scored as `""`. Return:

```python
{"exact_match": mean EM, "f1": mean F1,
 "per_example": {id: {"em": float, "f1": float}, ...}}
```

## 6. `regression_check(baseline, candidate, golden, metric="f1", tolerance=0.0)`

`metric` is `"em"` or `"f1"`. Evaluate both runs and return:

- `"delta"`: candidate mean minus baseline mean for that metric
- `"regressions"`: ids whose per-example score **dropped**, largest drop first (ties by id)
- `"improvements"`: ids whose score **rose**, largest gain first (ties by id)
- `"passed"`: `delta >= -tolerance`

Never modify the inputs.

## Example

```python
>>> normalize_answer("The  Eiffel Tower!")
'eiffel tower'
>>> token_f1("new york city", "New York")
0.8
>>> rouge_l("the cat sat on the mat", "the cat lay on the mat")["f"]
0.8333333333333334
```
