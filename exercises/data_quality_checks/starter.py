"""Data tests (not_null, unique, accepted_values, range, relationships), a suite runner and incremental loads."""


def check_not_null(rows, column):
    raise NotImplementedError


def check_unique(rows, column):
    raise NotImplementedError


def check_accepted_values(rows, column, values):
    raise NotImplementedError


def check_range(rows, column, min=None, max=None):
    raise NotImplementedError


def check_relationships(rows, column, parents):
    raise NotImplementedError


def run_suite(rows, suite):
    """Run every spec in `suite`; only 'error'-severity failures make the suite fail."""
    raise NotImplementedError


def incremental_batch(rows, watermark):
    """Return (rows newer than watermark sorted by updated_at, new watermark)."""
    raise NotImplementedError
