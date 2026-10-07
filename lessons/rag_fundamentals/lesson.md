# Retrieval-Augmented Generation: Look It Up, Then Answer

A language model's knowledge is frozen at training time, it can't cite where a fact came from, and it
will confidently invent an answer it doesn't have. **Retrieval-augmented generation** (Lewis et al., 2020)
addresses all three. Before answering, find relevant passages in your own documents and put them in the
prompt. The model is then reading the answer, not recalling it.

## The pipeline

```
offline:  documents → chunks → embeddings → index
online:   question → embedding → top-k chunks → prompt → LLM
```

Everything before the LLM call is ordinary information retrieval, and it decides answer quality more
than people expect. If the right passage isn't retrieved, the model can't use it.

## Chunking: size and overlap

Whole documents are too long to embed well and too long to paste. Split them into windows of `size`
words, where each window starts `size − overlap` words after the previous one:

```
size = 4, overlap = 1:   [a b c d] [d e f g] [g h i j]
```

Overlap keeps a sentence that straddles a boundary intact in at least one chunk. The step is easy to get
wrong by one. With a step of `size − overlap + 1`, neighbours share one word fewer than intended, and with
overlap 1 they share nothing. Real systems often split on sentences or headings, but the size and
overlap trade-off is the same.

## Embedding: text → vector

Production systems use learned dense encoders such as DPR. The retrieval logic doesn't care where vectors
come from, so the exercise uses a deterministic **hashed bag of words**: each token adds 1 to bucket
`hash(token) mod dim`, and the vector is L2-normalized. This is the hashing trick behind scikit-learn's
`HashingVectorizer`. It needs no vocabulary and no training, and it's reproducible as long as the hash is
stable. (Python's `hash()` is salted per process, so use MD5 or similar.)

## Similarity: cosine, not raw dot product

```
cos(q, d) = (q · d) / (‖q‖ ‖d‖)
```

A raw dot product grows with vector length, so long chunks with many repeated words win just for being
long. Cosine compares *direction* only. If every stored vector is already unit-length, cosine and dot
product agree, which is why vector databases normalize at insert time. Your similarity function
shouldn't *assume* that, though. Guard against zero vectors too (an empty query), because `0/0` gives `nan`.

Ranking needs a deterministic tie-break. `np.argsort` isn't stable by default, so sort by
`(−score, index)` and identical chunks will always come back in insertion order.

## Context injection with a budget

The retrieved chunks go into the prompt as numbered, cited passages:

```
Context:
[1] (kafka.md) Consumers track offsets ...
[2] (pg.md) B-trees are the default ...
```

The context window is finite and costs money, so enforce a character (or token) **budget**. Walk the
hits in rank order and stop at the first one that doesn't fit. Count *everything* you add, including the
newline between lines. Forgetting the separators is how prompts quietly overflow. More context isn't
always better either: Liu et al. found models use information at the start and end of a long context
much better than information in the middle.

## In the exercise

You'll implement `chunk_text`, `embed`, `cosine_similarity`, a stable `top_k`, a small `VectorIndex`
and `build_prompt`. There's no LLM call. The hidden tests check exact overlap, normalization, tie order
and that the budget holds to the character.
