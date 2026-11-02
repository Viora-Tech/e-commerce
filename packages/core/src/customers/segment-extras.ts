/** SOURCE OF TRUTH: the newer segment facts — WHAT: city, customer since, first order, products bought, COD orders, RTOs and abandoned carts per customer / WHY: #1020's filters read facts the customer list row does not carry, so every place that checks a segment loads them the same way */
import {
  cart,
  customer,
  order,
  orderLine,
  returnRequest,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, eq, gt, inArray, isNotNull, ne, sql } from 'drizzle-orm'
import type { SegmentCustomer } from './segments'

type Extras = Pick<
  SegmentCustomer,
  'city' | 'createdAt' | 'firstOrderAt' | 'productIds' | 'codOrders' | 'rtoOrders' | 'abandonedCart'
>

const DAY_MS = 86_400_000
/** "Abandoned a cart" looks back this far. */
export const ABANDONED_CART_DAYS = 30

/**
 * The extra facts for these customers (or every customer when `ids` is null), keyed by id.
 * Cancelled and test orders do not count; a customer with no orders gets zeros and no products.
 */
export async function segmentExtras(
  tx: StoreTx,
  ids: string[] | null,
  now: Date = new Date(),
): Promise<Map<string, Extras>> {
  const out = new Map<string, Extras>()
  if (ids && ids.length === 0) return out
  const byCustomer = ids ? inArray(customer.id, ids) : undefined
  const byOrderCustomer = ids ? inArray(order.customerId, ids) : isNotNull(order.customerId)
  const counted = and(byOrderCustomer, ne(order.status, 'cancelled'), eq(order.isTest, false))

  const [people, orders, bought, rtos, carts] = await Promise.all([
    tx
      .select({
        id: customer.id,
        createdAt: customer.createdAt,
        city: sql<string | null>`${customer.defaultAddress} ->> 'city'`,
      })
      .from(customer)
      .where(byCustomer),
    tx
      .select({
        customerId: order.customerId,
        firstAt: sql<string | null>`min(${order.placedAt})`,
        cod: sql<number>`count(*) filter (where ${order.paymentMethod} = 'cod')::int`,
      })
      .from(order)
      .where(and(counted, ne(order.status, 'draft')))
      .groupBy(order.customerId),
    tx
      .selectDistinct({ customerId: order.customerId, productId: variant.productId })
      .from(orderLine)
      .innerJoin(order, eq(order.id, orderLine.orderId))
      .innerJoin(variant, eq(variant.id, orderLine.variantId))
      .where(and(counted, ne(order.status, 'draft'))),
    tx
      .select({ customerId: order.customerId, n: sql<number>`count(*)::int` })
      .from(returnRequest)
      .innerJoin(order, eq(order.id, returnRequest.orderId))
      .where(and(byOrderCustomer, eq(returnRequest.kind, 'rto')))
      .groupBy(order.customerId),
    tx
      .selectDistinct({ customerId: cart.customerId })
      .from(cart)
      .where(
        and(
          ids ? inArray(cart.customerId, ids) : isNotNull(cart.customerId),
          eq(cart.status, 'abandoned'),
          gt(cart.updatedAt, new Date(now.getTime() - ABANDONED_CART_DAYS * DAY_MS)),
        ),
      ),
  ])

  for (const p of people) {
    out.set(p.id, {
      city: p.city ?? null,
      createdAt: p.createdAt,
      firstOrderAt: null,
      productIds: [],
      codOrders: 0,
      rtoOrders: 0,
      abandonedCart: false,
    })
  }
  for (const o of orders) {
    const e = o.customerId ? out.get(o.customerId) : undefined
    if (e) {
      e.firstOrderAt = o.firstAt
      e.codOrders = o.cod
    }
  }
  for (const b of bought) {
    const e = b.customerId ? out.get(b.customerId) : undefined
    if (e && b.productId) e.productIds?.push(b.productId)
  }
  for (const r of rtos) {
    const e = r.customerId ? out.get(r.customerId) : undefined
    if (e) e.rtoOrders = r.n
  }
  for (const c of carts) {
    const e = c.customerId ? out.get(c.customerId) : undefined
    if (e) e.abandonedCart = true
  }
  return out
}
