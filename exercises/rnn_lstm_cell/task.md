# RNN, LSTM Cell and Gradient Clipping

A recurrent network reads a sequence one step at a time and carries a **hidden
state** forward. Build a vanilla RNN and an LSTM, write backprop through time
(BPTT) for the RNN, and add the gradient clipping that keeps RNN training
stable. NumPy only.

## Shapes

| Tensor | Shape |
|---|---|
| `x` | `(N, T, D)`: batch, time, features |
| `h0`, `c0`, `h_t`, `c_t` | `(N, H)` |
| RNN `Wx`, `Wh`, `b` | `(D, H)`, `(H, H)`, `(H,)` |
| LSTM `Wx`, `Wh`, `b` | `(D, 4H)`, `(H, 4H)`, `(4H,)` |
| `hs` | `(N, T, H)`, every hidden state |

## What to implement (`starter.py`)

1. **`sigmoid(x)`**: stable logistic function, with no overflow warnings at `±1000`.
2. **`rnn_step(x_t, h_prev, Wx, Wh, b)`**: `h_t = tanh(x_t @ Wx + h_prev @ Wh + b)`.
3. **`rnn_forward(x, h0, Wx, Wh, b)`** returns `hs`. Each step's output is the next step's `h_prev`.
4. **`rnn_backward(dhs, x, h0, Wx, Wh, b)`**: BPTT. `dhs[:, t]` is `∂L/∂h_t` from the
   loss directly. Return `{"x", "h0", "Wx", "Wh", "b"}` gradients. Walking backwards
   in time, the total gradient reaching `h_t` is `dhs[:, t]` **plus** what flows
   back from step `t+1`.
5. **`lstm_step(x_t, h_prev, c_prev, Wx, Wh, b)`** returns `(h_t, c_t)`. Gate order is **i, f, g, o** (PyTorch's):
   ```
   a = x_t @ Wx + h_prev @ Wh + b          # (N, 4H)
   i = σ(a[:, 0:H])      f = σ(a[:, H:2H])
   g = tanh(a[:, 2H:3H]) o = σ(a[:, 3H:4H])
   c_t = f ⊙ c_prev + i ⊙ g
   h_t = o ⊙ tanh(c_t)
   ```
6. **`lstm_forward(x, h0, c0, Wx, Wh, b)`** returns `(hs, c_T)`.
7. **`clip_grad_norm(grads, max_norm)`** returns `(clipped, total_norm)`:
   - `total_norm = sqrt(Σ_arrays Σ g²)`, **one** norm over all arrays together.
   - If `total_norm > max_norm`, multiply **every** array by `max_norm / total_norm`.
     Otherwise return them unchanged.
   - Return new arrays and never modify the inputs.

## Example

```python
clipped, total = clip_grad_norm([np.full((2, 2), 3.0), np.array([8.0])], max_norm=5.0)
total       # 10.0 = sqrt(4·9 + 64)
clipped     # [full((2, 2), 1.5), array([4.0])]   both halved, so direction is preserved
```

Clipping each array to `max_norm` separately would give `[full((2,2), 2.5), [5.0]]`.
That changes the gradient's direction, and the tests catch it.

## What the hidden tests check

- RNN and LSTM steps and unrolls against reference implementations.
- The hidden state is actually carried: changing `x` at `t = 0` changes the last `h`.
- LSTM gate semantics with saturated biases (closed input gate means the cell is copied; the candidate uses `tanh`).
- BPTT gradients for every input match central-difference numerical gradients.
- Global-norm clipping preserves direction, is a no-op below the threshold, and doesn't mutate its inputs.
