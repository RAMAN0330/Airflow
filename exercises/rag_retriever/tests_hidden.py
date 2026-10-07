"""Hidden validation suite for rag_retriever.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import hashlib
import re

import numpy as np
import pytest

import submission as sub


def _ref_embed(text, dim=256):
    v = np.zeros(dim)
    for tok in re.findall(r"[a-z0-9]+", text.lower()):
        v[int(hashlib.md5(tok.encode("utf-8")).hexdigest(), 16) % dim] += 1.0
    n = np.linalg.norm(v)
    return v / n if n > 0 else v


def _context(prompt):
    head, tail = "Context:\n", "\n\nQuestion:"
    assert head in prompt and tail in prompt, "prompt must contain 'Context:\\n' ... '\\n\\nQuestion:'"
    return prompt.split(head, 1)[1].split(tail, 1)[0]


DOCS = {
    "postgres.md": "PostgreSQL uses B-tree indexes by default. An index speeds up lookups on a column "
                   "but slows down writes because every insert must update the index too.",
    "kafka.md": "Kafka stores messages in partitioned append-only logs. Consumers track offsets and "
                "consumer groups split partitions between workers for parallel reads.",
    "lora.md": "LoRA freezes the pretrained weights and trains a low-rank update made of two small "
               "matrices, which cuts the number of trainable parameters dramatically.",
}


# ---------------------------------------------------------------- chunking

def test_chunk_text_windows():
    words = "a b c d e f g h i j"
    assert sub.chunk_text(words, 4, 1) == ["a b c d", "d e f g", "g h i j"]
    assert sub.chunk_text("a b c d e f g", 4, 2) == ["a b c d", "c d e f", "e f g"]
    assert sub.chunk_text("one  two\nthree", 10, 3) == ["one two three"]
    assert sub.chunk_text("a b c d e f", 3, 0) == ["a b c", "d e f"]
    assert sub.chunk_text("", 5, 1) == []
    assert sub.chunk_text("   \n ", 5, 1) == []
    for size, overlap in ((5, 5), (5, 7), (0, 0), (-2, 0), (5, -1)):
        with pytest.raises(ValueError):
            sub.chunk_text("a b c", size, overlap)


def test_chunk_overlap_is_exact():
    words = [f"w{i}" for i in range(103)]
    chunks = [c.split() for c in sub.chunk_text(" ".join(words), 20, 5)]
    assert all(len(c) <= 20 for c in chunks)
    for prev, nxt in zip(chunks, chunks[1:]):
        assert prev[-5:] == nxt[:5], "consecutive chunks must share exactly `overlap` words"
        assert prev[-6:] != nxt[:6]
    assert chunks[0][0] == "w0" and chunks[-1][-1] == "w102", "chunks must cover the whole text"
    assert len(chunks) == 7
    assert chunks[1][0] == "w15", "the second chunk starts at size - overlap = 15"


# ---------------------------------------------------------------- embedding & similarity

def test_embed_matches_spec():
    text = "The cat sat on the mat. THE CAT!"
    v = sub.embed(text, dim=64)
    assert np.shape(v) == (64,)
    np.testing.assert_allclose(v, _ref_embed(text, 64), atol=1e-12)
    assert np.linalg.norm(v) == pytest.approx(1.0)
    np.testing.assert_array_equal(sub.embed("...!?", dim=16), np.zeros(16))
    np.testing.assert_allclose(sub.embed(DOCS["kafka.md"]), _ref_embed(DOCS["kafka.md"]), atol=1e-12)


def test_cosine_similarity_normalizes():
    rng = np.random.default_rng(0)
    q, M = rng.standard_normal(8) * 3, rng.standard_normal((5, 8)) * 7
    ref = (M @ q) / (np.linalg.norm(M, axis=1) * np.linalg.norm(q))
    s = sub.cosine_similarity(q, M)
    assert np.shape(s) == (5,)
    np.testing.assert_allclose(s, ref, atol=1e-12)
    M2 = M.copy(); M2[2] *= 100.0
    np.testing.assert_allclose(sub.cosine_similarity(q, M2), ref, atol=1e-12,
                               err_msg="scaling a document vector must not change its cosine score")
    assert np.all(np.abs(s) <= 1.0 + 1e-12)
    M3 = M.copy(); M3[1] = 0.0
    s3 = sub.cosine_similarity(q, M3)
    assert np.all(np.isfinite(s3)) and s3[1] == 0.0, "a zero vector has similarity 0, not nan"
    np.testing.assert_array_equal(sub.cosine_similarity(np.zeros(8), M), np.zeros(5))


def test_top_k_order_and_ties():
    scores = np.array([0.5, 0.9, 0.5, 0.9, 0.1])
    assert list(sub.top_k(scores, 3)) == [1, 3, 0]
    assert list(sub.top_k(scores, 10)) == [1, 3, 0, 2, 4]
    assert list(sub.top_k(scores, 0)) == []
    assert list(sub.top_k([0.2] * 6, 4)) == [0, 1, 2, 3], "ties must go to the lower index"


# ---------------------------------------------------------------- index

def test_index_search_finds_relevant_chunk():
    idx = sub.VectorIndex(dim=512)
    counts = [idx.add_document(src, text, size=12, overlap=3) for src, text in DOCS.items()]
    assert all(c >= 2 for c in counts)
    assert len(idx) == sum(counts)
    hits = idx.search("how do consumer groups read kafka partitions", k=3)
    assert len(hits) == 3
    assert set(hits[0]) >= {"id", "source", "text", "score"}
    assert hits[0]["source"] == "kafka.md"
    scores = [h["score"] for h in hits]
    assert scores == sorted(scores, reverse=True)
    assert idx.search("trainable parameters low-rank", k=1)[0]["source"] == "lora.md"
    assert sub.VectorIndex().search("anything") == []


def test_index_ties_keep_insertion_order():
    idx = sub.VectorIndex(dim=128)
    assert idx.add("indexes speed up reads", "first.md") == 0
    assert idx.add("indexes speed up reads", "second.md") == 1
    idx.add("completely unrelated words here", "third.md")
    hits = idx.search("indexes speed up reads", k=2)
    assert [h["source"] for h in hits] == ["first.md", "second.md"]
    assert [h["id"] for h in hits] == [0, 1]
    assert hits[0]["score"] == pytest.approx(1.0)


# ---------------------------------------------------------------- prompt

def test_build_prompt_format():
    hits = [{"id": 4, "source": "kafka.md", "text": "Consumers track offsets.", "score": 0.8},
            {"id": 1, "source": "pg.md", "text": "B-trees are the default.", "score": 0.5}]
    expected = (
        "Answer the question using only the context below. Cite sources like [1].\n\n"
        "Context:\n"
        "[1] (kafka.md) Consumers track offsets.\n"
        "[2] (pg.md) B-trees are the default.\n\n"
        "Question: What do consumers track?\n"
        "Answer:"
    )
    assert sub.build_prompt("What do consumers track?", hits, 1000) == expected
    empty = sub.build_prompt("Q?", [], 1000)
    assert _context(empty) == "(no relevant context found)"


def test_build_prompt_respects_budget():
    hits = [{"source": "a", "text": "x" * 20, "score": 0.9},   # line length 28
            {"source": "b", "text": "y" * 10, "score": 0.8},   # line length 18
            {"source": "c", "text": "z", "score": 0.7}]        # line length 9
    # 28 + 1 (newline) + 18 = 47 characters for the first two lines.
    for budget, n_lines in ((47, 2), (46, 1), (28, 1), (27, 0), (57, 3)):
        ctx = _context(sub.build_prompt("q", hits, budget))
        if n_lines == 0:
            assert ctx == "(no relevant context found)"
            continue
        assert len(ctx) <= budget, f"context is {len(ctx)} chars, budget was {budget}"
        assert len(ctx.split("\n")) == n_lines, f"budget {budget}: expected {n_lines} citation lines"
    ctx = _context(sub.build_prompt("q", hits, 46))
    assert "[2]" not in ctx and "(c)" not in ctx, \
        "stop at the first chunk that doesn't fit; lower-ranked chunks must not jump ahead"
