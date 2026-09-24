import { order, orderLine, payment } from '@commerce/db'
import { and, eq, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { releaseCommittedStock } from './committed-stock'
import { fulfilRemainingLines } from './fulfil'
import { refundedPaise, refundPayment } from './refund'

/**
 * A cancelled order gives back whatever it took from gift cards, straight onto
 * the same cards. Gateway money is still refunded by the merchant; gift card
 * balances are returned here because nothing else would ever release them.
 */
async function returnGiftCardPayments(ctx: StoreContext, orderId: string) {
  const rows = await ctx.tx
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, GIFT_CARD_PROVIDER),
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

export type OrderStatusChange = 'placed' | 'paid' | 'fulfilled' | 'delivered' | 'cancelled'

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
 * guard: only the call that moves the order out of an open status releases
 * anything, so a repeated cancel is a no-op.
 */
export async function cancelOrder(
  ctx: StoreContext,
  orderId: string,
  opts: {
    /** False when the store keeps a forfeited pre-order deposit, gift card part included. */
    returnGiftCards?: boolean | undefined
  } = {},
) {
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
  const lines = await ctx.tx
    .select()
    .from(orderLine)
    .where(eq(orderLine.orderId, orderId))
    .for('update')
  for (const line of lines) {
    // Gift card lines hold no stock.
    if (line.giftCard) continue
    await releaseCommittedStock(ctx, {
      variantId: line.variantId,
      quantity: line.quantity - line.fulfilledQuantity,
    })
  }
  if (opts.returnGiftCards !== false) await returnGiftCardPayments(ctx, orderId)
  return cancelled
}

/**
 * The merchant's status menu. Keeps stock in step with the status: fulfilled
 * or delivered packs whatever is left, cancelled releases it. Drafts are
 * converted, not re-statused, and a cancelled order stays cancelled, since
 * reopening it would need its stock held again.
 */
export async function changeOrderStatus(
  ctx: StoreContext,
  orderId: string,
  status: OrderStatusChange,
) {
  const [current] = await ctx.tx
    .select({ status: order.status })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  if (!current) return null
  if (status === 'cancelled') {
    return cancelOrder(ctx, orderId)
  }
  if (current.status === 'draft' || current.status === 'cancelled') {
    throw new OrderStatusLocked(orderId, current.status, ctx.storeId)
  }
  if (status === 'fulfilled' || status === 'delivered') {
    await fulfilRemainingLines(ctx, orderId)
  }
  const [o] = await ctx.tx.update(order).set({ status }).where(eq(order.id, orderId)).returning()
  return o ?? null
}
