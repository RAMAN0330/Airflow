"""A tiny retrieval pipeline: chunk, embed, search and build a cited, budgeted prompt."""
import hashlib
import re

import numpy as np


def tokenize(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def bucket(token, dim):
    return int(hashlib.md5(token.encode("utf-8")).hexdigest(), 16) % dim


def chunk_text(text, size, overlap):
    if size <= 0 or overlap < 0 or overlap >= size:
        raise ValueError("need size > 0 and 0 <= overlap < size")
    words = text.split()
    step = size - overlap
    chunks = []
    for start in range(0, len(words), step):
        chunks.append(" ".join(words[start:start + size]))
        if start + size >= len(words):
            break
    return chunks


def embed(text, dim=256):
    v = np.zeros(dim)
    for tok in tokenize(text):
        v[bucket(tok, dim)] += 1.0
    norm = np.linalg.norm(v)
    return v / norm if norm > 0 else v


def cosine_similarity(query, matrix):
    q = np.asarray(query, dtype=float)
    M = np.atleast_2d(np.asarray(matrix, dtype=float))
    dots = M @ q
    denom = np.linalg.norm(M, axis=1) * np.linalg.norm(q)
    safe = np.where(denom > 0, denom, 1.0)
    return np.where(denom > 0, dots / safe, 0.0)


def top_k(scores, k):
    scores = np.asarray(scores, dtype=float)
    order = sorted(range(len(scores)), key=lambda i: (-scores[i], i))
    return order[:max(k, 0)]


class VectorIndex:
    def __init__(self, dim=256):
        self.dim = dim
        self.texts, self.sources, self.vectors = [], [], []

    def __len__(self):
        return len(self.texts)

    def add(self, text, source):
        self.texts.append(text)
        self.sources.append(source)
        self.vectors.append(embed(text, self.dim))
        return len(self.texts) - 1

    def add_document(self, source, text, size=50, overlap=10):
        chunks = chunk_text(text, size, overlap)
        for c in chunks:
            self.add(c, source)
        return len(chunks)

    def search(self, query, k=3):
        if not self.texts:
            return []
        scores = cosine_similarity(embed(query, self.dim), np.stack(self.vectors))
        return [{"id": i, "source": self.sources[i], "text": self.texts[i], "score": float(scores[i])}
                for i in top_k(scores, k)]


def build_prompt(question, hits, max_context_chars):
    lines, used = [], 0
    for hit in hits:
        line = f"[{len(lines) + 1}] ({hit['source']}) {hit['text']}"
        extra = len(line) + (1 if lines else 0)  # +1 for the newline that joins it to the previous line
        if used + extra > max_context_chars:
            break
        lines.append(line)
        used += extra
    context = "\n".join(lines) if lines else "(no relevant context found)"
    return (
        "Answer the question using only the context below. Cite sources like [1].\n\n"
        f"Context:\n{context}\n\n"
        f"Question: {question}\n"
        "Answer:"
    )
