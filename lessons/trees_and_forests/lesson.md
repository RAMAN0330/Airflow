# Decision Trees & Random Forests

A decision tree is a flowchart learned from data. Each internal node asks "is `xⱼ ≤ t`?", each leaf
answers with a class, and a prediction walks from the root to a leaf. Trees need no feature scaling and
handle non-linear boundaries naturally. A single deep tree also overfits badly, which is where forests
come in.

## 1. Impurity: how mixed is a node?

With `p_k` the fraction of rows in class `k`:

```
Gini(y)    = 1 − Σ p_k²            # 0 when pure, 0.5 for a 50/50 binary node
Entropy(y) = −Σ p_k · log2(p_k)    # 0 when pure, 1 bit for a 50/50 binary node
```

Gini is the chance that two labels drawn at random disagree. Entropy is the information-theoretic cost
of encoding a label, used by Quinlan's ID3. They usually pick the same splits, and Gini skips the log.

## 2. Information gain

A split sends rows with `xⱼ ≤ t` left and the rest right. Its quality is the drop in impurity:

```
gain = H(parent) − (n_L / n)·H(left) − (n_R / n)·H(right)
```

The weights matter. Average the children equally and a split that peels off one pure row looks great:
the tiny child scores 0 and drags the average down, though almost nothing was separated.

## 3. Greedy split search

Finding the optimal tree is NP-hard, so trees are grown greedily, one best split at a time:

```python
for j in range(n_features):
    values = np.unique(X[:, j])
    for t in (values[:-1] + values[1:]) / 2:   # midpoints between neighbours
        left = X[:, j] <= t
        ...                                     # keep the highest gain
```

Only midpoints between distinct values matter: any threshold between the same two neighbours gives the
same partition. Use the same `≤` rule in training and prediction. Switching to `<` in one place sends
boundary values down the wrong branch.

## 4. When to stop

Grown until every leaf is pure, a tree memorizes the training set, noise included. Pre-pruning stops early:

| Rule | Effect |
|---|---|
| `max_depth` | at most this many questions from root to leaf |
| `min_samples_split` | don't split nodes with fewer rows than this |
| no positive gain | the node is pure, or its rows are identical |

A leaf predicts its majority class. Deep trees have **low bias and high variance**: a small change in the
data can change the first split and therefore the whole tree.

## 5. Bagging: averaging away variance

Breiman's **bagging** (bootstrap aggregating) turns this instability into an advantage. Train `B` trees,
each on a **bootstrap sample** of `n` rows drawn with replacement, and let them vote:

```python
rng = np.random.default_rng(seed)
for _ in range(n_trees):
    idx = rng.integers(0, n, size=n)    # with replacement
    trees.append(Tree().fit(X[idx], y[idx]))
```

A bootstrap sample contains about `1 − 1/e ≈ 63.2%` of the distinct rows. The remaining ~36.8%
"out-of-bag" rows give each tree a free validation set. Averaging many high-variance, roughly
independent models cuts the variance without raising the bias much.

## 6. Random forests

Bagged trees trained on the same strong features end up looking alike, and correlated votes average
poorly. A **random forest** also considers only a random subset of features at each split, which
decorrelates the trees. In the exercise you'll build the bagging half with a seeded rng, so every result
is reproducible and testable.
