/** SOURCE OF TRUTH: store credit at checkout — WHAT: spending a signed-in shopper's store credit on a new order (held until the gateway is paid, captured when it covers the order), capturing the hold when the payment arrives, and giving a hold back when the order is cancelled unpaid / WHY: a failed or abandoned online payment must never cost the shopper their credit, and two checkouts at once must never spend the same rupee */
import { order, payment } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { changeStoreCredit, StoreCreditError } from './store-credit'
import { lockStoreCreditBalance } from './store-credit-expiry'

/*
 * How store credit pays for a checkout order:
 *
 * - The balance is debited when the order is placed (one ledger line, kind `payment`, linked to
 *   the order), under the account's row lock, so two checkouts at once queue on the same row and
 *   the second only sees what the first left. The balance never goes below zero (a check
 *   constraint backs this up).
 * - The order gets a `store_credit` payment row for that amount. Store credit that covers
 *   everything due now is `captured` at once. With a gateway taking the rest it is `pending`: a
 *   hold, not money the order has. It is captured in the same transaction that records the
 *   gateway's capture (`captureHeldStoreCredit`, from `applyPaymentStatus`).
 * - An order cancelled before it was paid (the unpaid-order expiry after 30 minutes, an unpaid
 *   transfer, staff) gives a hold back with a `release` ledger line
 *   (`releaseHeldStoreCredit`, from `cancelOrder`). A captured store credit payment goes back
 *   onto the balance as a refund, the way gift card money goes back onto its card.
 *
 * Store credit is a payment, not a discount: the order's total, taxable value and GST are worked
 * out before this runs and are never changed by it.
 */

export type StoreCreditSpend = { paymentId: string; amountPaise: number; balancePaise: number }

/**
 * Take up to `duePaise` from the customer's balance for the order. Returns null when there is
 * nothing to take (no account, a zero balance or nothing due). `cover: 'all'` refuses (and takes
 * nothing) when the balance does not cover everything due: cash on delivery cannot collect what
 * store credit leaves, as with gift cards.
 */
export async function spendStoreCreditOnOrder(
  ctx: StoreContext,
  input: {
    orderId: string
    customerId: string
    /** What is still due now, after gift cards. */
    duePaise: number
    cover?: 'all' | 'any' | undefined
  },
): Promise<StoreCreditSpend | null> {
  if (input.duePaise <= 0) return null
  const [o] = await ctx.tx
    .select({ id: order.id, number: order.number, customerId: order.customerId })
    .from(order)
    .where(eq(order.id, input.orderId))
  if (!o) throw new StoreCreditError('not_found', 'Order not found', ctx.storeId)
  // The credit is the order's customer's: a refund of it goes back to the same balance.
  if (o.customerId !== input.customerId) {
    throw new StoreCreditError(
      'invalid',
      'Store credit could not be used on this order. Turn store credit off and try again.',
      ctx.storeId,
    )
  }
  // The row lock: a second checkout for the same customer waits here until this one commits.
  // Expired credit leaves the balance first, so it is never spent.
  const balance = await lockStoreCreditBalance(ctx, input.customerId)
  const amountPaise = Math.min(balance, input.duePaise)
  if (amountPaise <= 0) return null
  const covers = amountPaise >= input.duePaise
  if (!covers && input.cover === 'all') {
    throw new StoreCreditError(
      'invalid',
      'Cash on delivery cannot be used with store credit. Pay the rest online, or turn store credit off.',
      ctx.storeId,
    )
  }
  const { balancePaise } = await changeStoreCredit(ctx, {
    customerId: input.customerId,
    amountPaise: -amountPaise,
    kind: 'payment',
    reason: `Used on order #${o.number}`,
    orderId: o.id,
  })
  const [p] = await ctx.tx
    .insert(payment)
    .values({
      storeId: ctx.storeId,
      orderId: o.id,
      provider: STORE_CREDIT_PROVIDER,
      providerRef: `store_credit_${o.id}`,
      // Whose balance it came from: a release or refund goes back there.
      providerPaymentId: input.customerId,
      status: covers ? 'captured' : 'pending',
      amountPaise,
    })
    .returning({ id: payment.id })
  if (!p) throw new Error('store credit payment insert returned nothing')
  return { paymentId: p.id, amountPaise, balancePaise }
}

/**
 * The gateway paid the rest: the order's held store credit becomes money the order has. Runs in
 * the transaction that records the gateway capture, so the order reads paid in one step.
 */
export async function captureHeldStoreCredit(ctx: StoreContext, orderId: string): Promise<number> {
  const rows = await ctx.tx
    .update(payment)
    .set({ status: 'captured' })
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, STORE_CREDIT_PROVIDER),
        eq(payment.status, 'pending'),
      ),
    )
    .returning({ id: payment.id })
  return rows.length
}

/**
 * The order was cancelled before it was paid: every held store credit payment is cancelled and
 * its amount goes back onto the balance it came from, with a `release` line linked to the order.
 * Each hold is claimed by its status flip, so a repeated cancel gives nothing back twice.
 */
export async function releaseHeldStoreCredit(ctx: StoreContext, orderId: string): Promise<number> {
  const released = await ctx.tx
    .update(payment)
    .set({ status: 'cancelled', error: 'Order cancelled before it was paid' })
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, STORE_CREDIT_PROVIDER),
        eq(payment.status, 'pending'),
      ),
    )
    .returning({ amountPaise: payment.amountPaise, customerId: payment.providerPaymentId })
  if (released.length === 0) return 0
  const [o] = await ctx.tx
    .select({ number: order.number, customerId: order.customerId })
    .from(order)
    .where(eq(order.id, orderId))
  let total = 0
  for (const r of released) {
    const customerId = r.customerId ?? o?.customerId
    if (!customerId) continue
    await changeStoreCredit(ctx, {
      customerId,
      amountPaise: r.amountPaise,
      kind: 'release',
      reason: `Order #${o?.number ?? ''} was not paid: store credit returned`,
      orderId,
    })
    total += r.amountPaise
  }
  return total
}
