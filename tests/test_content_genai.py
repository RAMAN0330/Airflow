"""Bug-injection tests for the Generative AI & LLMs content (MHA + RoPE, LoRA, RAG).

Each test mutates a reference solution the way a learner plausibly would and checks that a
specific hidden test catches it.
"""
from pathlib import Path

import pytest

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
GENAI = ["multi_head_attention_rope", "lora_adapter", "rag_retriever"]


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(ex, old, new):
    src = (EX / ex / "solution.py").read_text()
    assert old in src, f"{old!r} not found in {ex}/solution.py"
    buggy = src.replace(old, new)
    assert buggy != src
    return buggy


@pytest.mark.parametrize("ex", GENAI)
def test_solution_passes_and_starter_fails_everything(ex):
    r = grade((EX / ex / "solution.py").read_text(), EX / ex)
    assert r["status"] == "passed" and r["passed_tests"] == r["total_tests"] > 0, r
    r = grade((EX / ex / "starter.py").read_text(), EX / ex)
    assert r["status"] == "failed" and r["passed_tests"] == 0, r


# ---------------------------------------------------------------- multi_head_attention_rope

def test_reshape_without_transpose_mixes_heads():
    ex = "multi_head_attention_rope"
    buggy = _mutate(ex, "x.reshape(B, T, n_heads, d_head).transpose(0, 2, 1, 3)", "x.reshape(B, n_heads, T, d_head)")
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert {"test_split_heads_shape_and_layout", "test_mha_matches_reference"} <= failed


def test_wrong_rope_frequency_exponent_is_caught():
    ex = "multi_head_attention_rope"
    buggy = _mutate(ex, "np.arange(0, d_head, 2) / d_head", "np.arange(d_head // 2) / d_head")
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert {"test_rope_frequencies_values", "test_apply_rope_matches_reference"} <= failed
    # Still a valid rotation, so the property tests alone would not have caught it.
    assert "test_rope_preserves_norms" not in failed
    assert "test_rope_dot_product_depends_only_on_offset" not in failed


# ---------------------------------------------------------------- lora_adapter

def test_nonzero_B_init_is_caught():
    ex = "lora_adapter"
    buggy = _mutate(ex, "self.B = np.zeros((d_out, r))", "self.B = rng.standard_normal((d_out, r)) * 0.01")
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert {"test_init_output_equals_base_layer", "test_init_shapes_and_zero_B"} <= failed


def test_missing_alpha_over_r_scaling_is_caught():
    ex = "lora_adapter"
    buggy = _mutate(ex, "self.scale = alpha / r", "self.scale = 1.0")
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert "test_forward_matches_reference" in failed


def test_gradient_into_frozen_W_is_caught():
    ex = "lora_adapter"
    buggy = _mutate(ex, 'return {"A": grad_A, "B": grad_B}', 'return {"A": grad_A, "B": grad_B, "W": grad_out.T @ x}')
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert {"test_backward_grads_only_for_A_and_B", "test_training_keeps_base_frozen"} <= failed


# ---------------------------------------------------------------- rag_retriever

def test_unnormalized_dot_product_is_caught():
    ex = "rag_retriever"
    buggy = _mutate(ex, "dots / safe", "dots")
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert "test_cosine_similarity_normalizes" in failed


def test_chunk_overlap_off_by_one_is_caught():
    ex = "rag_retriever"
    buggy = _mutate(ex, "step = size - overlap", "step = size - overlap + 1")
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert "test_chunk_overlap_is_exact" in failed


def test_context_budget_overflow_is_caught():
    ex = "rag_retriever"
    buggy = _mutate(ex, "len(line) + (1 if lines else 0)", "len(line)")
    r, failed = _failed(buggy, EX / ex)
    assert r["status"] == "failed"
    assert "test_build_prompt_respects_budget" in failed
    assert "test_build_prompt_format" not in failed
