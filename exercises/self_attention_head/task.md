# Scaled Dot-Product Self-Attention Head

Build one self-attention head in NumPy, using no deep-learning frameworks.

## Attention

```
Attention(Q, K, V) = softmax( Q Kᵀ / √d_k ) V
```

| Tensor | Shape |
|---|---|
| `Q` | `(..., T_q, d_k)` |
| `K` | `(..., T_k, d_k)` |
| `V` | `(..., T_k, d_v)` |
| output | `(..., T_q, d_v)` |
| weights | `(..., T_q, T_k)` |

`...` means any number of leading batch dimensions, including none.

## What to implement (`starter.py`)

1. **`softmax(x, axis=-1)`**: numerically stable, so subtract the max before `exp`.
   `softmax(np.array([1000., 1001.]))` must not return `nan`.
2. **`causal_mask(T)`**: boolean `(T, T)` array, `True` where query `i` may attend
   to key `j` (that is, `j <= i`).
3. **`scaled_dot_product_attention(Q, K, V, mask=None)`**: returns `(output, weights)`.
   - `mask` is a boolean array that broadcasts to `(..., T_q, T_k)`. `True` means
     *keep*. Masked positions must get exactly zero weight.
   - If the last dims of `Q` and `K` differ, raise
     `ValueError("K and Q dimensions do not match")`.
4. **`SelfAttentionHead(d_model, d_head, seed=0)`**:
   - `__init__` creates `self.W_q`, `self.W_k`, `self.W_v`, each of shape `(d_model, d_head)`.
     Initialize them from `np.random.default_rng(seed)` with scale `1/√d_model`.
   - `forward(X, causal=False)` takes `X` of shape `(..., T, d_model)`, projects to
     Q/K/V, and returns `(output, weights)`.

## What the hidden tests check

- Softmax sums to 1, survives large logits, and respects `axis`.
- Causal mask matches the lower triangle.
- Attention output and weights match a reference implementation, both batched and unbatched.
- The `√d_k` scaling is actually applied.
- Masked weights are exactly 0, and with `causal=True` changing a *future* token
  leaves earlier outputs unchanged.
- A Q/K dimension mismatch raises `ValueError`.
- Without a mask, self-attention is permutation-equivariant.

## Hints

- Use `K.swapaxes(-1, -2)`, not `K.T`. `.T` reverses *all* axes and breaks batching.
- Apply the mask before softmax with `np.where(mask, scores, -np.inf)`. A fully
  masked row would produce `nan`, but a causal mask never creates one.
