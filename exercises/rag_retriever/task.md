# Build a RAG Retriever

A language model only knows what was in its training data. To answer questions about *your* documents,
retrieval-augmented generation (RAG) finds the passages most relevant to the question and pastes them into
the prompt. This exercise builds everything up to the model call: chunking, embedding, search and
prompt assembly.

## Provided

- `tokenize(text)`: lowercase alphanumeric tokens, `re.findall(r"[a-z0-9]+", text.lower())`.
- `bucket(token, dim)`: a stable hash in `[0, dim)` built on MD5. Python's built-in `hash()` changes
  between processes, so an index built with it couldn't be reloaded.

## What to implement (`starter.py`)

1. **`chunk_text(text, size, overlap)`**: split on whitespace into windows of `size` words. Window `i`
   starts at word `i · (size − overlap)`, so neighbours share exactly `overlap` words. Stop after the first
   window that reaches the last word. Join words with single spaces. Empty text gives `[]`. Raise
   `ValueError` unless `size > 0` and `0 <= overlap < size`.
2. **`embed(text, dim=256)`**: a hashed bag of words. Add 1 to `v[bucket(tok, dim)]` for every token,
   then divide by the L2 norm. Text with no tokens gives the zero vector.
3. **`cosine_similarity(query, matrix)`**: `(d,)` and `(N, d)` → `(N,)`. Don't assume the inputs are
   normalized. A zero vector scores 0, never `nan`.
4. **`top_k(scores, k)`**: indices of the `k` best scores, best first. Ties go to the **lower index**.
   `k` larger than `N` returns every index.
5. **`VectorIndex(dim=256)`** with `add(text, source) → id`, `add_document(source, text, size=50,
   overlap=10) → n_chunks`, `search(query, k=3)` and `len(index)`. `search` returns up to `k` dicts
   `{"id", "source", "text", "score"}`, best first, and `[]` on an empty index.
6. **`build_prompt(question, hits, max_context_chars)`**: produce exactly

   ```
   Answer the question using only the context below. Cite sources like [1].

   Context:
   [1] (kafka.md) Consumers track offsets.
   [2] (pg.md) B-trees are the default.

   Question: What do consumers track?
   Answer:
   ```

   The **context block** is the citation lines joined with `"\n"`. Its length must never exceed
   `max_context_chars`. Walk the hits in rank order and stop at the first one that doesn't fit, so a
   short, low-ranked chunk never jumps ahead of a better one. If nothing fits, the context block is
   `(no relevant context found)`.

## What the hidden tests check

- Chunk boundaries, exact overlap, full coverage and input validation.
- Embeddings match the hashing spec and have unit norm.
- Cosine scores ignore vector length, and zero vectors score 0.
- `top_k` is deterministic, with ties broken by index.
- The index retrieves the right document, and identical chunks come back in insertion order.
- The prompt matches the format character for character and stays inside the budget, counting newlines.

## Example

```python
>>> chunk_text("a b c d e f g h i j", size=4, overlap=1)
['a b c d', 'd e f g', 'g h i j']
>>> top_k([0.5, 0.9, 0.5, 0.9, 0.1], 3)
[1, 3, 0]
```
