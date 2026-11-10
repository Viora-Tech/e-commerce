/** SOURCE OF TRUTH: countedOrder, preorderLine
 * WHAT:  Which orders count as pre-order sales: the filters the campaign list and the
 *        Products › Pre-orders overview share.
 * WHERE: `./campaigns-service`, `./campaigns-overview`.
 */
import { order, orderLine } from '@commerce/db'
import { and, eq, ne, or, sql } from 'drizzle-orm'

/** Lines that count as sales: real orders that were not cancelled. */
export const countedOrder = and(
  eq(order.isTest, false),
  ne(order.status, 'cancelled'),
  ne(order.status, 'draft'),
)

/**
 * A pre-order line: sold as one here, or on an order imported from Shopify that its pre-order
 * app tagged ("Essential Preorder", "pre-order"), whose lines arrive without the flag (audit #32).
 */
export const preorderLine = or(
  eq(orderLine.preorder, true),
  sql`exists (select 1 from unnest(${order.tags}) as t(tag) where t.tag ~* 'pre-?order')`,
)
