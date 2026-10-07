"""CI/CD for models: a validation gate, a deterministic canary router, canary analysis and a batching model server."""
import hashlib
import math

import numpy as np

BUCKETS = 10_000
FEATURE_TYPES = ("int", "float")


def percentile_nearest_rank(values, q):
    data = np.sort(np.asarray(values, dtype=float).ravel())
    if data.size == 0:
        raise ValueError("no values")
    if not 0 <= q <= 100:
        raise ValueError("q must be in [0, 100]")
    rank = max(1, math.ceil(q * data.size / 100))
    return float(data[rank - 1])


def validation_gate(candidate, production, metric="auc", max_regression=0.01, min_metric=0.0,
                    slice_max_regression=None, latency_budget_ms=None, latency_percentile=95):
    tol = max_regression if slice_max_regression is None else slice_max_regression
    failures = []
    cand = candidate["metrics"][metric]
    prod = production["metrics"][metric]
    if cand < min_metric:
        failures.append(f"min_metric:{metric}")
    if prod - cand > max_regression:
        failures.append(f"regression:{metric}")
    cand_slices = candidate.get("slices", {})
    for name in sorted(production.get("slices", {})):
        if name not in cand_slices:
            failures.append(f"missing_slice:{name}")
        elif production["slices"][name][metric] - cand_slices[name][metric] > tol:
            failures.append(f"slice_regression:{name}")
    latency = None
    if latency_budget_ms is not None:
        latency = percentile_nearest_rank(candidate["latencies_ms"], latency_percentile)
        if latency > latency_budget_ms:
            failures.append("latency")
    return {"passed": not failures, "failures": failures, "latency_ms": latency}


def bucket(request_id, buckets=BUCKETS):
    digest = hashlib.sha256(str(request_id).encode("utf-8")).digest()
    return int.from_bytes(digest[:8], "big") % buckets


def route(request_id, canary_percent):
    if not 0 <= canary_percent <= 100:
        raise ValueError("canary_percent must be in [0, 100]")
    return "canary" if bucket(request_id) < canary_percent * BUCKETS / 100 else "production"


def canary_decision(baseline, canary, min_samples=500, max_increase=0.01):
    for counts in (baseline, canary):
        if counts["requests"] < 0 or not 0 <= counts["errors"] <= counts["requests"]:
            raise ValueError(f"invalid counts {counts!r}")
    if baseline["requests"] < min_samples or canary["requests"] < min_samples:
        return "continue"
    base_rate = baseline["errors"] / baseline["requests"]
    canary_rate = canary["errors"] / canary["requests"]
    return "rollback" if canary_rate - base_rate > max_increase else "promote"


class ModelServer:
    def __init__(self, predict_fn, schema, max_batch_size=32):
        if max_batch_size < 1:
            raise ValueError("max_batch_size must be >= 1")
        for name, kind in schema.items():
            if kind not in FEATURE_TYPES:
                raise ValueError(f"unsupported type {kind!r} for {name!r}")
        self.predict_fn = predict_fn
        self.schema = dict(schema)
        self.max_batch_size = max_batch_size
        self.batch_sizes = []

    def validate(self, request):
        if not isinstance(request, dict):
            return "request must be a dict"
        for name in self.schema:
            if name not in request:
                return f"missing feature {name!r}"
        for name in request:
            if name not in self.schema:
                return f"unexpected feature {name!r}"
        for name, kind in self.schema.items():
            value = request[name]
            if isinstance(value, bool):
                return f"feature {name!r} must be {kind}"
            if kind == "int" and not isinstance(value, int):
                return f"feature {name!r} must be int"
            if kind == "float" and (not isinstance(value, (int, float)) or not math.isfinite(value)):
                return f"feature {name!r} must be a finite float"
        return None

    def predict(self, requests):
        results = [None] * len(requests)
        valid = []
        for i, request in enumerate(requests):
            error = self.validate(request)
            if error is None:
                valid.append((i, [float(request[name]) for name in self.schema]))
            else:
                results[i] = {"ok": False, "error": error}
        for start in range(0, len(valid), self.max_batch_size):
            chunk = valid[start:start + self.max_batch_size]
            X = np.array([row for _, row in chunk], dtype=float).reshape(len(chunk), len(self.schema))
            preds = list(self.predict_fn(X))
            if len(preds) != len(chunk):
                raise RuntimeError(f"model returned {len(preds)} predictions for {len(chunk)} inputs")
            self.batch_sizes.append(len(chunk))
            for (i, _), pred in zip(chunk, preds):
                results[i] = {"ok": True, "prediction": float(pred)}
        return results
