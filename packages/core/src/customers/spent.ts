/** SOURCE OF TRUTH: a customer's "Amount spent" — WHAT: money actually received from them and kept: each order's paid amount (the total once paid; captured payments while partly paid) minus refunds (ours, and an imported order's `refundedPaise`), never below 0 / WHY: the old sum of order totals counted unpaid COD and fully refunded orders (₹23,048 "spent" by a customer who paid ₹0, called a VIP), and the same figure drives segments, discount eligibility, audiences, the inbox panel and a theme's `customer.total_spent` (audit #132) */
import { type SQL, sql } from 'drizzle-orm'

/** Payment states where the whole order total was received (a refund may follow). */
const PAID = `('paid', 'partially_refunded', 'refunded', 'refund_needed')`

/** One order's received-and-kept amount, for an `"order" o` row. */
const ORDER_NET_PAID = `greatest(0,
  (case
    when o.payment_status in ${PAID} then o.total_paise
    when o.payment_status in ('partially_paid', 'authorized') then (
      select coalesce(sum(p.amount_paise), 0) from "payment" p
      where p.order_id = o.id and p.status = 'captured')
    else 0 end)
  - coalesce((o.import_meta ->> 'refundedPaise')::int, 0)
  - (select coalesce(sum(r.amount_paise), 0) from "refund" r
     where r.order_id = o.id and r.status in ('processed', 'manual')))`

/**
 * "Amount spent" for the customer whose id is `customerId` (a column of the outer query, e.g.
 * sql`${customer.id}`), in paise. Drafts and test orders never count; a cancelled order counts
 * only what was paid and not refunded, which is usually nothing.
 */
export function customerSpentSql(customerId: SQL): SQL<number> {
  return sql<number>`(select coalesce(sum(${sql.raw(ORDER_NET_PAID)}), 0)::int from "order" o
    where o.customer_id = ${customerId} and o.status <> 'draft' and not o.is_test)`
}
