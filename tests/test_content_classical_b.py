"""Bug-injection tests for the classical_b content group: kmeans_gmm and pca_from_scratch."""
from pathlib import Path

from grader.run import grade

EX = Path(__file__).resolve().parents[1] / "exercises"
KM = EX / "kmeans_gmm"
PCA = EX / "pca_from_scratch"


def _failed(code, ex):
    r = grade(code, ex)
    return r, {t["name"].split("[")[0] for t in r["tests"] if t["outcome"] == "failed"}


def _mutate(ex, old, new):
    src = (ex / "solution.py").read_text()
    assert src.count(old) == 1, f"mutation target {old!r} not found exactly once"
    return src.replace(old, new)


# ------------------------------------------------------------------ kmeans_gmm

def test_distance_without_broadcast_is_caught():
    buggy = _mutate(KM, "(X ** 2).sum(axis=1)[:, None]", "(X ** 2).sum(axis=1)")
    r, failed = _failed(buggy, KM)
    assert r["status"] == "failed"
    assert "test_pairwise_sq_dists_rectangular_shapes" in failed
    assert "ShapeMismatch" in r["error_tags"]


def test_unstable_responsibilities_are_caught():
    buggy = _mutate(KM, "log_norm = logsumexp(log_r, axis=1)", "log_norm = np.log(np.exp(log_r).sum(axis=1))")
    r, failed = _failed(buggy, KM)
    assert r["status"] == "failed"
    assert "test_e_step_is_stable_in_log_space" in failed
    assert "NaNInSoftmax" in r["error_tags"]


def test_unhandled_empty_cluster_is_caught():
    old = """    C = sums / np.maximum(counts, 1)[:, None]
    empty = np.flatnonzero(counts == 0)
    if empty.size:
        dist = ((X - C[labels]) ** 2).sum(axis=1)
        for j in empty:
            i = int(np.argmax(dist))
            C[j] = X[i]
            dist[i] = -1.0
    return C"""
    buggy = _mutate(KM, old, "    return sums / counts[:, None]")
    r, failed = _failed(buggy, KM)
    assert r["status"] == "failed"
    assert {"test_update_centroids_handles_empty_cluster", "test_kmeans_far_init_leaves_no_empty_cluster"} <= failed


def test_kmeans_pp_without_degenerate_guard_is_caught():
    buggy = _mutate(KM, "if total <= 0:", "if False:")
    r, failed = _failed(buggy, KM)
    assert r["status"] == "failed"
    assert "test_kmeans_pp_degenerate_data_has_no_nan" in failed


# ------------------------------------------------------------------ pca_from_scratch

def test_pca_without_centering_is_caught():
    buggy = _mutate(PCA, "np.linalg.svd(Xc, full_matrices=False)", "np.linalg.svd(X, full_matrices=False)")
    r, failed = _failed(buggy, PCA)
    assert r["status"] == "failed"
    assert {"test_pca_is_shift_invariant", "test_pca_svd_matches_eigh"} <= failed


def test_ascending_eigh_order_is_caught():
    buggy = _mutate(PCA, "np.argsort(evals)[::-1]", "np.argsort(evals)")
    r, failed = _failed(buggy, PCA)
    assert r["status"] == "failed"
    assert "test_pca_eigh_sorted_descending" in failed


def test_biased_covariance_is_caught():
    buggy = _mutate(PCA, "return Xc.T @ Xc / (n - 1)", "return Xc.T @ Xc / n")
    r, failed = _failed(buggy, PCA)
    assert r["status"] == "failed"
    assert "test_center_and_covariance_match_numpy" in failed
