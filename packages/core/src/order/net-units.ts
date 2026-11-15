/** SOURCE OF TRUTH: units sold — WHAT an order line's returned and net units as SQL / WHY every "units sold" number (custom queries, sales reports, Top products, the product page, the restock card) is ordered minus returned, like Shopify's net quantity, and counts returns one way */
import { orderLine, returnRequest, returnRequestLine } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'

/**
 * Units on a line that came back: returns and RTO whose request was not rejected or cancelled
 * (requested, approved, in transit, received and resolved all count). Use where `order_line`
 * is in the FROM.
 */
export const RETURNED_UNITS: SQL<number> = sql<number>`(select coalesce(sum(${returnRequestLine.quantity}), 0)
  from ${returnRequestLine} join ${returnRequest} on ${returnRequest.id} = ${returnRequestLine.returnRequestId}
  where ${returnRequestLine.orderLineId} = ${orderLine.id}
    and ${returnRequest.status} not in ('rejected', 'cancelled'))`

/**
 * Units a line kept: ordered minus what came back, never below zero. Summed over lines, a
 * return counts on its order's date (the order's placed time dates the line), so a past
 * period's figure can still drop when a later return arrives.
 */
export const NET_UNITS: SQL<number> = sql<number>`(${orderLine.quantity} - least(${RETURNED_UNITS}, ${orderLine.quantity}))`
