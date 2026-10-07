"""Hidden validation suite for decision_tree_forest.

Injected next to the learner's code as `submission.py` by the grader.
Never shown to the learner.
"""
import math
import re
from collections import Counter
from pathlib import Path

import numpy as np
import pytest

import submission as sub


def _ref_impurity(y, criterion):
    n = len(y)
    if n == 0:
        return 0.0
    ps = [c / n for c in Counter(y.tolist()).values()]
    if criterion == "gini":
        return 1.0 - sum(p * p for p in ps)
    return -sum(p * math.log2(p) for p in ps)


def _ref_best_split(X, y, criterion):
    n = len(y)
    parent = _ref_impurity(y, criterion)
    best, best_gain = None, 0.0
    for j in range(X.shape[1]):
        vals = sorted(set(X[:, j].tolist()))
        for a, b in zip(vals, vals[1:]):
            t = (a + b) / 2
            left = y[X[:, j] <= t]
            right = y[X[:, j] > t]
            gain = parent - (len(left) * _ref_impurity(left, criterion) + len(right) * _ref_impurity(right, criterion)) / n
            if gain > best_gain + 1e-12:
                best, best_gain = (j, t, gain), gain
    return best


def _classification_data(seed, m=120, n=3, k=3):
    rng = np.random.default_rng(seed)
    X = np.round(rng.standard_normal((m, n)), 2)
    score = X[:, 0] + 0.8 * X[:, 1] ** 2 - 0.5 * X[:, 2]
    y = np.digitize(score, np.quantile(score, np.linspace(0, 1, k + 1)[1:-1]))
    flip = rng.uniform(size=m) < 0.1
    y[flip] = rng.integers(0, k, size=flip.sum())
    return X, y.astype(int)


def _vote(col):
    return int(np.argmax(np.bincount(col)))


# ---------------------------------------------------------------- impurity

def test_impurity_known_values():
    assert sub.gini(np.array([], dtype=int)) == 0.0
    assert sub.entropy(np.array([], dtype=int)) == 0.0
    assert sub.gini(np.array([3, 3, 3])) == pytest.approx(0.0)
    assert sub.entropy(np.array([3, 3, 3])) == pytest.approx(0.0, abs=1e-12)
    assert sub.gini(np.array([0, 1, 0, 1])) == pytest.approx(0.5)
    assert sub.entropy(np.array([0, 1, 0, 1])) == pytest.approx(1.0), "entropy is measured in bits: use log2"
    y = np.array([0, 0, 1, 2])
    assert sub.gini(y) == pytest.approx(1 - (0.25 + 0.0625 + 0.0625))
    assert sub.entropy(y) == pytest.approx(1.5)
    assert isinstance(sub.gini(y), float) and isinstance(sub.entropy(y), float)


# ---------------------------------------------------------------- splitting

def test_best_split_simple_threshold():
    X = np.array([[1.0], [2.0], [3.0], [4.0]])
    y = np.array([0, 0, 1, 1])
    split = sub.best_split(X, y)
    assert split is not None, "a perfect split exists"
    j, t, gain = split
    assert j == 0
    assert t == pytest.approx(2.5), "thresholds are midpoints between consecutive unique values"
    assert gain == pytest.approx(0.5)
    _, _, gain_e = sub.best_split(X, y, criterion="entropy")
    assert gain_e == pytest.approx(1.0)


@pytest.mark.parametrize("criterion", ["gini", "entropy"])
def test_best_split_matches_brute_force(criterion):
    X, y = _classification_data(1, m=60)
    got = sub.best_split(X, y, criterion=criterion)
    ref = _ref_best_split(X, y, criterion)
    assert got is not None
    assert got[0] == ref[0], f"picked feature {got[0]}, expected {ref[0]}"
    assert got[1] == pytest.approx(ref[1])
    assert got[2] == pytest.approx(ref[2], rel=1e-9)


def test_best_split_weights_children_by_size():
    X = np.arange(8, dtype=float)[:, None]
    y = np.array([0, 0, 1, 0, 1, 1, 1, 1])
    j, t, gain = sub.best_split(X, y)
    assert t == pytest.approx(3.5), "weight each child's impurity by its share of the rows (n_child / n)"
    assert gain == pytest.approx(0.28125)


def test_best_split_no_valid_split():
    assert sub.best_split(np.array([[1.0], [2.0], [3.0]]), np.array([1, 1, 1])) is None, "a pure node can't gain"
    assert sub.best_split(np.array([[5.0, 2.0], [5.0, 2.0]]), np.array([0, 1])) is None, \
        "identical rows offer no threshold"


# ---------------------------------------------------------------- tree

def test_tree_fits_training_data():
    X, y = _classification_data(2)
    X_copy, y_copy = X.copy(), y.copy()
    tree = sub.DecisionTreeClassifier().fit(X, y)
    assert isinstance(tree, sub.DecisionTreeClassifier), "fit should return self"
    pred = np.asarray(tree.predict(X))
    assert pred.shape == (len(y),), f"predict returned shape {pred.shape}"
    # Rows are distinct, so an unrestricted tree must memorize the training set.
    assert np.array_equal(pred, y), "a fully grown tree should reach 100% training accuracy"
    np.testing.assert_array_equal(X, X_copy, err_msg="X was modified in place")
    np.testing.assert_array_equal(y, y_copy, err_msg="y was modified in place")
    src = Path(sub.__file__).read_text()
    banned = re.findall(r"\b(sklearn|scipy|torch|pandas)\b", src)
    assert not banned, f"forbidden library used: {sorted(set(banned))}"


def test_tree_respects_stopping_rules():
    X, y = _classification_data(3)
    for d in (1, 2, 3):
        tree = sub.DecisionTreeClassifier(max_depth=d).fit(X, y)
        assert tree.depth_ <= d, f"max_depth={d} but tree has depth {tree.depth_}"
    full = sub.DecisionTreeClassifier().fit(X, y)
    assert full.depth_ > 3

    stump = sub.DecisionTreeClassifier(max_depth=0).fit(X, y)
    assert stump.depth_ == 0
    majority = _vote(y)
    assert np.all(np.asarray(stump.predict(X)) == majority), "a depth-0 tree predicts the majority class"

    tie = sub.DecisionTreeClassifier(max_depth=0).fit(np.zeros((4, 1)), np.array([2, 1, 2, 1]))
    assert np.all(np.asarray(tie.predict(np.zeros((2, 1)))) == 1), "majority ties go to the smallest label"

    big = sub.DecisionTreeClassifier(min_samples_split=len(y) + 1).fit(X, y)
    assert big.depth_ == 0, "a node with fewer than min_samples_split rows must not split"
    small = sub.DecisionTreeClassifier(min_samples_split=40).fit(X, y)
    assert 0 < small.depth_ < full.depth_


def test_threshold_ties_go_left():
    X = np.array([[1.0], [2.0], [3.0], [4.0]])
    y = np.array([0, 0, 1, 1])
    tree = sub.DecisionTreeClassifier().fit(X, y)
    probe = np.array([[2.5], [2.4999], [2.5001]])
    np.testing.assert_array_equal(np.asarray(tree.predict(probe)), [0, 0, 1],
                                  err_msg="a value equal to the threshold goes LEFT (x <= threshold)")


# ---------------------------------------------------------------- forest

def test_forest_bootstrap_is_seeded():
    idx = np.asarray(sub.bootstrap_sample(50, np.random.default_rng(11)))
    np.testing.assert_array_equal(idx, np.random.default_rng(11).integers(0, 50, size=50),
                                  err_msg="draw indices with rng.integers(0, n, size=n)")
    many = np.asarray(sub.bootstrap_sample(5000, np.random.default_rng(12)))
    assert many.min() >= 0 and many.max() < 5000
    frac = len(np.unique(many)) / 5000
    assert 0.6 < frac < 0.66, f"sampling with replacement keeps ~63% unique rows, got {frac:.2f}"

    X, y = _classification_data(4, m=80)
    forest = sub.RandomForestClassifier(n_trees=5, max_depth=4, seed=3).fit(X, y)
    assert isinstance(forest, sub.RandomForestClassifier), "fit should return self"
    assert len(forest.trees_) == 5
    rng = np.random.default_rng(3)
    first = rng.integers(0, 80, size=80)
    second = rng.integers(0, 80, size=80)
    for tree, rows in zip(forest.trees_[:2], (first, second)):
        own = sub.DecisionTreeClassifier(max_depth=4).fit(X[rows], y[rows])
        np.testing.assert_array_equal(np.asarray(tree.predict(X)), np.asarray(own.predict(X)),
                                      err_msg="tree i must be trained on the i-th bootstrap sample from one seeded rng")

    again = sub.RandomForestClassifier(n_trees=5, max_depth=4, seed=3).fit(X, y)
    np.testing.assert_array_equal(np.asarray(forest.predict(X)), np.asarray(again.predict(X)),
                                  err_msg="same seed must give the same forest")


def test_forest_predicts_majority_vote():
    X, y = _classification_data(5, m=150)
    X_train, y_train, X_test = X[:100], y[:100], X[100:]
    forest = sub.RandomForestClassifier(n_trees=6, max_depth=5, seed=0).fit(X_train, y_train)
    votes = np.stack([np.asarray(t.predict(X_test)) for t in forest.trees_])
    expected = np.array([_vote(c) for c in votes.T])
    pred = np.asarray(forest.predict(X_test))
    assert pred.shape == (50,)
    np.testing.assert_array_equal(pred, expected, err_msg="predict = per-row majority vote, ties to the smallest label")
