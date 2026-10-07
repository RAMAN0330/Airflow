# Evaluating LLM Outputs: Golden Sets, EM, F1 & ROUGE-L

You changed the prompt, swapped the model, or re-indexed the retriever. Is the answer quality better or
worse? Trying five prompts by hand only tells you about those five. LLMOps replaces that with the same
discipline as any ML system: a **fixed evaluation set**, **automatic metrics**, and a **comparison
against the current production run** before anything ships. HELM makes the same point at benchmark
scale: be explicit about which scenarios and which metrics you measure.

## The golden set

A golden set is a versioned file of inputs with trusted reference answers:

```json
{"id": "q17", "question": "Which river runs through Paris?", "answers": ["the Seine", "Seine River"]}
```

- **Representative**: sample from real traffic, including the hard and embarrassing cases.
- **Several references** when there are several acceptable phrasings. Score against each, keep the max.
- **Frozen and versioned**: if the set changes between runs, the scores aren't comparable.

## Normalize first

`"The Seine."` and `"seine"` are the same answer. The SQuAD evaluation script normalizes both sides
before comparing: lowercase, remove punctuation, remove the articles *a/an/the*, collapse whitespace.
Use word boundaries (`\b(a|an|the)\b`) so *Anthem* and *Theory* survive.

## Exact match and token F1

**EM** is 1 if the normalized strings are identical. It's strict: `"Seine River"` vs `"the Seine"` scores 0.

**Token F1** gives partial credit. Treat each answer as a bag of tokens:

```python
common    = Counter(pred) & Counter(gold)        # multiset intersection
overlap   = sum(common.values())
precision = overlap / len(pred);  recall = overlap / len(gold)
f1        = 2 * precision * recall / (precision + recall)
```

It has to be a **multiset**. With `set()`, "x y x" vs "x x z" counts one shared token instead of two.
SQuAD 2.0 adds one more convention: if either side is empty ("no answer"), F1 is 1 only when both are.

## ROUGE-L for longer answers

For summaries and explanations, word order matters. Lin's ROUGE-L uses the **longest common
subsequence** (LCS): tokens that appear in both texts in the same order, gaps allowed.

```
LCS("the cat sat on the mat", "the cat lay on the mat") = 5   →  P = R = F = 5/6
```

The classic dynamic program fills an `(m+1) × (n+1)` table where `T[i][j]` is the LCS of the first `i`
and `j` tokens. Row and column 0 are the empty prefixes. Loop `i` over `1..m` and `j` over `1..n`
**inclusive**, or the last token is never compared. Then `P = LCS/len(candidate)`, `R = LCS/len(reference)`.

## Put an error bar on it

Averages over a few hundred examples are noisy. A 1-point gain can easily be luck. Efron's **bootstrap**
estimates that noise by resampling the examples with replacement:

```python
idx   = rng.integers(0, n, size=(n_boot, n))
means = scores[idx].mean(axis=1)
low, high = np.quantile(means, [0.025, 0.975])
```

Fix the seed so the CI is reproducible in CI logs. Dror et al. found that significance testing is
often skipped or misused in NLP papers. Don't repeat that in production.

## Diff the runs, not just the means

A regression check scores baseline and candidate on the **same** golden set and reports:

- `delta`: candidate mean − baseline mean, gated against a tolerance
- per-example **regressions** and **improvements**, largest change first

A flat average can hide a new model that fixes 10 easy questions and breaks 10 critical ones. The
per-example diff is what you actually read in code review.

## Limits

Reference metrics only reward overlap with the references. A correct answer phrased differently scores
low, and fluent nonsense that reuses the reference's words scores high. Open-ended chat needs judgment
too, and that's the next lesson: LLM-as-a-judge.

In the exercise you'll implement normalization, EM, F1, ROUGE-L, the bootstrap CI and the regression
check.
