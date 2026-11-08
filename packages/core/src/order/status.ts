import { order, payment, shipment } from '@commerce/db'
import { and, desc, eq, inArray, isNull, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { captureHeldStoreCredit, releaseHeldStoreCredit } from '../customers/store-credit-checkout'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import { applyPaymentStatus } from '../payments/confirm'
import { SPLIT_TENDER_PROVIDERS } from '../payments/split-tender'
import { OPEN_ATTEMPT_STATUSES } from '../payments/transitions'
import { capturedPaise, checkoutDuePaise } from './aggregate-status'
import { fulfilRemainingLines } from './fulfil'
import { assertNotHeld } from './fulfillment-hold'
import { ensureFulfillmentOrders, releaseFulfillmentOrders } from './fulfillment-orders'
import { recomputeOrderStatuses } from './recompute'
import { refundedPaise, refundPayment } from './refund'

/**
 * A cancelled order gives back whatever it took from gift cards and store credit, straight onto
 * the same cards and the same store credit balance. Gateway money is still refunded by the
 * merchant; these balances are returned here because nothing else would ever release them.
 */
async function returnGiftCardPayments(ctx: StoreContext, orderId: string) {
  const rows = await ctx.tx
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        inArray(payment.provider, [...SPLIT_TENDER_PROVIDERS]),
        eq(payment.status, 'captured'),
      ),
    )
  for (const p of rows) {
    const left = p.amountPaise - (await refundedPaise(ctx, p.id))
    if (left > 0) {
      await refundPayment(ctx, null, {
        paymentId: p.id,
        amountPaise: left,
        reason: 'Order cancelled',
      })
    }
  }
}

/**
 * What the merchant can mark by hand from the order page. Payment and
 * fulfilment are otherwise derived; these record the fact behind them (money
 * collected, parcel packed, parcel handed over) and let the derivation follow.
 */
export type OrderStatusChange = 'paid' | 'fulfilled' | 'delivered' | 'cancelled'

export class OrderStatusLocked extends CommerceError {
  constructor(orderId: string, status: string, storeId?: string) {
    super(
      'ORDER_STATUS_LOCKED',
      `Order ${orderId} is ${status}; its status cannot be changed here`,
      {
        storeId,
      },
    )
  }
}

/**
 * Cancel an order and give back the stock its unpacked lines hold. Units
 * already packed have left on hand and stay gone. The status flip is the
 * guard: only the call that moves the order out of a live status releases
 * anything, so a repeated cancel is a no-op.
 */
export async function cancelOrder(
  ctx: StoreContext,
  orderId: string,
  opts: {
    /** False when the store keeps a forfeited pre-order deposit, gift card part included. */
    returnGiftCards?: boolean | undefined
    /**
     * False when the caller already tells the shopper their order was cancelled in a more
     * specific way (the unpaid-transfer cancel has its own dedicated message). Defaults to
     * true: writes `order.cancel_notice`, which sends the generic `order_cancelled` message.
     */
    notifyCustomer?: boolean | undefined
    /**
     * False: the units the order held unpacked do not go back on sale (an automation's
     * "Restock" off); they are written off, so available stock stays as it was.
     */
    restock?: boolean | undefined
  } = {},
) {
  // An order older than parcels gets them while it is still live, so they hold its stock.
  await ensureFulfillmentOrders(ctx, orderId)
  const [cancelled] = await ctx.tx
    .update(order)
    .set({ status: 'cancelled' })
    .where(and(eq(order.id, orderId), notInArray(order.status, ['cancelled', 'draft'])))
    .returning()
  if (!cancelled) {
    const [current] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
    if (current?.status === 'draft') throw new OrderStatusLocked(orderId, 'draft', ctx.storeId)
    return current ?? null
  }
  // Each parcel gives back its unpacked units at its own location (gift cards hold none).
  await releaseFulfillmentOrders(ctx, orderId, { restock: opts.restock })
  // Store credit held for a payment that never came goes back whatever else is kept: it was
  // never the order's money.
  await releaseHeldStoreCredit(ctx, orderId)
  if (opts.returnGiftCards !== false) await returnGiftCardPayments(ctx, orderId)
  if (opts.notifyCustomer !== false) {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.cancel_notice', { orderId })
  }
  await recomputeOrderStatuses(ctx, orderId)
  const [after] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  return after ?? cancelled
}

/**
 * "Mark as paid": the money arrived outside a gateway (cash on delivery, a
 * transfer matched by hand). The newest open checkout attempt becomes the
 * capture, through `applyPaymentStatus` like any gateway capture; with none
 * open, a manual payment for what is still due is recorded, so the payment
 * rows always explain the derived status.
 */
async function markPaid(ctx: StoreContext, o: typeof order.$inferSelect) {
  const [open] = await ctx.tx
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, o.id),
        eq(payment.purpose, 'order'),
        inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
        notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS]),
      ),
    )
    .orderBy(desc(payment.attempt), desc(payment.id))
    .limit(1)
  if (open) {
    // Captures the held store credit with it (`applyPaymentStatus`).
    await applyPaymentStatus(ctx, {
      paymentId: open.id,
      status: 'captured',
      providerPaymentId: null,
    })
    return
  }
  // No attempt open: held store credit still counts, and only the rest is recorded as manual.
  await captureHeldStoreCredit(ctx, o.id)
  const rows = await ctx.tx
    .select({
      status: payment.status,
      amountPaise: payment.amountPaise,
      refundNeeded: payment.refundNeeded,
    })
    .from(payment)
    .where(eq(payment.orderId, o.id))
  const due = checkoutDuePaise(o) - capturedPaise(rows.map((r) => ({ ...r, refundedPaise: 0 })))
  if (due <= 0) return
  await ctx.tx.insert(payment).values({
    storeId: ctx.storeId,
    orderId: o.id,
    provider: 'manual',
    providerRef: `manual_${o.id}_${Date.now()}`,
    status: 'captured',
    amountPaise: due,
  })
}

/**
 * The merchant's status menu. Each choice records the underlying fact and
 * lets `recomputeOrderStatuses` derive the rest: paid captures the money,
 * fulfilled packs whatever is left, delivered packs and marks the hand-over,
 * cancelled releases stock. Drafts are converted, not re-statused, and a
 * cancelled order stays cancelled, since reopening it would need its stock
 * held again.
 */
export async function changeOrderStatus(
  ctx: StoreContext,
  orderId: string,
  change: OrderStatusChange,
) {
  const [current] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!current) return null
  if (change === 'cancelled') {
    return cancelOrder(ctx, orderId)
  }
  if (current.status === 'draft' || current.status === 'cancelled') {
    throw new OrderStatusLocked(orderId, current.status, ctx.storeId)
  }
  if (change === 'paid') await markPaid(ctx, current)
  if (change === 'fulfilled' || change === 'delivered') {
    // "Mark as fulfilled / delivered" on a held order is refused until the hold is released.
    await assertNotHeld(ctx, orderId)
    await fulfilRemainingLines(ctx, orderId)
  }
  if (change === 'delivered') {
    const [marked] = await ctx.tx
      .update(order)
      .set({ deliveredAt: new Date() })
      .where(and(eq(order.id, orderId), isNull(order.deliveredAt)))
      .returning({ id: order.id })
    // Tracking may already have flipped the shipment to delivered (see `applyTracking`),
    // which sends the same message; the notification job id makes a repeat harmless.
    if (marked) await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.delivered', { orderId })
    // The hand-over happened: its parcels read Delivered too, not "Label created" (audit #122).
    await ctx.tx
      .update(shipment)
      .set({ status: 'delivered', updatedAt: new Date() })
      .where(
        and(
          eq(shipment.orderId, orderId),
          notInArray(shipment.status, ['delivered', 'cancelled', 'rto']),
        ),
      )
  }
  await recomputeOrderStatuses(ctx, orderId)
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  return o ?? null
}
