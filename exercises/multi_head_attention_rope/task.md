# Multi-Head Attention with Rotary Embeddings

One attention head computes one pattern of "who looks at whom". Real transformers run many heads side
by side, each in its own slice of the features, and they rotate queries and keys so attention scores
know how far apart two tokens are. Build both pieces in NumPy.

## Shapes

| Tensor | Shape |
|---|---|
| `x` | `(B, T, D)` |
| `W_q`, `W_k`, `W_v`, `W_o` | `(D, D)` |
| per-head `q`, `k`, `v` | `(B, H, T, d_head)`, with `d_head = D // H` |
| attention weights | `(B, H, T, T)` |
| output | `(B, T, D)` |

## What to implement (`starter.py`)

1. **`split_heads(x, n_heads)`**: `(B, T, D) → (B, H, T, d_head)`. Head `h` must own features
   `h*d_head : (h+1)*d_head` of every token. Raise `ValueError` if `D % n_heads != 0`.
2. **`merge_heads(x)`**: `(B, H, T, d_head) → (B, T, H*d_head)`, the exact inverse of `split_heads`.
3. **`rope_frequencies(d_head, base=10000.0)`**: `theta_i = base ** (-2i / d_head)` for
   `i = 0 … d_head/2 − 1`. Raise `ValueError` for an odd `d_head`.
4. **`apply_rope(x, positions=None, base=10000.0)`**: `x` is `(..., T, d_head)`; `positions` defaults
   to `np.arange(T)`. Rotate each feature pair by angle `positions[t] * theta_i`:
   ```
   x'[2i]   = x[2i]·cos − x[2i+1]·sin
   x'[2i+1] = x[2i]·sin + x[2i+1]·cos
   ```
   Return a new array and never modify `x`.
5. **`multi_head_attention(x, W_q, W_k, W_v, W_o, n_heads, causal=False, rope=False, base=10000.0)`**:
   project, split heads, rotate `q` and `k` if `rope=True` (never `v`), compute
   `softmax(q kᵀ / √d_head)` with an optional causal mask, mix values, merge heads and apply `W_o`.
   Return `(output, weights)`.

## Pairing convention: interleaved, not half-split

This exercise uses the **interleaved** convention from the RoFormer paper: the pairs are
`(x[0], x[1]), (x[2], x[3]), …`. Many codebases (GPT-NeoX, Hugging Face Llama) use the
**half-split** convention instead: they pair `x[i]` with `x[i + d/2]` ("rotate_half"). The two are
the same rotation applied to a permuted feature order. They give the same model quality, but you can't
load weights trained under one convention into code that uses the other without permuting `W_q` and
`W_k`. The tests check the interleaved one.

## What the hidden tests check

- `split_heads` puts the right features in each head; `merge_heads(split_heads(x)) == x`.
- Frequencies match `base ** (-2i/d)` exactly.
- `apply_rope` matches a loop of explicit 2×2 rotation matrices, preserves vector norms, and makes
  `⟨RoPE(q, m), RoPE(k, n)⟩` depend only on `m − n`.
- Multi-head attention matches a head-by-head reference, with and without RoPE, and the causal version
  ignores future tokens.

## Example

```python
>>> x = np.arange(24.).reshape(1, 2, 12)
>>> split_heads(x, 3)[0, 1, 0]          # head 1, token 0
array([4., 5., 6., 7.])
>>> rope_frequencies(4)
array([1.  , 0.01])
```
