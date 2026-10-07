"""Decision trees from impurity up, then bagged trees voting as a random forest. NumPy only."""
import numpy as np


def gini(y):
    y = np.asarray(y)
    if y.size == 0:
        return 0.0
    p = np.unique(y, return_counts=True)[1] / y.size
    return float(1.0 - np.sum(p * p))


def entropy(y):
    y = np.asarray(y)
    if y.size == 0:
        return 0.0
    p = np.unique(y, return_counts=True)[1] / y.size
    return float(-np.sum(p * np.log2(p)))


def best_split(X, y, criterion="gini"):
    impurity = gini if criterion == "gini" else entropy
    X = np.asarray(X, dtype=float)
    y = np.asarray(y)
    n = len(y)
    parent = impurity(y)
    best, best_gain = None, 0.0
    for j in range(X.shape[1]):
        values = np.unique(X[:, j])
        for threshold in (values[:-1] + values[1:]) / 2:
            left = X[:, j] <= threshold
            n_left = int(left.sum())
            child = (n_left * impurity(y[left]) + (n - n_left) * impurity(y[~left])) / n
            gain = parent - child
            if gain > best_gain + 1e-12:
                best, best_gain = (j, float(threshold), float(gain)), gain
    return best


def _majority(y):
    return int(np.argmax(np.bincount(y)))


class DecisionTreeClassifier:
    def __init__(self, max_depth=None, min_samples_split=2, criterion="gini"):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.criterion = criterion

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        self.depth_ = 0
        self.tree_ = self._grow(X, y, 0)
        return self

    def _grow(self, X, y, depth):
        self.depth_ = max(self.depth_, depth)
        leaf = {"leaf": True, "value": _majority(y)}
        if (self.max_depth is not None and depth >= self.max_depth) or len(y) < self.min_samples_split:
            return leaf
        split = best_split(X, y, self.criterion)
        if split is None:
            return leaf
        j, threshold, _ = split
        left = X[:, j] <= threshold
        return {"leaf": False, "feature": j, "threshold": threshold,
                "left": self._grow(X[left], y[left], depth + 1),
                "right": self._grow(X[~left], y[~left], depth + 1)}

    def _predict_one(self, x):
        node = self.tree_
        while not node["leaf"]:
            node = node["left"] if x[node["feature"]] <= node["threshold"] else node["right"]
        return node["value"]

    def predict(self, X):
        X = np.asarray(X, dtype=float)
        return np.array([self._predict_one(x) for x in X], dtype=int)


def bootstrap_sample(n, rng):
    return rng.integers(0, n, size=n)


class RandomForestClassifier:
    def __init__(self, n_trees=10, max_depth=None, min_samples_split=2, criterion="gini", seed=0):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.criterion = criterion
        self.seed = seed

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        y = np.asarray(y, dtype=int)
        rng = np.random.default_rng(self.seed)
        self.trees_ = []
        for _ in range(self.n_trees):
            idx = bootstrap_sample(len(y), rng)
            tree = DecisionTreeClassifier(self.max_depth, self.min_samples_split, self.criterion)
            self.trees_.append(tree.fit(X[idx], y[idx]))
        return self

    def predict(self, X):
        votes = np.stack([tree.predict(X) for tree in self.trees_])  # (n_trees, m)
        return np.array([_majority(col) for col in votes.T], dtype=int)
