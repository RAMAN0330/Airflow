"""Pytest plugin copied into each sandbox as conftest.py.

Records one structured row per hidden test and writes them to the JSON file
named by GRADER_RESULTS_PATH when the session ends.
"""
import json
import os

import pytest

_rows = []
_collection_errors = []


@pytest.hookimpl(wrapper=True)
def pytest_runtest_makereport(item, call):
    report = yield
    if call.excinfo is not None:
        report.exc_type = call.excinfo.typename
        msg = str(call.excinfo.value).strip()
        report.exc_msg = msg.splitlines()[0][:500] if msg else call.excinfo.typename
    return report


def pytest_runtest_logreport(report):
    # One row per test: the call phase, or setup if it failed before the call.
    if report.when == "call" or (report.when == "setup" and not report.passed):
        _rows.append({
            "name": report.nodeid.split("::", 1)[-1],
            "outcome": report.outcome,
            "error_type": getattr(report, "exc_type", None),
            "message": getattr(report, "exc_msg", None),
            "stdout": report.capstdout,
            "duration_ms": round(report.duration * 1000, 2),
        })


def pytest_collectreport(report):
    if report.failed:
        _collection_errors.append(report.longreprtext[-4000:])


def pytest_sessionfinish(session, exitstatus):
    path = os.environ.get("GRADER_RESULTS_PATH")
    if path:
        with open(path, "w") as f:
            json.dump({"tests": _rows, "collection_errors": _collection_errors}, f)
