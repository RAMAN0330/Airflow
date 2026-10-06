"""Indexes, keyset pagination and atomic transactions with sqlite3."""
import sqlite3


def create_indexes(conn: sqlite3.Connection) -> None:
    """Create the indexes that make both lookup queries SEARCH instead of SCAN. Must be idempotent."""
    # TODO: CREATE INDEX IF NOT EXISTS ...
    raise NotImplementedError


def orders_page(conn: sqlite3.Connection, after_id: int = 0, limit: int = 20) -> list[tuple]:
    """Next `limit` orders after `after_id`, as (order_id, order_date), in id order."""
    # TODO: keyset pagination with a parameterized query
    raise NotImplementedError


def transfer_stock(conn: sqlite3.Connection, product_id: int, src: str, dst: str, qty: int) -> tuple[int, int]:
    """Atomically move qty units from src to dst; return (new_src_qty, new_dst_qty)."""
    # TODO: validate, then do both writes in ONE transaction (hint: `with conn:`)
    raise NotImplementedError
