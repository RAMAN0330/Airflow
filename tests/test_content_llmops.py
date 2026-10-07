"""Bug-injection checks for the llmops content group: each realistic bug must be caught by a specific hidden test."""
import ast
import json
from pathlib import Path

import pytest

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
EXERCISES = ["llm_eval_metrics", "judge_harness", "llm_gateway"]


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(exercise, old, new):
    src = (EX / exercise / "solution.py").read_text()
    buggy = src.replace(old, new)
    assert buggy != src, f"mutation {old!r} did not apply"
    return buggy


def _assert_caught(exercise, old, new, test_name):
    r, failed = _failed(_mutate(exercise, old, new), EX / exercise)
    assert r["status"] == "failed"
    assert test_name in failed


@pytest.mark.parametrize("exercise", EXERCISES)
def test_solution_passes_and_starter_fails(exercise):
    ex = EX / exercise
    r = grade((ex / "solution.py").read_text(), ex)
    assert r["status"] == "passed" and r["passed_tests"] == r["total_tests"]
    r = grade((ex / "starter.py").read_text(), ex)
    assert r["status"] == "failed" and r["passed_tests"] == 0


@pytest.mark.parametrize("exercise", EXERCISES)
def test_hints_match_tests(exercise):
    meta = json.loads((EX / exercise / "exercise.json").read_text())
    tree = ast.parse((EX / exercise / "tests_hidden.py").read_text())
    names = {n.name for n in tree.body if isinstance(n, ast.FunctionDef) and n.name.startswith("test_")}
    assert set(meta["hints"]) == names


# ---------------------------------------------------------------- llm_eval_metrics

def test_set_overlap_in_f1_is_caught():
    _assert_caught("llm_eval_metrics", "sum((Counter(pred_tokens) & Counter(gold_tokens)).values())",
                   "len(set(pred_tokens) & set(gold_tokens))", "test_token_f1_counts_repeated_tokens_once_per_match")


def test_missing_article_removal_is_caught():
    _assert_caught("llm_eval_metrics", '    text = re.sub(r"\\b(a|an|the)\\b", " ", text)\n', "",
                   "test_normalize_answer")


def test_lcs_off_by_one_is_caught():
    _assert_caught("llm_eval_metrics", "for j in range(1, n + 1):", "for j in range(1, n):",
                   "test_lcs_and_rouge_l_known_values")


# ---------------------------------------------------------------- judge_harness

def test_single_order_judging_is_caught():
    _assert_caught("judge_harness", 'return first if first == second else "tie"', "return first",
                   "test_position_bias_becomes_tie")


def test_wrong_elo_base_is_caught():
    _assert_caught("judge_harness", "base ** ((ry - rx) / scale)", "np.exp((ry - rx) / scale)",
                   "test_elo_known_values")


def test_kappa_without_chance_correction_is_caught():
    _assert_caught("judge_harness", "return (po - pe) / (1 - pe)", "return po",
                   "test_cohens_kappa_corrects_for_chance")


# ---------------------------------------------------------------- llm_gateway

def test_bucket_overfill_is_caught():
    _assert_caught("llm_gateway", "min(self.capacity, self.tokens + (now - self.last) * self.refill_rate)",
                   "self.tokens + (now - self.last) * self.refill_rate", "test_token_bucket_never_exceeds_capacity")


def test_ttl_not_enforced_is_caught():
    _assert_caught("llm_gateway", "if entry is not None and self.clock() - entry[1] >= self.ttl:", "if False:",
                   "test_response_cache_ttl_expiry")


def test_unchecked_luhn_redaction_is_caught():
    _assert_caught("llm_gateway", 'sub("CREDIT_CARD", luhn_valid)', 'sub("CREDIT_CARD")', "test_redact_pii")


def test_dropping_system_prompt_is_caught():
    _assert_caught("llm_gateway", 'system = [i for i, m in enumerate(messages) if m["role"] == "system"]',
                   "system = []", "test_truncate_history_keeps_system_and_recent")
