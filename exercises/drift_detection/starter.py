"""Drift statistics for model monitoring: PSI, KS distance and a drift report. NumPy only."""
import numpy as np


def psi(reference, current, bins=10, eps=1e-6) -> float:
    raise NotImplementedError


def ks_statistic(a, b) -> float:
    raise NotImplementedError


def psi_level(value: float) -> str:
    raise NotImplementedError


def drift_report(reference: dict, current: dict, psi_threshold=0.2, bins=10) -> dict:
    raise NotImplementedError
