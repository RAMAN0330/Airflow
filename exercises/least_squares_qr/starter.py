"""Least squares three ways: normal equations, Householder QR by hand, and projections, plus conditioning. NumPy only."""
import numpy as np


def vandermonde(t, degree):
    """Columns 1, t, t², …, t^degree. Shape (len(t), degree + 1)."""
    raise NotImplementedError


def normal_equations(A, b):
    """Least-squares x from (AᵀA) x = Aᵀb. ValueError unless A is 2-D with m >= n."""
    raise NotImplementedError


def householder_qr(A):
    """Thin QR by Householder reflections: Q (m, n) with orthonormal columns, upper-triangular R (n, n)."""
    raise NotImplementedError


def back_substitution(R, y):
    """Solve R x = y for upper-triangular R, from the last row up. ValueError on a zero pivot."""
    raise NotImplementedError


def qr_least_squares(A, b):
    """Least-squares x via A = QR, then R x = Qᵀb."""
    raise NotImplementedError


def projection_matrix(A):
    """Orthogonal projector onto the column space of A, shape (m, m)."""
    raise NotImplementedError


def condition_number(A):
    """2-norm condition number σ_max / σ_min as a float (inf when σ_min is 0)."""
    raise NotImplementedError
