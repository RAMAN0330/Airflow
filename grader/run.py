"""Grading engine: run a learner submission against an exercise's hidden tests.

Usage:
    python -m grader.run exercises/linear_regression_gd path/to/submission.py

Prints the result payload as JSON:
    {exercise_id, status, passed_tests, total_tests, score, tests[], stdout,
     stderr, duration_ms, error_tags[], remediation[]}

This is the local reference implementation of the execution plane. In
production the same steps run inside a disposable, network-less pod; here the
rlimits below stand in for the pod's cgroup limits.
"""
import argparse
import json
import os
import re
import resource
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

PLUGIN = Path(__file__).with_name("_pytest_plugin.py")
MAX_STREAM_CHARS = 20_000

# Error signatures -> remediation tags declared in exercise.json "remediation".
ERROR_PATTERNS = [
    ("ShapeMismatch", re.compile(r"shape|broadcast|dimensions do not match|matmul|size \d+ is different", re.I)),
    ("NaNInSoftmax", re.compile(r"nan|overflow|isfinite", re.I)),
    ("NotConverging", re.compile(r"did not converge|cost increased", re.I)),
]


def _limits(cpu_seconds, memory_mb):
    def apply():
        os.setsid()
        # Soft < hard so the kernel sends SIGXCPU (classifiable) before SIGKILL.
        resource.setrlimit(resource.RLIMIT_CPU, (cpu_seconds, cpu_seconds + 1))
        mem = memory_mb * 1024 * 1024
        resource.setrlimit(resource.RLIMIT_AS, (mem, mem))
        resource.setrlimit(resource.RLIMIT_FSIZE, (10 * 1024 * 1024,) * 2)
    return apply


def _classify(tests):
    tags = []
    for t in tests:
        if t["outcome"] != "failed":
            continue
        text = f"{t.get('error_type') or ''} {t.get('message') or ''}"
        for tag, pattern in ERROR_PATTERNS:
            if pattern.search(text) and tag not in tags:
                tags.append(tag)
    return tags


def grade(submission_code, exercise_dir, timeout=None):
    exercise_dir = Path(exercise_dir)
    meta = json.loads((exercise_dir / "exercise.json").read_text())
    limits = meta.get("limits", {})
    wall = timeout if timeout is not None else limits.get("wall_seconds", 15)

    with tempfile.TemporaryDirectory(prefix="grade-") as tmp:
        work = Path(tmp) / "sandbox"
        work.mkdir()
        results_path = Path(tmp) / "results.json"

        (work / "submission.py").write_text(submission_code)
        shutil.copy(exercise_dir / "tests_hidden.py", work / "test_hidden.py")
        shutil.copy(PLUGIN, work / "conftest.py")
        # Optional read-only inputs for the hidden tests (e.g. a sample database).
        if (exercise_dir / "fixtures").is_dir():
            shutil.copytree(exercise_dir / "fixtures", work / "fixtures")
        (work / "pytest.ini").write_text("[pytest]\naddopts =\n")

        env = {
            "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            "HOME": str(work),
            "PYTHONDONTWRITEBYTECODE": "1",
            "OPENBLAS_NUM_THREADS": "1",
            "OMP_NUM_THREADS": "1",
            "MKL_NUM_THREADS": "1",
            "GRADER_RESULTS_PATH": str(results_path),
        }
        cmd = [sys.executable, "-m", "pytest", "-q", "-p", "no:cacheprovider", "test_hidden.py"]

        start = time.monotonic()
        proc = subprocess.Popen(
            cmd, cwd=work, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True,
            preexec_fn=_limits(limits.get("cpu_seconds", 10), limits.get("memory_mb", 2048)),
        )
        timed_out = False
        try:
            out, err = proc.communicate(timeout=wall)
        except subprocess.TimeoutExpired:
            timed_out = True
            os.killpg(proc.pid, signal.SIGKILL)
            out, err = proc.communicate()
        duration_ms = round((time.monotonic() - start) * 1000)

        raw = json.loads(results_path.read_text()) if results_path.exists() else {}

    tests = raw.get("tests", [])
    collection_errors = raw.get("collection_errors", [])
    passed = sum(t["outcome"] == "passed" for t in tests)
    total = len(tests)

    cpu_exceeded = proc.returncode in (-signal.SIGXCPU, -signal.SIGKILL) and not timed_out
    if timed_out or cpu_exceeded:
        status = "timeout"
    elif collection_errors or (not tests and proc.returncode != 0):
        status = "error"  # syntax/import error or crash before tests ran
    elif passed == total:
        status = "passed"
    else:
        status = "failed"

    stderr = "\n".join(collection_errors) + (err or "")
    if timed_out:
        stderr += f"\nExecution exceeded the {wall}s wall-clock limit."
    elif cpu_exceeded:
        stderr += f"\nExecution exceeded the {limits.get('cpu_seconds', 10)}s CPU-time limit."

    tags = _classify(tests)
    if status == "error":
        stdout_text = out
    else:
        stdout_text = "".join(t.pop("stdout") or "" for t in tests)
    hints = meta.get("hints", {})
    for t in tests:
        t.pop("stdout", None)
        t["hint"] = hints.get(t["name"].split("[", 1)[0]) if t["outcome"] == "failed" else None

    remediation = []
    for tag in tags:
        entry = meta.get("remediation", {}).get(tag)
        if entry:
            remediation.append({"tag": tag, "hint": entry["hint"], "exercise": entry.get("exercise")})

    return {
        "exercise_id": meta["id"],
        "status": status,
        "passed_tests": passed,
        "total_tests": total,
        "score": round(passed / total, 4) if total else 0.0,
        "tests": tests,
        "stdout": stdout_text[-MAX_STREAM_CHARS:],
        "stderr": stderr[-MAX_STREAM_CHARS:],
        "duration_ms": duration_ms,
        "error_tags": tags,
        "remediation": remediation,
    }


def main(argv=None):
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("exercise_dir")
    p.add_argument("submission")
    p.add_argument("--timeout", type=float, default=None, help="wall-clock seconds (default: from exercise.json)")
    args = p.parse_args(argv)
    result = grade(Path(args.submission).read_text(), args.exercise_dir, args.timeout)
    print(json.dumps(result, indent=2))
    return 0 if result["status"] == "passed" else 1


if __name__ == "__main__":
    sys.exit(main())
