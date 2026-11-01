/**
 * The analytics page's sales breakdown (audit #100), read the way Shopify lays it out: gross
 * sales → discounts → returns → net sales → shipping → total sales. Prices in India include GST,
 * so GST is shown as part of the totals, not added on top. Cancelled orders are out; refunds
 * count when they were made, on orders that were not cancelled.
 */
import { notTestOrder } from '@commerce/core'
import { order, refund, type StoreTx } from '@commerce/db'
import { and, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm'

export type SalesBreakdownSums = {
  /** Item prices before discounts (the orders' subtotals). */
  grossPaise: number
  discountsPaise: number
  returnsPaise: number
  shippingPaise: number
  /** GST inside those prices. */
  taxPaise: number
}

export type SalesBreakdownLine = {
  key: 'gross' | 'discounts' | 'returns' | 'net' | 'shipping' | 'tax' | 'total'
  paise: number
  /** Net and total are sums of the lines above them. */
  subtotal: boolean
}

/** The lines in order. Pure, so the arithmetic is tested without a database. */
export function breakdownLines(s: SalesBreakdownSums): SalesBreakdownLine[] {
  const net = s.grossPaise - s.discountsPaise - s.returnsPaise
  return [
    { key: 'gross', paise: s.grossPaise, subtotal: false },
    { key: 'discounts', paise: -s.discountsPaise, subtotal: false },
    { key: 'returns', paise: -s.returnsPaise, subtotal: false },
    { key: 'net', paise: net, subtotal: true },
    { key: 'shipping', paise: s.shippingPaise, subtotal: false },
    { key: 'tax', paise: s.taxPaise, subtotal: false },
    { key: 'total', paise: net + s.shippingPaise, subtotal: true },
  ]
}

const counted = and(ne(order.status, 'draft'), ne(order.status, 'cancelled'), notTestOrder)

/** The sums for orders placed (and refunds made) in [from, to). */
export async function salesBreakdownSums(
  tx: StoreTx,
  from: Date,
  to: Date,
): Promise<SalesBreakdownSums> {
  const num = (col: unknown) => sql<number>`coalesce(sum(${col}), 0)::bigint`.mapWith(Number)
  const [placed] = await tx
    .select({
      grossPaise: num(order.subtotalPaise),
      discountsPaise: num(order.discountPaise),
      shippingPaise: num(order.shippingPaise),
      taxPaise: num(order.taxPaise),
    })
    .from(order)
    .where(and(counted, gte(order.placedAt, from), lt(order.placedAt, to)))
  const [refunded] = await tx
    .select({ returnsPaise: num(refund.amountPaise) })
    .from(refund)
    .innerJoin(order, eq(order.id, refund.orderId))
    .where(
      and(
        counted,
        inArray(refund.status, ['processed', 'manual']),
        gte(refund.createdAt, from),
        lt(refund.createdAt, to),
      ),
    )
  return {
    grossPaise: placed?.grossPaise ?? 0,
    discountsPaise: placed?.discountsPaise ?? 0,
    returnsPaise: refunded?.returnsPaise ?? 0,
    shippingPaise: placed?.shippingPaise ?? 0,
    taxPaise: placed?.taxPaise ?? 0,
  }
}
