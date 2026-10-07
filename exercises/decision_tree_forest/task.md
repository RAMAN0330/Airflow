# Decision Trees & Random Forests from Scratch

A decision tree asks a sequence of yes/no questions ("is `x₂ ≤ 0.37`?") and answers with the majority class
of the training rows that end up in the same leaf. You'll build one from the impurity measures up, then train
many trees on bootstrap samples and let them vote. NumPy only: no `sklearn`, `scipy` or `pandas`.

Labels are non-negative integers (`0, 1, 2, …`).

## 1. Impurity: `gini(y)` and `entropy(y)`

With `p_k` the fraction of rows in class `k`:

```
Gini(y)    = 1 − Σ p_k²
Entropy(y) = −Σ p_k · log2(p_k)       # bits
```

Both are 0 for a pure node. Return a Python `float`, and `0.0` for an empty array.

## 2. `best_split(X, y, criterion="gini")`

Exhaustive search over every feature `j` and every candidate threshold `t`:

- **Candidates**: midpoints between consecutive sorted unique values of `X[:, j]`. For values
  `[1, 2, 4]` that's `[1.5, 3.0]`.
- **Rule**: a row goes **left** when `X[i, j] <= t`, otherwise right.
- **Information gain**, with each child weighted by its share of the rows:

```
gain = H(parent) − (n_left / n) · H(left) − (n_right / n) · H(right)
```

Return `(feature, threshold, gain)` for the largest gain, or `None` if no split has a positive gain
(a pure node, or rows that are identical on every feature). Ties go to the first split found, scanning
features in index order and thresholds in increasing order.

## 3. `DecisionTreeClassifier(max_depth=None, min_samples_split=2, criterion="gini")`

`fit(X, y)` grows the tree recursively from the root (depth 0) and returns `self`. A node becomes a
**leaf** when any of these holds:

1. its depth equals `max_depth` (when `max_depth` is not `None`);
2. it has fewer than `min_samples_split` rows;
3. `best_split` returns `None`.

A leaf predicts the majority class of its rows; ties go to the smallest label (`np.bincount(y).argmax()`
does exactly this). After `fit`, `self.depth_` holds the depth of the deepest node, so a root-only tree has
`depth_ == 0`.

`predict(X)` walks each row down the tree using the same `<=` rule and returns an `int` array of shape `(m,)`.

## 4. `bootstrap_sample(n, rng)`

Return `rng.integers(0, n, size=n)`: `n` row indices drawn **with replacement**.

## 5. `RandomForestClassifier(n_trees=10, max_depth=None, min_samples_split=2, criterion="gini", seed=0)`

- `fit(X, y)`: create **one** `rng = np.random.default_rng(seed)`. For each of the `n_trees` trees, in order,
  draw `idx = bootstrap_sample(n, rng)` and fit a `DecisionTreeClassifier` (with the forest's settings) on
  `X[idx], y[idx]`. Store the fitted trees in `self.trees_` and return `self`.
- `predict(X)`: each tree votes; return the most common label per row (ties to the smallest label).

Breiman's random forests also pick a random subset of features at every split. Here we keep only the
bagging half of the idea so results are easy to verify.

## Example

```python
>>> X = np.array([[1.0], [2.0], [3.0], [4.0]]); y = np.array([0, 0, 1, 1])
>>> best_split(X, y)
(0, 2.5, 0.5)
>>> DecisionTreeClassifier().fit(X, y).predict(np.array([[2.5], [3.1]]))
array([0, 1])
```

Never modify the input arrays.

## What the hidden tests check

1. **Impurity**: known values for empty, pure, balanced and three-class inputs (entropy in bits).
2. **Splitting**: midpoint thresholds, size-weighted child impurity, agreement with a brute-force search
   for both criteria, and `None` when nothing can be gained.
3. **Tree**: an unrestricted tree memorizes distinct training rows; `max_depth`, `min_samples_split` and
   majority tie-breaking behave as specified; a value equal to a threshold goes left.
4. **Forest**: bootstrap indices come from the seeded `rng` in order, the same seed gives the same forest,
   and `predict` is the per-row majority vote of `trees_`.
