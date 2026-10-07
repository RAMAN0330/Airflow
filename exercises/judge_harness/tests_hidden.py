"""Hidden validation suite for judge_harness."""
import math

import numpy as np
import pytest

import submission as sub


class CountingJudge:
    """Prefers the longer answer. Within `margin` characters it can't decide and picks the first one shown."""

    def __init__(self, margin=0):
        self.margin = margin
        self.calls = []

    def __call__(self, question, first, second):
        self.calls.append((question, first, second))
        if abs(len(first) - len(second)) <= self.margin:
            return "A"
        return "A" if len(first) > len(second) else "B"


def always_first(question, first, second):
    return "A"


def always_tie(question, first, second):
    return "tie"


def test_judge_pair_runs_both_orders():
    judge = CountingJudge()
    assert sub.judge_pair(judge, "q", "a long detailed answer", "short") == "a"
    assert judge.calls == [("q", "a long detailed answer", "short"), ("q", "short", "a long detailed answer")]
    assert sub.judge_pair(CountingJudge(), "q", "short", "a long detailed answer") == "b"
    assert sub.judge_pair(always_tie, "q", "x", "y") == "tie"


def test_position_bias_becomes_tie():
    assert sub.judge_pair(always_first, "q", "x", "y") == "tie"
    assert sub.judge_pair(always_first, "q", "y", "x") == "tie"
    close = CountingJudge(margin=2)
    assert sub.judge_pair(close, "q", "abcd", "abc") == "tie"   # biased verdicts disagree
    assert sub.judge_pair(close, "q", "abcdefgh", "abc") == "a"


def test_pairwise_eval_and_win_rate():
    judge = CountingJudge(margin=1)
    qs = ["q1", "q2", "q3", "q4"]
    a = ["long answer here", "ok", "xy", "tiny"]
    b = ["short", "much longer reply", "xyz", "tiny"]
    outcomes = sub.pairwise_eval(judge, qs, a, b)
    assert outcomes == ["a", "b", "tie", "tie"]
    assert len(judge.calls) == 8
    assert sub.win_rate(outcomes) == pytest.approx(0.5)
    assert sub.win_rate(["a", "a", "tie", "b"]) == pytest.approx(0.625)
    assert sub.win_rate(["tie"] * 3) == pytest.approx(0.5)
    with pytest.raises(ValueError):
        sub.win_rate([])
    with pytest.raises(ValueError):
        sub.pairwise_eval(judge, qs, a, b[:2])


def test_elo_known_values():
    r = sub.elo_ratings([("m1", "m2", "m1")])
    assert r == {"m1": pytest.approx(1016.0), "m2": pytest.approx(984.0)}
    r = sub.elo_ratings([("m1", "m2", "m1"), ("m1", "m2", "m1")], k=32)
    e = 1 / (1 + 10 ** ((984 - 1016) / 400))
    assert r["m1"] == pytest.approx(1016 + 32 * (1 - e))
    assert r["m2"] == pytest.approx(984 - 32 * (1 - e))
    r = sub.elo_ratings([("x", "y", "x"), ("x", "y", "tie")], k=16, initial=1500)
    e = 1 / (1 + 10 ** ((1492 - 1508) / 400))
    assert r["x"] == pytest.approx(1508 + 16 * (0.5 - e))


def test_elo_zero_sum_and_order_dependent():
    rng = np.random.default_rng(0)
    names = ["a", "b", "c", "d"]
    matches = []
    for _ in range(60):
        x, y = rng.choice(names, size=2, replace=False)
        matches.append((str(x), str(y), str(rng.choice([x, y, "tie"]))))
    r = sub.elo_ratings(matches)
    assert sum(r.values()) == pytest.approx(1000 * len(r))
    assert sub.elo_ratings(matches) == r
    assert sub.elo_ratings(matches[::-1]) != r  # Elo depends on match order; that's why BT is used for leaderboards
    assert sub.elo_ratings([]) == {}


def test_bradley_terry_two_players_closed_form():
    matches = [("a", "b", "a")] * 3 + [("b", "a", "b")]
    p = sub.bradley_terry(matches)
    assert p["a"] == pytest.approx(0.75, abs=1e-6) and p["b"] == pytest.approx(0.25, abs=1e-6)
    p = sub.bradley_terry([("a", "b", "a"), ("a", "b", "tie")])
    assert p["a"] / p["b"] == pytest.approx(3.0, rel=1e-6)  # wins 1.5 vs 0.5


def test_bradley_terry_satisfies_score_equations():
    rng = np.random.default_rng(1)
    true = {"m0": 4.0, "m1": 2.0, "m2": 1.0, "m3": 0.5}
    names = list(true)
    matches = []
    for _ in range(400):
        x, y = rng.choice(names, size=2, replace=False)
        x, y = str(x), str(y)
        matches.append((x, y, x if rng.random() < true[x] / (true[x] + true[y]) else y))
    p = sub.bradley_terry(matches)
    assert set(p) == set(names)
    assert sum(p.values()) == pytest.approx(1.0)
    # At the maximum-likelihood fit, each player's actual wins equal its expected wins.
    for i in names:
        wins = sum(1 for m in matches if m[2] == i)
        expected = sum(p[i] / (p[i] + p[o]) for x, y, _ in matches if i in (x, y) for o in [y if x == i else x])
        assert wins == pytest.approx(expected, rel=1e-6)
    assert sorted(names, key=p.get, reverse=True) == names


def test_cohens_kappa_known_values():
    a = ["yes"] * 25 + ["no"] * 25
    b = ["yes"] * 20 + ["no"] * 5 + ["yes"] * 10 + ["no"] * 15
    # p_o = 0.7, p_e = 0.5*0.6 + 0.5*0.4 = 0.5
    assert sub.cohens_kappa(a, b) == pytest.approx(0.4)
    assert sub.cohens_kappa(["x", "y", "z"], ["x", "y", "z"]) == pytest.approx(1.0)
    assert sub.cohens_kappa(["a", "b", "a", "b"], ["b", "a", "b", "a"]) == pytest.approx(-1.0)


def test_cohens_kappa_corrects_for_chance():
    # A judge that says "a" 90% of the time agrees with a similar human 82% of the time by pure chance.
    judge = ["a"] * 90 + ["b"] * 10
    human = ["a"] * 81 + ["b"] * 9 + ["a"] * 9 + ["b"] * 1
    assert sub.cohens_kappa(judge, human) == pytest.approx(0.0, abs=1e-12)
    assert sub.cohens_kappa(["a"] * 5, ["a"] * 5) == 1.0
    with pytest.raises(ValueError):
        sub.cohens_kappa(["a"], ["a", "b"])
    with pytest.raises(ValueError):
        sub.cohens_kappa([], [])
