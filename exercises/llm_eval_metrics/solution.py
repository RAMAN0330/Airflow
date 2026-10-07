"""Reference-based LLM evaluation: SQuAD-style EM/F1, ROUGE-L, bootstrap CIs and golden-set regression checks."""
import re
import string
from collections import Counter

import numpy as np

_PUNCT = set(string.punctuation)


def normalize_answer(text: str) -> str:
    """Lowercase, drop punctuation, drop the articles a/an/the, collapse whitespace."""
    text = text.lower()
    text = "".join(ch for ch in text if ch not in _PUNCT)
    text = re.sub(r"\b(a|an|the)\b", " ", text)
    return " ".join(text.split())


def _refs(ground_truths):
    return [ground_truths] if isinstance(ground_truths, str) else list(ground_truths)


def exact_match(prediction: str, ground_truths) -> float:
    """1.0 if the normalized prediction equals any normalized reference, else 0.0."""
    pred = normalize_answer(prediction)
    return float(max(pred == normalize_answer(g) for g in _refs(ground_truths)))


def _f1(pred_tokens, gold_tokens):
    if not pred_tokens or not gold_tokens:
        return float(pred_tokens == gold_tokens)
    common = sum((Counter(pred_tokens) & Counter(gold_tokens)).values())
    if common == 0:
        return 0.0
    precision = common / len(pred_tokens)
    recall = common / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)


def token_f1(prediction: str, ground_truths) -> float:
    """Best token-level F1 (multiset overlap) between the prediction and any reference."""
    pred = normalize_answer(prediction).split()
    return max(_f1(pred, normalize_answer(g).split()) for g in _refs(ground_truths))


def lcs_length(a: list, b: list) -> int:
    """Length of the longest common subsequence of two token lists."""
    m, n = len(a), len(b)
    table = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if a[i - 1] == b[j - 1]:
                table[i][j] = table[i - 1][j - 1] + 1
            else:
                table[i][j] = max(table[i - 1][j], table[i][j - 1])
    return table[m][n]


def rouge_l(candidate: str, reference: str) -> dict:
    """ROUGE-L precision, recall and F1 over lowercase word tokens."""
    cand = re.findall(r"\w+", candidate.lower())
    ref = re.findall(r"\w+", reference.lower())
    lcs = lcs_length(cand, ref)
    if lcs == 0:
        return {"precision": 0.0, "recall": 0.0, "f": 0.0}
    precision = lcs / len(cand)
    recall = lcs / len(ref)
    return {"precision": precision, "recall": recall, "f": 2 * precision * recall / (precision + recall)}


def bootstrap_ci(scores, n_boot: int = 1000, alpha: float = 0.05, seed: int = 0) -> tuple:
    """(mean, low, high): percentile bootstrap confidence interval for the mean score."""
    s = np.asarray(scores, dtype=float)
    if s.size == 0:
        raise ValueError("need at least one score")
    rng = np.random.default_rng(seed)
    idx = rng.integers(0, s.size, size=(n_boot, s.size))
    means = s[idx].mean(axis=1)
    low, high = np.quantile(means, [alpha / 2, 1 - alpha / 2])
    return float(s.mean()), float(low), float(high)


def evaluate(predictions: dict, golden: list) -> dict:
    """Score predictions {id: text} against golden [{'id', 'answers'}]. Missing predictions score as ''."""
    per_example = {}
    for item in golden:
        pred = predictions.get(item["id"], "")
        per_example[item["id"]] = {
            "em": exact_match(pred, item["answers"]),
            "f1": token_f1(pred, item["answers"]),
        }
    n = len(per_example)
    return {
        "exact_match": sum(r["em"] for r in per_example.values()) / n,
        "f1": sum(r["f1"] for r in per_example.values()) / n,
        "per_example": per_example,
    }


def regression_check(baseline: dict, candidate: dict, golden: list, metric: str = "f1", tolerance: float = 0.0) -> dict:
    """Compare two runs on the same golden set, per example and overall."""
    base = evaluate(baseline, golden)
    cand = evaluate(candidate, golden)
    key = "exact_match" if metric == "em" else "f1"
    diffs = {i: cand["per_example"][i][metric] - base["per_example"][i][metric] for i in base["per_example"]}
    delta = cand[key] - base[key]
    return {
        "delta": delta,
        "regressions": sorted((i for i, d in diffs.items() if d < 0), key=lambda i: (diffs[i], i)),
        "improvements": sorted((i for i, d in diffs.items() if d > 0), key=lambda i: (-diffs[i], i)),
        "passed": delta >= -tolerance,
    }
