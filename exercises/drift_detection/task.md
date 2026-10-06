# Detect Data Drift in Production

Your churn model was 91% accurate at launch and is quietly worse now. Labels arrive weeks late, so you
can't measure accuracy in real time. You *can* compare live **inputs** with the training data. When they
drift, that's your early warning.

## 1. `psi(reference, current, bins=10, eps=1e-6)`: Population Stability Index

1. **Edges** come from the reference distribution's quantiles:
   `[-inf, *np.unique(np.quantile(reference, np.linspace(0, 1, bins + 1)[1:-1])), +inf]`
2. **Proportions**: count each sample into those bins (`np.histogram`), divide by its size, then clip to at least `eps`.
3. `PSI = Σ (c − r) · ln(c / r)`

Return a Python `float`. It's always ≥ 0, and 0 when the distributions match.

## 2. `ks_statistic(a, b)`: two-sample Kolmogorov–Smirnov distance

`D = max_x |F_a(x) − F_b(x)|`, where `F` is each sample's empirical CDF, checked at every observed value.
It ranges from 0 (identical) to 1 (no overlap). It's the statistic behind `scipy.stats.ks_2samp`; implement
it with NumPy only.

## 3. `psi_level(value)`

A common rule of thumb: `"none"` below 0.1, `"moderate"` from 0.1 up to 0.25, `"major"` at 0.25 or more.

## 4. `drift_report(reference, current, psi_threshold=0.2, bins=10)`

`reference` and `current` map feature names to 1-D arrays. Return:

```python
{"features": {name: {"psi": float, "ks": float, "drifted": bool}, ...},
 "drifted_features": [sorted names where psi >= psi_threshold]}
```

A feature in `reference` that's missing from `current` raises `ValueError`.

Never modify the input arrays.
