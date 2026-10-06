"""Reference solution — never shipped to learners."""
import sqlite3


def create_indexes(conn: sqlite3.Connection) -> None:
    conn.execute("CREATE INDEX IF NOT EXISTS idx_orders_customer_date ON orders (customer_id, order_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items (product_id)")
    conn.commit()


def orders_page(conn: sqlite3.Connection, after_id: int = 0, limit: int = 20) -> list[tuple]:
    return conn.execute(
        "SELECT order_id, order_date FROM orders WHERE order_id > ? ORDER BY order_id LIMIT ?",
        (after_id, limit),
    ).fetchall()


def transfer_stock(conn: sqlite3.Connection, product_id: int, src: str, dst: str, qty: int) -> tuple[int, int]:
    if qty <= 0:
        raise ValueError("qty must be positive")
    with conn:  # commit on success, roll back on any exception
        row = conn.execute(
            "SELECT qty FROM inventory WHERE warehouse = ? AND product_id = ?", (src, product_id)
        ).fetchone()
        if row is None or row[0] < qty:
            raise ValueError("insufficient stock")
        conn.execute(
            "UPDATE inventory SET qty = qty - ? WHERE warehouse = ? AND product_id = ?", (qty, src, product_id)
        )
        conn.execute(
            "INSERT INTO inventory (warehouse, product_id, qty) VALUES (?, ?, ?) "
            "ON CONFLICT (warehouse, product_id) DO UPDATE SET qty = qty + excluded.qty",
            (dst, product_id, qty),
        )
    get = "SELECT qty FROM inventory WHERE warehouse = ? AND product_id = ?"
    return conn.execute(get, (src, product_id)).fetchone()[0], conn.execute(get, (dst, product_id)).fetchone()[0]
