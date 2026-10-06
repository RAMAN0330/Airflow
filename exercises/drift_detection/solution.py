"""Reference solution — never shipped to learners."""
import numpy as np


def psi(reference, current, bins=10, eps=1e-6):
    ref = np.asarray(reference, dtype=float)
    cur = np.asarray(current, dtype=float)
    interior = np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1)[1:-1]))
    edges = np.concatenate([[-np.inf], interior, [np.inf]])
    r = np.clip(np.histogram(ref, edges)[0] / ref.size, eps, None)
    c = np.clip(np.histogram(cur, edges)[0] / cur.size, eps, None)
    return float(np.sum((c - r) * np.log(c / r)))


def ks_statistic(a, b):
    a = np.sort(np.asarray(a, dtype=float))
    b = np.sort(np.asarray(b, dtype=float))
    xs = np.concatenate([a, b])
    fa = np.searchsorted(a, xs, side="right") / a.size
    fb = np.searchsorted(b, xs, side="right") / b.size
    return float(np.max(np.abs(fa - fb)))


def psi_level(value):
    if value < 0.1:
        return "none"
    return "moderate" if value < 0.25 else "major"


def drift_report(reference, current, psi_threshold=0.2, bins=10):
    features = {}
    for name, ref in reference.items():
        if name not in current:
            raise ValueError(f"feature {name!r} missing from current data")
        p = psi(ref, current[name], bins=bins)
        features[name] = {"psi": p, "ks": ks_statistic(ref, current[name]), "drifted": p >= psi_threshold}
    return {"features": features, "drifted_features": sorted(n for n, f in features.items() if f["drifted"])}
