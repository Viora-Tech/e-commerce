/** SOURCE OF TRUTH: the "payment not finished" nudge — WHAT: once per order, a short while after an online checkout whose payment failed or was abandoned, writes `order.payment_pending` so the shopper gets `payment_pending` with the retry link / WHY: Shopify's "Payment error" message; the unpaid expiry would otherwise cancel the order without the shopper ever hearing */
import { order, store } from '@commerce/db'
import { KEYS_REFUSED_PREFIX } from '@commerce/payments'
import { and, asc, eq, gt, isNotNull, isNull, lt, notInArray, or, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { messageOn } from '../notifications/deliver'
import { openCheckoutDraftWhere } from '../order/checkout-draft'
import { insertOutboxEvent } from '../outbox/write'
import { EXPIRY_EXEMPT_METHODS } from './expiry'
import { parsePaymentSettings } from './settings'

/**
 * How long after checkout the shopper is nudged, unless the store's expiry is sooner. Long
 * enough that nobody hears from us while the gateway's window, and its QR, are still open.
 */
const PAYMENT_PENDING_AFTER_MINUTES = 30

/** Orders older than this are never nudged: the scan stays small and outbox rows outlive it. */
const NUDGE_WINDOW_MS = 86_400_000

/** Orders nudged per store per run; the next run (a minute later) takes the rest. */
const BATCH = 50

/**
 * Minutes after checkout to nudge: thirty, or half the store's "cancel unpaid orders after"
 * window when that is shorter, so the retry link still works when the message lands.
 */
function paymentNudgeAfterMinutes(expireAfterMinutes: number): number {
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
        // An open order, or an unpaid checkout kept as a draft (#D57) until paid.
        or(eq(order.status, 'open'), openCheckoutDraftWhere()),
        isNull(order.checkoutPaidAt),
        isNotNull(order.cartId),
        isNull(order.importedFrom),
        notInArray(order.paymentMethod, [...EXPIRY_EXEMPT_METHODS]),
        lt(order.placedAt, due),
        gt(order.placedAt, oldest),
        // The gateway refused the store's keys on the latest attempt: "retry your payment" would
        // fail the same way; the owner was told instead (payments/gateway-health.ts).
        sql`not exists (
          select 1 from payment p
          where p.order_id = "order"."id" and p.error like ${`${KEYS_REFUSED_PREFIX}%`}
          and not exists (
            select 1 from payment q where q.order_id = p.order_id and q.attempt > p.attempt
          )
        )`,
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
