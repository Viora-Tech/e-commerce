import { type Db, order, orderNote, payment, store, withStore } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, asc, eq, inArray, isNotNull, isNull, lt, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { recomputeOrderStatuses } from '../order/recompute'
import { cancelOrder } from '../order/status'
import { paymentAttempts } from './attempts'
import { applyPaymentStatus } from './confirm'
import { parsePaymentSettings } from './settings'
import { SPLIT_TENDER_PROVIDERS, STORE_CREDIT_PROVIDER } from './split-tender'
import { OPEN_ATTEMPT_STATUSES } from './transitions'

/*
 * Unpaid order expiry. An online order whose payment never arrived holds stock
 * for nobody; after the store's window it is cancelled and the stock released.
 * The gateway is asked first, so a payment whose webhook is merely late marks
 * the order paid instead.
 *
 * Pattern from Saleor's channel `expire_orders_after` and
 * `release_funds_for_expired_checkouts` (BSD-3), model only.
 */

/** Paid outside a gateway: COD at the door, transfers matched by hand, gift cards and store credit up front. */
export const EXPIRY_EXEMPT_METHODS = [
  'cod',
  'manual',
  GIFT_CARD_PROVIDER,
  STORE_CREDIT_PROVIDER,
] as const

/** Orders looked at per store per run; the next run picks up the rest. */
const BATCH = 50

export const EXPIRED_NOTE = (minutes: number) =>
  `Cancelled automatically: no payment within ${minutes} minutes. Reserved stock was released.`

export type ExpiryOutcome = {
  orderId: string
  result: 'cancelled' | 'paid' | 'skipped'
  reason?: string
}

/**
 * Online checkout orders still `placed` after the window. Only orders that
 * came through checkout's payment attempts (they carry an idempotency key)
 * qualify; drafts and orders from before attempts existed are left alone.
 */
export async function expiredUnpaidOrders(
  ctx: StoreContext,
  now: Date,
): Promise<{ minutes: number; orderIds: string[] }> {
  const [s] = await ctx.tx
    .select({ payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const minutes = parsePaymentSettings(s?.payments).expireUnpaidAfterMinutes
  if (!minutes) return { minutes, orderIds: [] }
  const cutoff = new Date(now.getTime() - minutes * 60_000)
  const rows = await ctx.tx
    .selectDistinct({ id: order.id, placedAt: order.placedAt })
    .from(order)
    .innerJoin(payment, eq(payment.orderId, order.id))
    .where(
      and(
        eq(order.status, 'open'),
        isNull(order.checkoutPaidAt),
        lt(order.placedAt, cutoff),
        isNull(order.importedFrom),
        notInArray(order.paymentMethod, [...EXPIRY_EXEMPT_METHODS]),
        isNotNull(payment.idempotencyKey),
      ),
    )
    .orderBy(asc(order.placedAt))
    .limit(BATCH)
  return { minutes, orderIds: rows.map((r) => r.id) }
}

/**
 * Expire one order, once. Every attempt that reached the gateway is checked
 * with `fetchStatus` outside any transaction:
 * - captured: recorded as paid through the normal forward-only path; not cancelled.
 * - authorised, or the gateway cannot be asked: skipped, the next run retries.
 * Otherwise the order is cancelled under its row lock, which releases its
 * committed stock through `cancelOrder` exactly once, and its open attempts
 * are marked cancelled. A capture that lands after this is flagged refund
 * needed by `applyPaymentStatus`, never revives the order.
 */
export async function expireUnpaidOrder(
  db: Db,
  storeId: string,
  orderId: string,
  providers: readonly PaymentProvider[],
  minutes: number,
): Promise<ExpiryOutcome> {
  const attempts = await withStore(db, storeId, (tx) => paymentAttempts({ storeId, tx }, orderId))
  // Attempts the gateway answered; one that never got an answer has no reference to ask about.
  const asked = attempts.filter(
    (a) => a.checkoutSession !== null && a.status !== 'refunded' && a.status !== 'captured',
  )
  if (attempts.some((a) => a.status === 'captured' && !a.refundNeeded)) {
    return { orderId, result: 'skipped', reason: 'already captured' }
  }

  for (const a of asked) {
    const provider = providers.find((p) => p.id === a.provider)
    if (!provider) return { orderId, result: 'skipped', reason: `${a.provider} not enabled` }
    let truth: Awaited<ReturnType<PaymentProvider['fetchStatus']>>
    try {
      truth = await provider.fetchStatus(a.providerRef)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      return { orderId, result: 'skipped', reason: `gateway check failed: ${reason}` }
    }
    if (truth.status === 'captured') {
      const applied = await withStore(db, storeId, (tx) =>
        applyPaymentStatus(
          { storeId, tx },
          {
            paymentId: a.id,
            status: 'captured',
            providerPaymentId: truth.providerPaymentId,
          },
        ),
      )
      return applied?.refundNeeded
        ? { orderId, result: 'skipped', reason: 'captured, refund needed' }
        : { orderId, result: 'paid' }
    }
    if (truth.status === 'authorized') {
      return { orderId, result: 'skipped', reason: 'authorised, capture pending' }
    }
  }

  return withStore(db, storeId, async (tx) => {
    const ctx = { storeId, tx }
    const [o] = await tx
      .select({ status: order.status, checkoutPaidAt: order.checkoutPaidAt })
      .from(order)
      .where(eq(order.id, orderId))
      .for('update')
    // Paid, cancelled or moved on since the check: nothing to do.
    if (o?.status !== 'open' || o.checkoutPaidAt) {
      const reason = o?.checkoutPaidAt ? 'paid' : (o?.status ?? 'missing')
      return { orderId, result: 'skipped' as const, reason }
    }
    // The shopper closed the payment window: nothing was bought, so no "order cancelled" email.
    await cancelOrder(ctx, orderId, { notifyCustomer: false })
    await tx
      .update(payment)
      .set({ status: 'cancelled', error: 'Order expired unpaid' })
      .where(
        and(
          eq(payment.orderId, orderId),
          inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
          notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS]),
        ),
      )
    // An authorised hold just ended: the payment status follows.
    await recomputeOrderStatuses(ctx, orderId)
    await tx.insert(orderNote).values({
      storeId,
      orderId,
      body: EXPIRED_NOTE(minutes),
      author: 'system',
    })
    return { orderId, result: 'cancelled' as const }
  })
}

/** One store's run: find expired orders and expire each; one failure never stops the rest. */
export async function expireUnpaidOrders(
  db: Db,
  storeId: string,
  providers: readonly PaymentProvider[],
  now: Date = new Date(),
): Promise<ExpiryOutcome[]> {
  const { minutes, orderIds } = await withStore(db, storeId, (tx) =>
    expiredUnpaidOrders({ storeId, tx }, now),
  )
  const out: ExpiryOutcome[] = []
  for (const id of orderIds) {
    try {
      out.push(await expireUnpaidOrder(db, storeId, id, providers, minutes))
    } catch (err) {
      out.push({
        orderId: id,
        result: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return out
}
