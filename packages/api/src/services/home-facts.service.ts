/** SOURCE OF TRUTH: Home's extra counts — WHAT: orders to ship older than 30 days, products out of stock, and how the last 30 days of orders were really paid (the gateway's own method when it said) / WHY: the Home redesign (19 Nov 2026) shows the old to-ship orders as their own row, an "out of stock" badge on Restock and real payment method names instead of "Other" */
import { notTestOrder } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { order, payment, product, sellableStock, variant } from '@commerce/db'
import { and, count, desc, eq, gte, isNotNull, isNull, lt, ne, sql } from 'drizzle-orm'
import { isoDate, startOfDay } from './dashboard-buckets'
import { viewFilter } from './order.service'

/** Orders still "To ship" after this many days are probably shipped outside Koomerce. */
export const STALE_TO_SHIP_DAYS = 30
/** How many days of orders the payment mix reads (the same 30 days as the summary's mixes). */
const MIX_DAYS = 30

/** How an order was paid, as Home names it; the admin turns each into words. */
export const PAYMENT_MIX_METHODS = [
  'upi',
  'card',
  'netbanking',
  'wallet',
  'emi',
  'pay_later',
  'cod',
  'store_credit',
  'gift_card',
  'online',
  'other',
] as const
export type PaymentMixMethod = (typeof PAYMENT_MIX_METHODS)[number]

export type HomeFacts = {
  /**
   * Orders on the Unfulfilled list (the same rule as Home's "Ship N orders") placed before
   * midnight (IST) `STALE_TO_SHIP_DAYS` days ago. `lastDay` is the newest such day
   * (yyyy-mm-dd), for the Orders list's date filter.
   */
  staleToShip: { count: number; lastDay: string }
  /** Products with at least one live, tracked variant at zero or below (Restock's red badge). */
  outOfStock: number
  /** The last 30 days' orders (cancelled left out) by how they were paid, busiest first. */
  paymentMix: { method: PaymentMixMethod; count: number }[]
}

/** The gateway's `method_detail.kind` (core `PaymentMethodDetailSchema`) in Home's words. */
const KIND_METHOD: Record<string, PaymentMixMethod> = {
  upi: 'upi',
  card: 'card',
  netbanking: 'netbanking',
  wallet: 'wallet',
  emi: 'emi',
  cardless_emi: 'emi',
  paylater: 'pay_later',
  other: 'online',
}

/** `order.payment_method` when the gateway did not say how: manual transfers are UPI. */
const ORDER_METHOD: Record<string, PaymentMixMethod> = {
  cod: 'cod',
  manual: 'upi',
  razorpay_upi: 'upi',
  store_credit: 'store_credit',
  gift_card: 'gift_card',
}

/** One order's way of paying: the gateway's own word first, then the order's method. */
export function paymentMixMethod(method: string | null, kind: string | null): PaymentMixMethod {
  const fromKind = kind ? KIND_METHOD[kind] : undefined
  if (fromKind) return fromKind
  if (!method) return 'other'
  // Any other gateway (Razorpay, Cashfree, PhonePe…) that did not say how: an online payment.
  return ORDER_METHOD[method] ?? 'online'
}

export async function homeFacts(tx: StoreTx, opts: { now?: Date } = {}): Promise<HomeFacts> {
  const now = opts.now ?? new Date()
  const staleBefore = startOfDay(now, STALE_TO_SHIP_DAYS)
  const mixFrom = startOfDay(now, MIX_DAYS - 1)
  const available = sql`${sellableStock.onHand} - ${sellableStock.reserved}`
  // The same live-variant rule as the summary's "Restock N products" (#72).
  const liveVariant = and(
    eq(variant.trackInventory, true),
    isNull(variant.archivedAt),
    ne(product.status, 'archived'),
  )
  // The newest attempt the gateway described, per order.
  const methodOf = tx
    .selectDistinctOn([payment.orderId], {
      orderId: payment.orderId,
      kind: sql<string | null>`${payment.methodDetail} ->> 'kind'`.as('kind'),
    })
    .from(payment)
    .where(and(isNotNull(payment.methodDetail), gte(payment.createdAt, mixFrom)))
    .orderBy(payment.orderId, desc(payment.attempt))
    .as('method_of')

  const [[stale], [out], mixRows] = await Promise.all([
    tx
      .select({ n: count() })
      .from(order)
      .where(and(viewFilter('unfulfilled'), lt(order.placedAt, staleBefore))),
    tx
      .select({ n: sql<number>`count(distinct ${product.id})`.mapWith(Number) })
      .from(sellableStock)
      .innerJoin(variant, eq(variant.id, sellableStock.variantId))
      .innerJoin(product, eq(product.id, variant.productId))
      .where(and(liveVariant, lt(available, 1))),
    tx
      .select({ method: order.paymentMethod, kind: methodOf.kind, n: count() })
      .from(order)
      .leftJoin(methodOf, eq(methodOf.orderId, order.id))
      .where(
        and(
          ne(order.status, 'draft'),
          ne(order.status, 'cancelled'),
          notTestOrder,
          gte(order.placedAt, mixFrom),
        ),
      )
      .groupBy(order.paymentMethod, methodOf.kind),
  ])

  const counts = new Map<PaymentMixMethod, number>()
  for (const r of mixRows) {
    const method = paymentMixMethod(r.method, r.kind)
    counts.set(method, (counts.get(method) ?? 0) + r.n)
  }
  const paymentMix = [...counts.entries()]
    .map(([method, n]) => ({ method, count: n }))
    .sort((a, b) => b.count - a.count || a.method.localeCompare(b.method))

  return {
    staleToShip: {
      count: stale?.n ?? 0,
      lastDay: isoDate(new Date(staleBefore.getTime() - 1)),
    },
    outOfStock: out?.n ?? 0,
    paymentMix,
  }
}
