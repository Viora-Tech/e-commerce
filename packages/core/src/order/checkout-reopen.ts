/** SOURCE OF TRUTH: another way to pay on the same checkout — WHAT: an order (or checkout draft) whose gateway refused the store's API keys before the shopper saw it is found from its cart, emptied and placed again on the same row with the way to pay the shopper picks next / WHY: a broken gateway used to leave the shopper a "Retry payment" that failed again, and every new try with another email became another unpaid order (Waimers #2447–#2453) */
import { cart, order, orderLine, payment } from '@commerce/db'
import { isKeysRefusedError } from '@commerce/payments'
import { desc, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { SPLIT_TENDER_PROVIDERS } from '../payments/split-tender'
import {
  cancelOpenAttempts,
  clearDraftForRetry,
  isOpenCheckoutDraft,
  releaseOrderDiscountUses,
} from './checkout-draft'
import { deleteFulfillmentOrders, releaseFulfillmentOrders } from './fulfillment-orders'
import type { RewriteTarget } from './place-order-types'

/** Timeline note when the shopper paid another way after the gateway refused the store's keys. */
export const PAID_ANOTHER_WAY_NOTE = (method: string) =>
  `Online payment was unavailable (the payment gateway rejected the store's API keys), so the shopper checked out again with ${method}.`

/**
 * The cart's order that waits for another way to pay: still open (or an open checkout draft),
 * nothing paid, its latest checkout attempt refused for the store's keys, and no gift card or
 * store credit on it (those are left to the order page). The order row is locked. Null otherwise.
 */
export async function orderAwaitingAnotherMethod(
  ctx: StoreContext,
  where: { cartId: string } | { orderId: string },
): Promise<RewriteTarget | null> {
  const [o] = await ctx.tx
    .select()
    .from(order)
    .where('cartId' in where ? eq(order.cartId, where.cartId) : eq(order.id, where.orderId))
    .for('update')
  if (!o || o.checkoutPaidAt) return null
  if (o.status !== 'open' && !isOpenCheckoutDraft(o)) return null
  const pays = await ctx.tx
    .select({
      provider: payment.provider,
      status: payment.status,
      purpose: payment.purpose,
      error: payment.error,
    })
    .from(payment)
    .where(eq(payment.orderId, o.id))
    .orderBy(desc(payment.attempt), desc(payment.id))
  if (pays.some((p) => (SPLIT_TENDER_PROVIDERS as readonly string[]).includes(p.provider))) {
    return null
  }
  const latest = pays.find((p) => p.purpose === 'order')
  if (latest?.status !== 'failed' || !isKeysRefusedError(latest.error)) return null
  if (pays.some((p) => p.status === 'captured' || p.status === 'authorized')) return null
  return {
    id: o.id,
    number: o.number,
    draftNumber: o.draftNumber,
    wasDraft: o.status === 'draft',
    failedProvider: latest.provider,
  }
}

/**
 * Empty the order for the checkout to write again: its stock hold, parcels, discount uses,
 * lines and unanswered attempts go; the row, its id and its number (or #D number) stay, and the
 * cart opens again for the checkout's own steps (which convert it back). Runs in the checkout's
 * transaction: a refusal later puts everything back.
 */
export async function clearOrderForAnotherMethod(
  ctx: StoreContext,
  target: RewriteTarget,
  cartId: string,
): Promise<void> {
  if (target.wasDraft) {
    await clearDraftForRetry(ctx, target.id)
  } else {
    await releaseFulfillmentOrders(ctx, target.id)
    await deleteFulfillmentOrders(ctx.tx, target.id)
    await releaseOrderDiscountUses(ctx, target.id)
    await cancelOpenAttempts(ctx, target.id, 'Replaced: the shopper chose another way to pay')
    await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, target.id))
  }
  await ctx.tx.update(cart).set({ status: 'open' }).where(eq(cart.id, cartId))
}

/** True when the cart's checkout waits for another way to pay (the checkout page may show it). */
export async function cartAwaitsAnotherMethod(ctx: StoreContext, cartId: string): Promise<boolean> {
  return (await orderAwaitingAnotherMethod(ctx, { cartId })) !== null
}
