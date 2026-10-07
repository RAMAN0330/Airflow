"""LLM-as-a-judge harness: order-swapped pairwise judging, win rates, Elo, Bradley-Terry and Cohen's kappa."""
from collections import Counter

import numpy as np


def judge_pair(judge, question: str, answer_a: str, answer_b: str) -> str:
    """Ask the judge in both orders; return 'a' or 'b' only if both agree, else 'tie'."""
    raise NotImplementedError


def pairwise_eval(judge, questions: list, answers_a: list, answers_b: list) -> list:
    """judge_pair for every question; returns the list of outcomes in order."""
    raise NotImplementedError


def win_rate(outcomes: list) -> float:
    """Win rate of model a: (wins + 0.5 * ties) / n."""
    raise NotImplementedError


def elo_ratings(matches: list, k: float = 32.0, initial: float = 1000.0) -> dict:
    """Sequential Elo updates over (player_x, player_y, winner) with winner = x, y or 'tie'."""
    raise NotImplementedError


def bradley_terry(matches: list, max_iter: int = 1000, tol: float = 1e-10) -> dict:
    """Bradley-Terry strengths (summing to 1) fitted with Hunter's MM algorithm. Ties count half to each."""
    raise NotImplementedError


def cohens_kappa(labels_a: list, labels_b: list) -> float:
    """Chance-corrected agreement between two raters labelling the same items."""
    raise NotImplementedError
