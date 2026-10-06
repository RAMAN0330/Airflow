"""Hidden validation suite for drift_detection."""
import numpy as np
import pytest

import submission as sub


def ref_psi(reference, current, bins=10, eps=1e-6):
    ref, cur = np.asarray(reference, float), np.asarray(current, float)
    edges = np.concatenate([[-np.inf], np.unique(np.quantile(ref, np.linspace(0, 1, bins + 1)[1:-1])), [np.inf]])
    r = np.clip(np.histogram(ref, edges)[0] / ref.size, eps, None)
    c = np.clip(np.histogram(cur, edges)[0] / cur.size, eps, None)
    return float(np.sum((c - r) * np.log(c / r)))


def brute_ks(a, b):
    xs = np.concatenate([a, b])
    return max(abs((a <= x).mean() - (b <= x).mean()) for x in xs)


rng = np.random.default_rng(42)
REF = rng.normal(0, 1, 5000)


def test_psi_matches_definition():
    cur = rng.normal(0.3, 1.2, 3000)
    for bins in (5, 10, 20):
        got = sub.psi(REF, cur, bins=bins)
        assert isinstance(got, float)
        assert got == pytest.approx(ref_psi(REF, cur, bins=bins), rel=1e-9, abs=1e-12)


def test_psi_identical_distributions_is_zero():
    assert sub.psi(REF, REF) == pytest.approx(0.0, abs=1e-12)
    assert sub.psi(REF, rng.normal(0, 1, 5000)) < 0.05


def test_psi_detects_shift():
    shifted = rng.normal(1.0, 1, 5000)
    assert sub.psi(REF, shifted) > 0.25
    assert sub.psi(REF, shifted) > sub.psi(REF, rng.normal(0.2, 1, 5000)) >= 0


def test_psi_constant_reference_is_finite():
    const = np.full(500, 3.0)
    assert sub.psi(const, const) == pytest.approx(0.0, abs=1e-12)
    v = sub.psi(const, rng.normal(0, 1, 500))
    assert np.isfinite(v) and v > 0.25


def test_ks_known_values():
    a = np.array([1.0, 2.0, 3.0])
    assert sub.ks_statistic(a, a) == 0.0
    assert sub.ks_statistic([1, 2, 3], [10, 11]) == 1.0
    assert sub.ks_statistic([1, 2, 3, 4], [3, 4, 5, 6]) == pytest.approx(0.5)


def test_ks_matches_brute_force():
    for _ in range(5):
        a, b = rng.normal(0, 1, 300), rng.normal(0.2, 1.3, 200)
        assert sub.ks_statistic(a, b) == pytest.approx(brute_ks(a, b), abs=1e-12)


def test_psi_level():
    assert [sub.psi_level(x) for x in (0.0, 0.0999, 0.1, 0.2499, 0.25, 3.0)] == [
        "none", "none", "moderate", "moderate", "major", "major"]


def test_drift_report_flags_shifted_features():
    reference = {"age": REF, "spend": rng.exponential(50, 4000), "tenure": rng.uniform(0, 60, 4000)}
    current = {"age": rng.normal(0, 1, 3000), "spend": rng.exponential(90, 3000), "tenure": rng.uniform(20, 80, 3000)}
    report = sub.drift_report(reference, current)
    assert set(report["features"]) == {"age", "spend", "tenure"}
    assert report["drifted_features"] == ["spend", "tenure"]
    age = report["features"]["age"]
    assert age["drifted"] is False and 0 <= age["ks"] < 0.1
    assert report["features"]["tenure"]["psi"] == pytest.approx(ref_psi(reference["tenure"], current["tenure"]))


def test_drift_report_missing_feature():
    with pytest.raises(ValueError):
        sub.drift_report({"age": REF, "spend": REF}, {"age": REF})


def test_inputs_not_mutated():
    a = rng.normal(0, 1, 100)
    b = rng.normal(1, 1, 100)
    a0, b0 = a.copy(), b.copy()
    sub.psi(a, b)
    sub.ks_statistic(a, b)
    np.testing.assert_array_equal(a, a0)
    np.testing.assert_array_equal(b, b0)
