# RNNs & LSTMs: Memory, BPTT and Exploding Gradients

MLPs and CNNs see a fixed-size input all at once. Text, audio and sensor logs
arrive as **sequences** of varying length, where what matters now depends on
what came before. A recurrent network reads one step at a time and carries a
summary of the past forward in a **hidden state**.

## The vanilla RNN

```
h_t = tanh(x_t W_x + h_{t−1} W_h + b)        h_0 given
```

The same weights are used at every time step, so the network handles any
length with a fixed number of parameters. Unrolling is just a loop, and the
whole point is that each step's output becomes the next step's input:

```
h = h0
for t in range(T):
    h = rnn_step(x[:, t], h, Wx, Wh, b)   # not h0!
    hs[:, t] = h
```

If you pass `h0` at every step, the "RNN" sees only one token at a time and
remembers nothing.

## Backpropagation through time (BPTT)

Unroll the loop and you get a deep feedforward network whose layers share
weights. Backprop through it walks from `t = T−1` back to `0`. At each step the
hidden state receives gradient from **two** places: the loss at that step, and
the future, through `h_{t+1}`:

```
dh  = dhs[:, t] + dh_next
da  = dh * (1 − h_t²)                 # tanh′
dWx += x_tᵀ da;  dWh += h_{t−1}ᵀ da;  db += Σ da
dh_next = da W_hᵀ
```

Shared weights accumulate (`+=`) their gradient across every step.

## Vanishing and exploding gradients

The gradient reaching step `t − k` has been multiplied by `W_hᵀ diag(1 − h²)`
`k` times. If those factors have norm below 1, it shrinks exponentially
(**vanishing**), and the network can't learn long-range dependencies. If they
have norm above 1, it grows exponentially (**exploding**), and one bad batch
produces a huge update that wrecks training.

## Gradient clipping: global norm

Pascanu et al. proposed a simple fix for exploding gradients: if the gradient is
too long, shorten it without changing its direction.

```
total = sqrt(Σ over all parameters ‖g‖²)
if total > max_norm:  every g *= max_norm / total
```

The norm is **global**, one number over all parameters. Clipping each tensor on
its own changes the relative sizes of the gradients and therefore their
direction. PyTorch's `clip_grad_norm_` is global for this reason.

## The LSTM cell

The LSTM attacks vanishing gradients by adding a **cell state** `c_t` that
updates *additively*, controlled by gates. The gates use sigmoids, so each one
is a soft switch between 0 and 1:

```
a = x_t W_x + h_{t−1} W_h + b          # (N, 4H), split in order i, f, g, o
i = σ(a_i)   f = σ(a_f)   o = σ(a_o)   # gates: how much
g = tanh(a_g)                          # candidate content: what, in (−1, 1)
c_t = f ⊙ c_{t−1} + i ⊙ g
h_t = o ⊙ tanh(c_t)
```

When `f ≈ 1` and `i ≈ 0`, the cell copies itself forward unchanged, and so does
its gradient. That "constant error carousel" is what lets LSTMs bridge hundreds
of steps. The candidate `g` must use `tanh`, not a sigmoid: content needs a sign,
and a sigmoid could only ever add to the cell.

## In the exercise

You'll unroll an RNN and an LSTM, write BPTT and check it against numerical
gradients, and implement global-norm clipping. The gate order `i, f, g, o`
matches PyTorch's `nn.LSTM` weight layout.
