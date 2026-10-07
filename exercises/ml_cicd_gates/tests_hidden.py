"""Hidden validation suite for ml_cicd_gates."""
import copy
import hashlib
import math

import numpy as np
import pytest

import submission as sub

rng = np.random.default_rng(7)


def ref_bucket(request_id, buckets=10_000):
    return int.from_bytes(hashlib.sha256(str(request_id).encode("utf-8")).digest()[:8], "big") % buckets


def model(auc, slices=None, latencies=None):
    out = {"metrics": {"auc": auc}, "slices": {k: {"auc": v} for k, v in (slices or {}).items()}}
    if latencies is not None:
        out["latencies_ms"] = latencies
    return out


PROD = model(0.875, {"desktop": 0.875, "mobile": 0.75, "tablet": 0.625})


def test_percentile_nearest_rank():
    assert sub.percentile_nearest_rank([15, 20, 35, 40, 50], 30) == 20.0
    assert sub.percentile_nearest_rank([15, 20, 35, 40, 50], 100) == 50.0
    assert sub.percentile_nearest_rank([15, 20, 35, 40, 50], 0) == 15.0
    assert sub.percentile_nearest_rank(list(range(1, 21)), 95) == 19.0
    for n in (1, 7, 20, 101, 1000):
        x = rng.exponential(20, n)
        for q in (50, 90, 95, 99):
            got = sub.percentile_nearest_rank(x, q)
            assert isinstance(got, float)
            assert got in x
            assert got == float(np.percentile(x, q, method="inverted_cdf"))
    with pytest.raises(ValueError):
        sub.percentile_nearest_rank([], 95)


def test_gate_overall_checks():
    good = model(0.9, {"desktop": 0.9, "mobile": 0.75, "tablet": 0.625})
    assert sub.validation_gate(good, PROD, max_regression=0.0) == {"passed": True, "failures": [], "latency_ms": None}
    # exactly at the tolerance passes; one step beyond fails
    edge = model(0.75, {"desktop": 0.75, "mobile": 0.625, "tablet": 0.5})
    assert sub.validation_gate(edge, PROD, max_regression=0.125)["passed"] is True
    r = sub.validation_gate(edge, PROD, max_regression=0.0625, slice_max_regression=0.125)
    assert r["passed"] is False and r["failures"] == ["regression:auc"]
    r = sub.validation_gate(good, PROD, max_regression=0.0, min_metric=0.95)
    assert r["passed"] is False and r["failures"] == ["min_metric:auc"]
    r = sub.validation_gate(model(0.5, {"desktop": 0.9, "mobile": 0.9, "tablet": 0.9}), PROD, min_metric=0.6)
    assert r["failures"] == ["min_metric:auc", "regression:auc"]


def test_gate_catches_slice_regression():
    # Overall AUC improves, but the mobile slice collapses: the gate must still fail.
    cand = model(0.9, {"desktop": 0.95, "mobile": 0.5, "tablet": 0.625})
    r = sub.validation_gate(cand, PROD, max_regression=0.01)
    assert r["passed"] is False
    assert r["failures"] == ["slice_regression:mobile"]
    # a looser slice tolerance lets it through
    assert sub.validation_gate(cand, PROD, max_regression=0.01, slice_max_regression=0.25)["passed"] is True
    # several slices, reported in sorted order; a missing slice is a failure too
    cand = model(0.9, {"tablet": 0.25, "desktop": 0.5})
    r = sub.validation_gate(cand, PROD, max_regression=0.01)
    assert r["failures"] == ["slice_regression:desktop", "missing_slice:mobile", "slice_regression:tablet"]


def test_gate_latency_budget_uses_percentile():
    lat = [10.0] * 90 + [40.0] * 5 + [500.0] * 5  # p95 (nearest rank) = 40, mean = 36.5, max = 500
    cand = model(0.9, {"desktop": 0.9, "mobile": 0.75, "tablet": 0.625}, latencies=lat)
    r = sub.validation_gate(cand, PROD, latency_budget_ms=40.0)
    assert r == {"passed": True, "failures": [], "latency_ms": 40.0}
    r = sub.validation_gate(cand, PROD, latency_budget_ms=39.0)
    assert r["passed"] is False and r["failures"] == ["latency"] and r["latency_ms"] == 40.0
    r = sub.validation_gate(cand, PROD, latency_budget_ms=100.0, latency_percentile=99)
    assert r["failures"] == ["latency"] and r["latency_ms"] == 500.0
    shuffled = list(rng.permutation(lat))
    cand["latencies_ms"] = shuffled
    before = copy.deepcopy(cand)
    assert sub.validation_gate(cand, PROD, latency_budget_ms=40.0)["latency_ms"] == 40.0
    assert cand == before


def test_bucket_is_stable_sha256():
    ids = ["req-1", "req-2", "user:42", "", "ünïcode-ü", 12345]
    for rid in ids:
        assert sub.bucket(rid) == ref_bucket(rid)
        assert sub.bucket(rid, buckets=100) == ref_bucket(rid, 100)
    # known value, identical in every process and on every machine
    assert sub.bucket("req-1") == ref_bucket("req-1")
    assert all(0 <= sub.bucket(f"r{i}") < 10_000 for i in range(500))


def test_route_percentages_and_sticky():
    ids = [f"req-{i}" for i in range(20_000)]
    assert all(sub.route(r, 0) == "production" for r in ids[:500])
    assert all(sub.route(r, 100) == "canary" for r in ids[:500])
    for pct in (1, 5, 2.5, 25):
        got = [sub.route(r, pct) for r in ids]
        expected = ["canary" if ref_bucket(r) < pct * 100 else "production" for r in ids]
        assert got == expected
        assert abs(got.count("canary") / len(ids) - pct / 100) < 0.01
    # sticky: ramping up never moves a canary user back to production
    at5 = {r for r in ids if sub.route(r, 5) == "canary"}
    at25 = {r for r in ids if sub.route(r, 25) == "canary"}
    assert at5 <= at25
    assert [sub.route("req-7", 10) for _ in range(5)] == [sub.route("req-7", 10)] * 5
    for bad in (-1, 100.5):
        with pytest.raises(ValueError):
            sub.route("req-1", bad)


def test_canary_decision():
    base = {"requests": 10_000, "errors": 100}  # 1%
    assert sub.canary_decision(base, {"requests": 2_000, "errors": 30}) == "promote"  # 1.5%
    assert sub.canary_decision(base, {"requests": 2_000, "errors": 80}) == "rollback"  # 4%
    assert sub.canary_decision(base, {"requests": 2_000, "errors": 40}, max_increase=0.01) == "promote"  # +1.0% exactly
    assert sub.canary_decision(base, {"requests": 2_000, "errors": 41}, max_increase=0.01) == "rollback"
    assert sub.canary_decision(base, {"requests": 2_000, "errors": 30}, max_increase=0.001) == "rollback"
    with pytest.raises(ValueError):
        sub.canary_decision(base, {"requests": 10, "errors": 11})


def test_canary_waits_for_min_samples():
    base = {"requests": 10_000, "errors": 100}
    # 2 errors in 20 requests looks like 10%, but 20 requests prove nothing yet
    assert sub.canary_decision(base, {"requests": 20, "errors": 2}) == "continue"
    assert sub.canary_decision(base, {"requests": 499, "errors": 0}) == "continue"
    assert sub.canary_decision(base, {"requests": 500, "errors": 0}) == "promote"
    assert sub.canary_decision({"requests": 100, "errors": 0}, {"requests": 5_000, "errors": 500}) == "continue"
    assert sub.canary_decision(base, {"requests": 50, "errors": 40}, min_samples=50) == "rollback"


def _ident_model(calls):
    def predict(X):
        assert isinstance(X, np.ndarray) and X.ndim == 2 and X.shape[1] == 2
        calls.append(X.copy())
        return X[:, 0] * 1000 + X[:, 1]
    return predict


def test_server_batches_preserve_order():
    calls = []
    server = sub.ModelServer(_ident_model(calls), {"user_id": "int", "score": "float"}, max_batch_size=3)
    reqs = [{"user_id": i, "score": i / 4} for i in range(8)]
    reqs[2] = {"user_id": 2}  # invalid, in the middle
    reqs[5] = {"user_id": "5", "score": 1.0}  # invalid type
    out = server.predict(reqs)
    assert len(out) == len(reqs)
    for i, res in enumerate(out):
        if i in (2, 5):
            assert res["ok"] is False and isinstance(res["error"], str)
        else:
            assert res == {"ok": True, "prediction": pytest.approx(i * 1000 + i / 4)}
    assert server.batch_sizes == [3, 3]
    assert [c[:, 0].tolist() for c in calls] == [[0, 1, 3], [4, 6, 7]]
    # columns follow schema order, not request key order
    out = server.predict([{"score": 0.5, "user_id": 9}])
    assert out == [{"ok": True, "prediction": pytest.approx(9000.5)}]
    assert server.batch_sizes == [3, 3, 1]
    assert server.predict([]) == [] and server.batch_sizes == [3, 3, 1]
    big = sub.ModelServer(_ident_model([]), {"user_id": "int", "score": "float"}, max_batch_size=4)
    out = big.predict([{"user_id": i, "score": 0.0} for i in range(10)])
    assert [r["prediction"] for r in out] == [i * 1000 for i in range(10)]
    assert big.batch_sizes == [4, 4, 2]


def test_server_schema_validation():
    server = sub.ModelServer(lambda X: X.sum(axis=1), {"age": "int", "income": "float"}, max_batch_size=8)
    assert server.validate({"age": 30, "income": 52000.0}) is None
    assert server.validate({"age": 30, "income": 52000}) is None  # ints are fine for float features
    cases = {
        "missing": ({"age": 30}, "income"),
        "extra": ({"age": 30, "income": 1.0, "zip": 94110}, "zip"),
        "bool": ({"age": True, "income": 1.0}, "age"),
        "float_for_int": ({"age": 30.5, "income": 1.0}, "age"),
        "str": ({"age": 30, "income": "1000"}, "income"),
        "nan": ({"age": 30, "income": math.nan}, "income"),
        "inf": ({"age": 30, "income": math.inf}, "income"),
    }
    for label, (req, feature) in cases.items():
        err = server.validate(req)
        assert isinstance(err, str) and feature in err, label
    assert isinstance(server.validate([30, 1.0]), str)
    calls = []
    guarded = sub.ModelServer(_ident_model(calls), {"a": "float", "b": "float"})
    out = guarded.predict([{"a": 1.0}, None, {"a": 1.0, "b": math.nan}])
    assert [r["ok"] for r in out] == [False, False, False]
    assert calls == [] and guarded.batch_sizes == []  # the model never sees bad input
    with pytest.raises(ValueError):
        sub.ModelServer(lambda X: X, {"a": "float"}, max_batch_size=0)
    with pytest.raises(ValueError):
        sub.ModelServer(lambda X: X, {"a": "string"})
    broken = sub.ModelServer(lambda X: [1.0], {"a": "float"}, max_batch_size=4)
    with pytest.raises(RuntimeError):
        broken.predict([{"a": 1.0}, {"a": 2.0}])
