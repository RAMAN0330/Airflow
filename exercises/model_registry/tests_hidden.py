"""Hidden validation suite for model_registry."""
import hashlib
import json

import pytest

import submission as sub


@pytest.fixture
def reg():
    return sub.ModelRegistry()


def test_log_run_ids_and_storage(reg):
    params, metrics = {"lr": 0.1, "depth": 4}, {"auc": 0.81}
    rid = reg.log_run(params, metrics)
    assert rid == "run-1" and reg.log_run({}, {}) == "run-2"
    params["lr"] = 999
    metrics["auc"] = 0.0
    run = reg.get_run("run-1")
    assert run["params"] == {"lr": 0.1, "depth": 4} and run["metrics"] == {"auc": 0.81}, "history must be immutable"
    assert run["run_id"] == "run-1" and len(run["fingerprint"]) == 64


def test_fingerprint_is_order_independent():
    a = sub.ModelRegistry.fingerprint({"lr": 0.1, "layers": [64, 32], "opt": {"name": "adam", "beta": 0.9}})
    b = sub.ModelRegistry.fingerprint({"opt": {"beta": 0.9, "name": "adam"}, "layers": [64, 32], "lr": 0.1})
    assert a == b
    assert a != sub.ModelRegistry.fingerprint({"lr": 0.2, "layers": [64, 32], "opt": {"name": "adam", "beta": 0.9}})
    expected = hashlib.sha256(json.dumps({"x": 1}, sort_keys=True, separators=(",", ":")).encode()).hexdigest()
    assert sub.ModelRegistry.fingerprint({"x": 1}) == expected


def test_duplicate_runs_are_detectable(reg):
    reg.log_run({"lr": 0.1, "d": 3}, {"auc": 0.7})
    reg.log_run({"lr": 0.2}, {"auc": 0.8})
    reg.log_run({"d": 3, "lr": 0.1}, {"auc": 0.71})
    assert reg.duplicate_runs() == [["run-1", "run-3"]]


def test_best_run_max_and_min(reg):
    reg.log_run({"m": "a"}, {"auc": 0.80, "loss": 0.50})
    reg.log_run({"m": "b"}, {"auc": 0.91, "loss": 0.42})
    reg.log_run({"m": "c"}, {"loss": 0.30})
    reg.log_run({"m": "d"}, {"auc": 0.91, "loss": 0.45})
    assert reg.best_run("auc") == "run-2", "ties go to the earliest run; runs without the metric are skipped"
    assert reg.best_run("loss", mode="min") == "run-3"


def test_register_versions_per_model(reg):
    r = reg.log_run({}, {})
    assert reg.register(r, "churn") == 1
    assert reg.register(r, "churn") == 2
    assert reg.register(r, "fraud") == 1
    assert reg.stage("churn", 2) == "None"
    assert reg.get_production("churn") is None


def test_promotion_archives_previous_production(reg):
    r = reg.log_run({}, {})
    v1, v2 = reg.register(r, "churn"), reg.register(r, "churn")
    reg.transition("churn", v1, "Production")
    reg.transition("churn", v2, "Staging")
    assert (reg.stage("churn", v1), reg.stage("churn", v2)) == ("Production", "Staging")
    reg.transition("churn", v2, "Production")
    assert reg.get_production("churn") == v2
    assert reg.stage("churn", v1) == "Archived", "only one version may be in Production"


def test_invalid_transitions(reg):
    r = reg.log_run({}, {})
    v = reg.register(r, "churn")
    with pytest.raises(ValueError):
        reg.transition("churn", v, "Prod")
    with pytest.raises(KeyError):
        reg.transition("churn", 42, "Staging")
    with pytest.raises(KeyError):
        reg.transition("nope", 1, "Staging")


def test_rollback_restores_previous_production(reg):
    r = reg.log_run({}, {})
    v1, v2, v3 = (reg.register(r, "churn") for _ in range(3))
    reg.transition("churn", v1, "Production")
    reg.transition("churn", v2, "Production")
    reg.transition("churn", v3, "Production")
    assert reg.rollback("churn") == v2
    assert reg.get_production("churn") == v2 and reg.stage("churn", v3) == "Archived"
    assert reg.rollback("churn") == v1
    assert reg.get_production("churn") == v1


def test_rollback_without_history_fails(reg):
    r = reg.log_run({}, {})
    v = reg.register(r, "churn")
    with pytest.raises(ValueError):
        reg.rollback("churn")
    reg.transition("churn", v, "Production")
    with pytest.raises(ValueError):
        reg.rollback("churn")
