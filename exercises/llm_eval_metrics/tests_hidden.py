"""Hidden validation suite for llm_eval_metrics."""
import copy
from functools import lru_cache

import numpy as np
import pytest

import submission as sub

rng = np.random.default_rng(7)
VOCAB = ["paris", "france", "tower", "red", "blue", "the", "a", "city", "river", "seine"]


def ref_lcs(a, b):
    @lru_cache(maxsize=None)
    def go(i, j):
        if i == len(a) or j == len(b):
            return 0
        if a[i] == b[j]:
            return 1 + go(i + 1, j + 1)
        return max(go(i + 1, j), go(i, j + 1))
    return go(0, 0)


def ref_f1(pred_tokens, gold_tokens):
    if not pred_tokens or not gold_tokens:
        return float(pred_tokens == gold_tokens)
    remaining = list(gold_tokens)
    overlap = 0
    for t in pred_tokens:
        if t in remaining:
            remaining.remove(t)
            overlap += 1
    if overlap == 0:
        return 0.0
    p, r = overlap / len(pred_tokens), overlap / len(gold_tokens)
    return 2 * p * r / (p + r)


GOLDEN = [
    {"id": "q1", "question": "Capital of France?", "answers": ["Paris"]},
    {"id": "q2", "question": "Which river runs through Paris?", "answers": ["the Seine", "Seine River"]},
    {"id": "q3", "question": "Tallest structure in Paris?", "answers": ["The Eiffel Tower"]},
    {"id": "q4", "question": "Who designed it?", "answers": ["Gustave Eiffel's company"]},
]
BASE = {"q1": "Paris.", "q2": "The river Seine", "q3": "Eiffel Tower", "q4": "Gustave Eiffel"}
CAND = {"q1": "Paris", "q2": "Seine in Paris", "q3": "the tower", "q4": "Gustave Eiffel's company"}


def test_normalize_answer():
    assert sub.normalize_answer("The  Eiffel Tower!") == "eiffel tower"
    assert sub.normalize_answer("An apple, a day.") == "apple day"
    assert sub.normalize_answer("  Theory of  THE  universe ") == "theory of universe"
    assert sub.normalize_answer("Anthem") == "anthem"
    assert sub.normalize_answer("...") == ""


def test_exact_match():
    assert sub.exact_match("the Seine.", "Seine") == 1.0
    assert sub.exact_match("A Seine", ["Loire", "seine"]) == 1.0
    assert sub.exact_match("Seine river", ["Seine"]) == 0.0
    assert isinstance(sub.exact_match("x", "x"), float)


def test_token_f1_counts_repeated_tokens_once_per_match():
    assert sub.token_f1("new york city", "New York") == pytest.approx(0.8)
    # multiset overlap: "x" appears twice in both, so it matches twice
    assert sub.token_f1("x y x", "x x z") == pytest.approx(2 / 3)
    assert sub.token_f1("seine seine seine", "seine") == pytest.approx(0.5)
    assert sub.token_f1("paris", ["london", "Paris, France"]) == pytest.approx(2 / 3)


def test_token_f1_matches_reference():
    for _ in range(200):
        pred = list(rng.choice(VOCAB, size=rng.integers(1, 8)))
        gold = list(rng.choice(VOCAB, size=rng.integers(1, 8)))
        p_text, g_text = " ".join(pred), " ".join(gold)
        expected = ref_f1(sub.normalize_answer(p_text).split(), sub.normalize_answer(g_text).split())
        assert sub.token_f1(p_text, g_text) == pytest.approx(expected, abs=1e-12)


def test_empty_answers_edge_cases():
    assert sub.token_f1("", "") == 1.0
    assert sub.token_f1("the", "") == 1.0  # both normalize to nothing
    assert sub.token_f1("", "Paris") == 0.0
    assert sub.token_f1("Paris", "") == 0.0
    assert sub.token_f1("tower", "river") == 0.0
    assert sub.exact_match("", "") == 1.0


def test_lcs_and_rouge_l_known_values():
    assert sub.lcs_length([], ["a"]) == 0
    assert sub.lcs_length(list("abcbdab"), list("bdcaba")) == 4
    assert sub.lcs_length(["x"], ["x"]) == 1
    r = sub.rouge_l("the cat sat on the mat", "the cat lay on the mat")
    assert r["precision"] == pytest.approx(5 / 6) and r["recall"] == pytest.approx(5 / 6)
    assert r["f"] == pytest.approx(5 / 6)
    r = sub.rouge_l("police killed the gunman", "the gunman police killed")
    assert r["f"] == pytest.approx(0.5)
    assert sub.rouge_l("", "anything") == {"precision": 0.0, "recall": 0.0, "f": 0.0}
    assert sub.rouge_l("Paris", "paris")["f"] == pytest.approx(1.0)


def test_rouge_l_matches_reference():
    for _ in range(100):
        a = list(rng.choice(VOCAB[:5], size=rng.integers(1, 10)))
        b = list(rng.choice(VOCAB[:5], size=rng.integers(1, 10)))
        assert sub.lcs_length(a, b) == ref_lcs(tuple(a), tuple(b))
        lcs = ref_lcs(tuple(a), tuple(b))
        got = sub.rouge_l(" ".join(a), " ".join(b))
        if lcs:
            p, r = lcs / len(a), lcs / len(b)
            assert got["precision"] == pytest.approx(p) and got["recall"] == pytest.approx(r)
            assert got["f"] == pytest.approx(2 * p * r / (p + r))
        else:
            assert got["f"] == 0.0


def test_bootstrap_ci_deterministic_and_correct():
    scores = rng.uniform(0, 1, 200)
    mean, low, high = sub.bootstrap_ci(scores, n_boot=500, alpha=0.1, seed=3)
    r = np.random.default_rng(3)
    idx = r.integers(0, scores.size, size=(500, scores.size))
    lo_ref, hi_ref = np.quantile(scores[idx].mean(axis=1), [0.05, 0.95])
    assert mean == pytest.approx(scores.mean()) and low == pytest.approx(lo_ref) and high == pytest.approx(hi_ref)
    assert low < mean < high
    assert sub.bootstrap_ci(scores, seed=11) == sub.bootstrap_ci(scores, seed=11)
    assert sub.bootstrap_ci([1.0, 1.0, 1.0]) == (1.0, 1.0, 1.0)
    with pytest.raises(ValueError):
        sub.bootstrap_ci([])


def test_evaluate_golden_set():
    golden0, base0 = copy.deepcopy(GOLDEN), dict(BASE)
    res = sub.evaluate(BASE, GOLDEN)
    assert set(res["per_example"]) == {"q1", "q2", "q3", "q4"}
    assert res["per_example"]["q1"] == {"em": 1.0, "f1": 1.0}
    assert res["per_example"]["q2"]["em"] == 0.0
    assert res["per_example"]["q2"]["f1"] == pytest.approx(1.0)  # "river seine" vs "seine river"
    assert res["per_example"]["q3"]["em"] == 1.0
    assert res["per_example"]["q4"]["f1"] == pytest.approx(0.4)  # 1 shared token: P=1/2, R=1/3
    assert res["exact_match"] == pytest.approx(0.5)
    assert res["f1"] == pytest.approx((1 + 1 + 1 + 0.4) / 4)
    missing = sub.evaluate({"q1": "Paris"}, GOLDEN)
    assert missing["per_example"]["q2"] == {"em": 0.0, "f1": 0.0}
    assert GOLDEN == golden0 and BASE == base0


def test_regression_check():
    report = sub.regression_check(BASE, CAND, GOLDEN, metric="f1")
    # q2: 1.0 -> 0.5, q3: 1.0 -> 2/3, q4: 0.4 -> 1.0
    assert report["regressions"] == ["q2", "q3"]
    assert report["improvements"] == ["q4"]
    assert report["delta"] == pytest.approx(((1 + 0.5 + 2 / 3 + 1) - (1 + 1 + 1 + 0.4)) / 4)
    assert report["passed"] is False
    assert sub.regression_check(BASE, CAND, GOLDEN, tolerance=0.2)["passed"] is True
    em = sub.regression_check(BASE, CAND, GOLDEN, metric="em")
    assert em["regressions"] == ["q3"] and em["improvements"] == ["q4"]
    assert em["delta"] == pytest.approx(0.0) and em["passed"] is True
    same = sub.regression_check(BASE, BASE, GOLDEN)
    assert same["delta"] == 0.0 and same["regressions"] == [] and same["passed"] is True
