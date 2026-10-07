"""LLM-as-a-judge harness: order-swapped pairwise judging, win rates, Elo, Bradley-Terry and Cohen's kappa."""
from collections import Counter

import numpy as np

_FIRST_SHOWN = {"A": "a", "B": "b", "tie": "tie"}    # verdict when a is shown first
_SECOND_SHOWN = {"A": "b", "B": "a", "tie": "tie"}   # verdict when b is shown first


def judge_pair(judge, question: str, answer_a: str, answer_b: str) -> str:
    """Ask the judge in both orders; return 'a' or 'b' only if both agree, else 'tie'."""
    first = _FIRST_SHOWN[judge(question, answer_a, answer_b)]
    second = _SECOND_SHOWN[judge(question, answer_b, answer_a)]
    return first if first == second else "tie"


def pairwise_eval(judge, questions: list, answers_a: list, answers_b: list) -> list:
    """judge_pair for every question; returns the list of outcomes in order."""
    if not (len(questions) == len(answers_a) == len(answers_b)):
        raise ValueError("questions and answers must have the same length")
    return [judge_pair(judge, q, a, b) for q, a, b in zip(questions, answers_a, answers_b)]


def win_rate(outcomes: list) -> float:
    """Win rate of model a: (wins + 0.5 * ties) / n."""
    if not outcomes:
        raise ValueError("no outcomes")
    counts = Counter(outcomes)
    return (counts["a"] + 0.5 * counts["tie"]) / len(outcomes)


def elo_ratings(matches: list, k: float = 32.0, initial: float = 1000.0) -> dict:
    """Sequential Elo updates over (player_x, player_y, winner) with winner = x, y or 'tie'."""
    base, scale = 10.0, 400.0
    ratings = {}
    for x, y, winner in matches:
        rx = ratings.setdefault(x, initial)
        ry = ratings.setdefault(y, initial)
        expected_x = 1.0 / (1.0 + base ** ((ry - rx) / scale))
        score_x = 1.0 if winner == x else 0.0 if winner == y else 0.5
        ratings[x] = rx + k * (score_x - expected_x)
        ratings[y] = ry + k * ((1.0 - score_x) - (1.0 - expected_x))
    return ratings


def bradley_terry(matches: list, max_iter: int = 1000, tol: float = 1e-10) -> dict:
    """Bradley-Terry strengths (summing to 1) fitted with Hunter's MM algorithm. Ties count half to each."""
    players = sorted({p for x, y, _ in matches for p in (x, y)})
    index = {p: i for i, p in enumerate(players)}
    n = len(players)
    wins = np.zeros(n)
    games = np.zeros((n, n))
    for x, y, winner in matches:
        i, j = index[x], index[y]
        games[i, j] += 1
        games[j, i] += 1
        if winner == x:
            wins[i] += 1
        elif winner == y:
            wins[j] += 1
        else:
            wins[i] += 0.5
            wins[j] += 0.5
    p = np.full(n, 1.0 / n)
    for _ in range(max_iter):
        denom = np.divide(games, p[:, None] + p[None, :], out=np.zeros_like(games), where=games > 0).sum(axis=1)
        new = wins / denom
        new /= new.sum()
        done = np.max(np.abs(new - p)) < tol
        p = new
        if done:
            break
    return {name: float(p[index[name]]) for name in players}


def cohens_kappa(labels_a: list, labels_b: list) -> float:
    """Chance-corrected agreement between two raters labelling the same items."""
    if len(labels_a) != len(labels_b) or not labels_a:
        raise ValueError("need two equal-length, non-empty label lists")
    n = len(labels_a)
    po = sum(a == b for a, b in zip(labels_a, labels_b)) / n
    ca, cb = Counter(labels_a), Counter(labels_b)
    pe = sum(ca[c] * cb[c] for c in ca) / (n * n)
    if pe == 1.0:
        return 1.0
    return (po - pe) / (1 - pe)
