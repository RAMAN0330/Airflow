"""Star schema + SCD Type 2 over the shop database with sqlite3."""
import sqlite3
from datetime import date, timedelta

OPEN_END = "9999-12-31"   # valid_to of a current row
BEGINNING = "1900-01-01"  # valid_from of a customer's first row in the initial load


def build_star(conn: sqlite3.Connection) -> None:
    """Create and fill dim_customer, dim_product, dim_date and fact_sales from the shop's OLTP tables."""
    # TODO: CREATE TABLE ... for the four tables, then INSERT ... SELECT from customers/products/orders/order_items
    raise NotImplementedError


REVENUE_BY_COUNTRY_QUARTER = """
-- TODO: country, year, quarter, revenue, using ONLY fact_sales and dimension tables
SELECT 'todo' AS todo
"""


def apply_scd2(conn: sqlite3.Connection, snapshot: list[dict], as_of: str) -> dict:
    """Merge a source snapshot into dim_customer as SCD Type 2; return {'inserted', 'updated', 'unchanged'}."""
    # TODO: for each row: new -> insert; same attributes -> skip; changed -> close current row + insert new version
    raise NotImplementedError


def customer_key_at(conn: sqlite3.Connection, customer_id: int, on_date: str) -> int | None:
    """Surrogate key of the customer's version valid on on_date (valid_from <= on_date < valid_to), or None."""
    # TODO
    raise NotImplementedError
