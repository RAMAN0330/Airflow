"""Decision trees from impurity up, then bagged trees voting as a random forest. NumPy only."""
import numpy as np


def gini(y):
    """Gini impurity 1 - sum_k p_k^2 of a 1-D label array, as a float. Empty input -> 0.0."""
    raise NotImplementedError


def entropy(y):
    """Shannon entropy -sum_k p_k log2 p_k of a 1-D label array, in bits, as a float. Empty input -> 0.0."""
    raise NotImplementedError


def best_split(X, y, criterion="gini"):
    """Exhaustive search for the split with the highest information gain.

    Candidate thresholds for feature j are midpoints between consecutive sorted unique values of X[:, j];
    a row goes left when X[i, j] <= threshold. Gain = parent impurity - size-weighted child impurity.
    Returns (feature, threshold, gain), or None if no split has a positive gain.
    Ties: keep the first one found (lowest feature index, then lowest threshold).
    """
    raise NotImplementedError


class DecisionTreeClassifier:
    def __init__(self, max_depth=None, min_samples_split=2, criterion="gini"):
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.criterion = criterion

    def fit(self, X, y):
        """Grow the tree recursively and return self. Sets self.depth_ (a root-only tree has depth 0).

        A node becomes a leaf (predicting its majority class, ties -> smallest label) when its depth
        equals max_depth, it has fewer than min_samples_split rows, or best_split returns None.
        """
        raise NotImplementedError

    def predict(self, X):
        """Return an int array of predicted labels, shape (m,)."""
        raise NotImplementedError


def bootstrap_sample(n, rng):
    """Return n row indices drawn uniformly WITH replacement from range(n), using rng.integers."""
    raise NotImplementedError


class RandomForestClassifier:
    def __init__(self, n_trees=10, max_depth=None, min_samples_split=2, criterion="gini", seed=0):
        self.n_trees = n_trees
        self.max_depth = max_depth
        self.min_samples_split = min_samples_split
        self.criterion = criterion
        self.seed = seed

    def fit(self, X, y):
        """Train n_trees trees, each on its own bootstrap sample, and store them in self.trees_.

        Create ONE rng = np.random.default_rng(self.seed) and call bootstrap_sample(n, rng) once per tree,
        in order. Return self.
        """
        raise NotImplementedError

    def predict(self, X):
        """Majority vote over the trees' predictions (ties -> smallest label)."""
        raise NotImplementedError
