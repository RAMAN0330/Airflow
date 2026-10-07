# Multi-Head Attention & Rotary Position Embeddings

One attention head produces one weighting of "who looks at whom". A token often needs several at once:
the subject of its verb, the previous word, the matching bracket. **Multi-head attention** runs `H`
smaller heads side by side. **RoPE** fixes the order blindness you saw in the last lesson by rotating
queries and keys according to their position.

## Heads are slices of the features

With `d_model = D` and `H` heads, each head works in `d_head = D / H` dimensions. You don't need `H`
separate weight matrices. Project once with a `(D, D)` matrix, then **slice** the result:

```
Q = X W_q                                  # (B, T, D)
Q = Q.reshape(B, T, H, d_head)             # split the feature axis
Q = Q.transpose(0, 2, 1, 3)                # (B, H, T, d_head): heads become a batch axis
```

Head `h` owns features `h·d_head : (h+1)·d_head` of every token. The transpose matters. Reshaping
`(B, T, D)` straight to `(B, H, T, d_head)` produces the right *shape* but deals features out to the wrong
heads, and different tokens end up mixed inside one head. Nothing crashes. The model is just wrong.

Once heads are a batch axis, the attention code from the last exercise works unchanged, because `@`
and `swapaxes(-1, -2)` broadcast over `(B, H)`. Afterwards, undo the split (transpose back, reshape to
`(B, T, D)`) and mix the heads with an output projection `W_o`. Scale scores by `√d_head`, not `√D`:
the dot products live in the head's own dimension.

## Why position needs help

Attention is permutation-equivariant, so shuffle the tokens and the outputs shuffle with them. The original
transformer added sinusoidal vectors to the embeddings. Most modern LLMs (LLaMA, Mistral, Qwen) instead
use **rotary position embeddings**, which put position directly into the `q·k` score.

## RoPE: rotate pairs of features

Group a head's features into pairs `(x₀, x₁), (x₂, x₃), …`. Each pair is a point in 2-D. At position `m`,
rotate pair `i` by the angle `m·θᵢ`:

```
θᵢ = 10000^(−2i / d_head)          i = 0 … d_head/2 − 1

x'₂ᵢ   = x₂ᵢ cos(mθᵢ) − x₂ᵢ₊₁ sin(mθᵢ)
x'₂ᵢ₊₁ = x₂ᵢ sin(mθᵢ) + x₂ᵢ₊₁ cos(mθᵢ)
```

Pair 0 spins fast (`θ₀ = 1` radian per step) and the last pair barely moves, much like the hands of a
clock. Getting the exponent wrong (`−i/d` instead of `−2i/d`) still gives valid rotations, so the
properties below still hold. The frequencies are just wrong, and pretrained weights stop working.

## The key property: only the offset survives

Rotations preserve length, and rotating both vectors changes their dot product only by the *difference*
of the angles:

```
⟨R(mθ) q, R(nθ) k⟩ = ⟨q, R((n − m)θ) k⟩
```

So the attention score between positions 7 and 5 equals the score between 1007 and 1005. The model sees
**relative position**, even though each token was rotated by its **absolute** position. RoPE is applied to
`q` and `k` only, after the head split. Values carry content, not position, so they aren't rotated.

## Two pairing conventions

The RoFormer paper pairs **interleaved** features `(x₂ᵢ, x₂ᵢ₊₁)`. GPT-NeoX and Hugging Face's Llama code
pair `xᵢ` with `xᵢ₊d/2` (**half-split**, the `rotate_half` trick). Both are the same rotation on a permuted
feature order, and both work equally well. Mixing them up when loading someone else's checkpoint
silently breaks it. The exercise uses the interleaved convention, and its tests pin it down.

## In the exercise

You'll write `split_heads`/`merge_heads`, `rope_frequencies` and `apply_rope`, then put them together
into causal multi-head attention. Property tests check that RoPE preserves norms and that rotated scores
depend only on `m − n`.
