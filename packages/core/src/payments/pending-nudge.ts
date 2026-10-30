/** SOURCE OF TRUTH: the "payment not finished" nudge — WHAT: once per order, a short while after an online checkout whose payment failed or was abandoned, writes `order.payment_pending` so the shopper gets `payment_pending` with the retry link / WHY: Shopify's "Payment error" message; the unpaid expiry would otherwise cancel the order without the shopper ever hearing */
import { order, store } from '@commerce/db'
import { and, asc, eq, gt, isNotNull, isNull, lt, notInArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { messageOn } from '../notifications/deliver'
import { insertOutboxEvent } from '../outbox/write'
import { EXPIRY_EXEMPT_METHODS } from './expiry'
import { parsePaymentSettings } from './settings'

/** How long after checkout the shopper is nudged, unless the store's expiry is sooner. */
export const PAYMENT_PENDING_AFTER_MINUTES = 10

/** Orders older than this are never nudged: the scan stays small and outbox rows outlive it. */
const NUDGE_WINDOW_MS = 86_400_000

/** Orders nudged per store per run; the next run (a minute later) takes the rest. */
const BATCH = 50

/**
 * Minutes after checkout to nudge: ten, or half the store's "cancel unpaid orders after"
 * window when that is shorter, so the retry link still works when the message lands.
 */
export function paymentNudgeAfterMinutes(expireAfterMinutes: number): number {
  if (!expireAfterMinutes) return PAYMENT_PENDING_AFTER_MINUTES
  return Math.max(1, Math.min(PAYMENT_PENDING_AFTER_MINUTES, Math.floor(expireAfterMinutes / 2)))
}

/**
 * One store's run. The orders are the "Payment pending" ones (#1001: a storefront checkout,
 * online method, unpaid, not imported) still open, placed between the nudge delay and a day
 * ago, with no `order.payment_pending` row yet: each gets one, so it is written at most once
 * per order. Delivery checks again that the order is still unpaid. Nothing is written while
 * the store has the message switched off. Returns how many were queued.
 */
export async function queuePaymentPendingNudges(
  ctx: StoreContext,
  now: Date = new Date(),
): Promise<number> {
  if (!(await messageOn(ctx, 'payment_pending'))) return 0
  const [s] = await ctx.tx
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const minutes = paymentNudgeAfterMinutes(
    parsePaymentSettings(s?.payments).expireUnpaidAfterMinutes,
  )
  const due = new Date(now.getTime() - minutes * 60_000)
  const oldest = new Date(now.getTime() - NUDGE_WINDOW_MS)
  const rows = await ctx.tx
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        eq(order.status, 'open'),
        isNull(order.checkoutPaidAt),
        isNotNull(order.cartId),
        isNull(order.importedFrom),
        notInArray(order.paymentMethod, [...EXPIRY_EXEMPT_METHODS]),
        lt(order.placedAt, due),
        gt(order.placedAt, oldest),
        // Spelled out: the outbox keeps the order id inside its payload.
        sql`not exists (
          select 1 from outbox_event e
          where e.type = 'order.payment_pending' and e.payload->>'orderId' = "order"."id"::text
        )`,
      ),
    )
    .orderBy(asc(order.placedAt))
    .limit(BATCH)
  for (const r of rows) {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.payment_pending', { orderId: r.id })
  }
  return rows.length
}
