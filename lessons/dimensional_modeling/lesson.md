# Dimensional Modeling: Star Schemas & Slowly Changing Dimensions

The shop's tables are built for *running* the business: one row per order, per item, per customer, with
no duplication. That's **normalized** design, and it's right for transactions. Analysts, though, ask the
same shaped question over and over: *how much, by what, over when?* Ralph Kimball's **dimensional
modeling** reshapes data around exactly that question.

## Facts and dimensions

Split every business process into two kinds of data:

- **Facts** are the measurements of an event: `quantity`, `unit_price`, `revenue`. They're numeric and
  additive, and they make up the vast majority of rows.
- **Dimensions** are the context: *who* bought (customer), *what* (product), *when* (date). They're
  descriptive, wide, and comparatively small.

Put the facts in one table and point it at each dimension, and you get a **star schema**:

```
            dim_date
               │
dim_customer ──┼── fact_sales ── dim_product
```

Every analytics query becomes the same pattern: join the fact to a few dimensions, filter and group by
dimension attributes, and sum the facts.

## Declare the grain first

The **grain** says exactly what one fact row means. Kimball calls it the most important design decision,
and getting it wrong is the most common mistake. Here: **one row per completed order line.** Pick the
most atomic grain the source has, because you can always roll up to orders or months, but you can never
drill down below what you stored.

Mixing grains breaks things quietly. Store one row per *order* and an order with three products can only
point at one `product_key`, so revenue by category is wrong. The order number still matters, so it stays
on the fact as a **degenerate dimension**: a key with no table of its own.

## Surrogate keys and the date dimension

Dimensions get their own integer primary keys, **surrogate keys**, assigned by the warehouse. The
source's `customer_id` is kept as an ordinary column. That decouples the warehouse from source systems,
and, as you'll see below, it's what makes history possible.

The date dimension is the exception Kimball allows: a readable `date_key` like `20250224` is fine. It needs
a row for **every** calendar day, so "revenue by day" shows zero-sale days instead of skipping them, and so
attributes like `quarter` or holidays live in one place instead of in every query.

## Slowly changing dimensions

Customer 3 moves from the US to Germany on 1 July. What should the warehouse do?

- **Type 1: overwrite.** `UPDATE dim_customer SET country = 'DE'`. Simple, but every past order now
  reports as German. Last quarter's revenue-by-country report silently changes.
- **Type 2: add a new row.** Close the current version and insert a new one:

| customer_key | customer_id | country | valid_from | valid_to | is_current |
|---|---|---|---|---|---|
| 3 | 3 | US | 1900-01-01 | 2025-07-01 | 0 |
| 25 | 3 | DE | 2025-07-01 | 9999-12-31 | 1 |

February's facts point at key 3, so they still say US. New facts look up the version valid on their date:

```sql
SELECT customer_key FROM dim_customer
WHERE customer_id = ? AND valid_from <= :order_date AND :order_date < valid_to;
```

Half-open ranges (`valid_from <= d < valid_to`) mean exactly one version matches any date, with no gaps
or overlaps, as long as the old row is **closed** at the same moment the new one opens.

## Making SCD2 loads safe

The load compares each incoming row with the **current** version only. New member: insert. Same
attributes: do nothing, so you don't touch the row or mint a new key. Changed: close the old row, insert
the new one. Because the comparison is against `is_current = 1`, re-running the same snapshot is a
no-op. That's the same **idempotency** your ETL upserts had. In production this logic is often a single
SQL `MERGE` statement.

In the exercise you'll build the star from the shop database, answer revenue by country and quarter over
it, and implement the SCD2 merge so history survives a customer moving countries.
