# LLM-as-a-Judge & Eval Harnesses

EM and ROUGE need a reference answer. "Write a friendly reply to this angry customer" has thousands of
good answers and no single reference. Human raters are the gold standard, but they're slow and
expensive. The practical answer is to let a **strong LLM grade the outputs**, then measure how far you
can trust it.

## What the research found

Zheng et al. compared GPT-4 judgments with expert and crowd preferences on MT-Bench and Chatbot Arena.
The strong judge agreed with humans over 80% of the time, about as often as humans agree with each other.
They also documented the judge's failure modes:

| Bias | What happens |
|---|---|
| **Position** | the answer shown first (or second) wins more often, regardless of content |
| **Verbosity** | longer answers are preferred even when they add nothing |
| **Self-enhancement** | a judge may favor answers that resemble its own outputs |

Position bias is large. Wang et al. showed that just reordering the answers could make Vicuna-13B beat
ChatGPT on 66 of 80 questions.

## Cancel position bias: judge both orders

```python
v1 = judge(q, a, b)                 # "A" means a won
v2 = judge(q, b, a)                 # now "A" means b won
winner = v1_mapped if v1_mapped == v2_mapped else "tie"
```

Zheng et al. use exactly this conservative rule: a win counts only when the judge prefers the same
answer in both orders. A judge that always says "first" now produces only ties instead of a fake winner.
It costs two calls per pair, which is the price of a usable number.

The **win rate** of A over B is `(wins + 0.5·ties) / n`, so 0.5 means "no detectable difference".

## From pairs to a leaderboard

With many models you have a pile of match results `(x, y, winner)`.

**Elo** updates ratings one match at a time:

```
E_x = 1 / (1 + 10^((R_y − R_x)/400))      R_x ← R_x + K·(S_x − E_x)
```

A 400-point gap means 10:1 expected odds. K (often 32) sets how fast ratings move. Elo is simple and
online, but the final ratings **depend on match order**. Shuffle the same matches and you get a different
leaderboard.

**Bradley–Terry** (1952) fits all matches at once: `P(i beats j) = p_i / (p_i + p_j)`. Chiang et al.
use this model for the Chatbot Arena leaderboard because it gives stable, order-independent scores with
confidence intervals. Hunter's **MM algorithm** fits it with a short fixed-point loop:

```
W_i = wins of i (a tie gives 0.5 to each side),   n_ij = games between i and j
p_i ← W_i / Σ_j n_ij / (p_i + p_j)        then normalize p to sum to 1
```

Each update increases the likelihood. At convergence, every player's actual wins equal its expected
wins, `Σ_j n_ij · p_i/(p_i + p_j)`. That gives you a check you can test.

## Is the judge any good? Cohen's kappa

Label a sample of pairs by hand and compare. Raw agreement is misleading: if the judge and the human
both say "A wins" 90% of the time, they agree 0.9·0.9 + 0.1·0.1 = 82% **by chance alone**. Cohen's
kappa removes that:

```
κ = (p_o − p_e) / (1 − p_e)        p_e = Σ_label P_judge(label) · P_human(label)
```

κ = 1 is perfect agreement, 0 is chance level, and negative is worse than chance. Track κ every time you
change the judge model or its rubric prompt.

## The harness you'll build

The exercise takes a deterministic fake judge (no API calls) and has you implement order-swapped
judging, win rates, Elo, Bradley–Terry by MM, and Cohen's kappa.
