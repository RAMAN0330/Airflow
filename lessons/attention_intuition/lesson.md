# Attention as Soft Lookup

A Python dictionary does a *hard* lookup: one key matches and you get its value.
Attention does a *soft* lookup. Every query is compared with every key, the
similarities become weights, and you get back a weighted average of all the
values.

## Queries, keys and values

For a sequence of `T` tokens, each with a `d_model`-dimensional embedding `X`,
three learned projections produce:

```
Q = X W_q    # what each token is looking for     (T, d_k)
K = X W_k    # what each token offers to be found (T, d_k)
V = X W_v    # what each token hands over         (T, d_v)
```

## The equation

```
Attention(Q, K, V) = softmax( Q Kᵀ / √d_k ) V
```

Reading it right to left in terms of shapes:

| Step | Expression | Shape |
|---|---|---|
| Similarity scores | `Q Kᵀ` | `(T_q, T_k)` |
| Scale | `/ √d_k` | `(T_q, T_k)` |
| Normalize over keys | `softmax(…, axis=-1)` | `(T_q, T_k)`, each row sums to 1 |
| Mix values | `weights @ V` | `(T_q, d_v)` |

## Why divide by √d_k?

If the entries of `q` and `k` are independent with unit variance, the dot product
`q · k` has variance `d_k`. With `d_k = 64`, scores routinely reach ±20, and
softmax becomes nearly one-hot. Its gradients then vanish. Dividing by `√d_k`
brings the variance back to 1.

## Batching: use `swapaxes`, not `.T`

In practice `Q` has shape `(batch, T, d_k)`. NumPy's `.T` reverses *all* axes,
giving `(d_k, T, batch)`, and the matmul fails or quietly computes the wrong
thing. Transpose only the last two axes:

```
scores = Q @ K.swapaxes(-1, -2)
```

## Causal masking

A language model predicting token `t` must not see tokens after `t`. Use a
boolean mask that is `True` where attention is allowed. Here that is the lower
triangle, including the diagonal:

```
mask = np.tril(np.ones((T, T), dtype=bool))
scores = np.where(mask, scores, -np.inf)
```

After softmax, `exp(-inf) = 0`, so masked positions get exactly zero weight.
A good test: change a *future* token, and outputs at earlier positions must not
move at all.

## Order blindness

Without a mask or positional information, attention treats its input as a
*set*. Permute the tokens and the outputs are permuted the same way. This is why
transformers add positional encodings such as RoPE, which comes later in this
course.
