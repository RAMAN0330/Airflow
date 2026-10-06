"""Hidden validation suite for dag_scheduler."""
import pytest

import submission as sub

DAG = {
    "report": ["join"],
    "extract_orders": [],
    "join": ["extract_orders", "extract_customers"],
    "train": ["join"],
    "extract_customers": [],
}


def assert_valid_order(dag, order):
    assert sorted(order) == sorted(dag), "every task must appear exactly once"
    pos = {t: i for i, t in enumerate(order)}
    for t, ups in dag.items():
        for u in ups:
            assert pos[u] < pos[t], f"{u} must run before {t}"


def test_topological_order_respects_dependencies():
    assert_valid_order(DAG, sub.topological_order(DAG))
    diamond = {"a": [], "b": ["a"], "c": ["a"], "d": ["b", "c"]}
    assert_valid_order(diamond, sub.topological_order(diamond))


def test_topological_order_is_deterministic():
    assert sub.topological_order(DAG) == ["extract_customers", "extract_orders", "join", "report", "train"]
    assert sub.topological_order({"z": [], "y": [], "x": []}) == ["x", "y", "z"]


def test_cycle_is_detected():
    with pytest.raises(ValueError):
        sub.topological_order({"a": ["c"], "b": ["a"], "c": ["b"], "d": []})
    with pytest.raises(ValueError):
        sub.topological_order({"a": ["a"]})


def test_unknown_dependency_is_rejected():
    with pytest.raises(ValueError):
        sub.topological_order({"a": ["missing"]})


def test_execution_layers():
    assert sub.execution_layers(DAG) == [["extract_customers", "extract_orders"], ["join"], ["report", "train"]]
    assert sub.execution_layers({"a": [], "b": ["a"], "c": [], "d": ["b", "c"]}) == [["a", "c"], ["b"], ["d"]]


def recorder(log, fail_times=None):
    fail_times = dict(fail_times or {})

    def make(name):
        def run():
            log.append(name)
            if fail_times.get(name, 0) > 0:
                fail_times[name] -= 1
                raise RuntimeError(f"{name} failed")
        return run
    return make


def test_run_dag_success_order():
    log = []
    make = recorder(log)
    res = sub.run_dag(DAG, {t: make(t) for t in DAG})
    assert all(v == {"state": "success", "attempts": 1} for v in res.values())
    assert_valid_order(DAG, log)


def test_retries_recover_flaky_task():
    log = []
    make = recorder(log, {"join": 2})
    res = sub.run_dag(DAG, {t: make(t) for t in DAG}, max_retries=2)
    assert res["join"] == {"state": "success", "attempts": 3}
    assert res["train"]["state"] == "success"


def test_failure_propagates_downstream():
    log = []
    make = recorder(log, {"join": 99})
    res = sub.run_dag(DAG, {t: make(t) for t in DAG}, max_retries=1)
    assert res["join"] == {"state": "failed", "attempts": 2}
    assert res["train"] == {"state": "upstream_failed", "attempts": 0}
    assert res["report"] == {"state": "upstream_failed", "attempts": 0}
    assert "train" not in log and "report" not in log, "downstream tasks must not run"


def test_independent_branch_still_runs():
    dag = {"a": [], "a_child": ["a"], "b": [], "b_child": ["b"], "grandchild": ["a_child"]}
    log = []
    make = recorder(log, {"a": 99})
    res = sub.run_dag(dag, {t: make(t) for t in dag}, max_retries=0)
    assert res["a"]["state"] == "failed" and res["grandchild"]["state"] == "upstream_failed"
    assert res["b"]["state"] == "success" and res["b_child"]["state"] == "success"
