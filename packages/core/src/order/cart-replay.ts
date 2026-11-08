/** SOURCE OF TRUTH: lockCartOrReplay
 * WHAT:  The cart lock taken before checkout runs, and the earlier order handed back when the
 *        cart was already converted (a double submit).
 * WHY:   Split from place-order.ts (#973); placeOrder calls it first, inside its transaction.
 */
import { cart, order, payment } from '@commerce/db'
import type { CheckoutSession } from '@commerce/payments'
import { and, desc, eq, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { SPLIT_TENDER_PROVIDERS } from '../payments/split-tender'
import type { PlaceOrderResult } from './place-order-types'

/**
 * Lock the cart row until the transaction ends, so two submits of one cart (a
 * double tap, a retry on a flaky connection) run one after the other. The
 * second then finds the cart converted and gets the first order back, with the
 * same payment session, instead of placing a duplicate. The unique
 * `(store_id, cart_id)` index on `order` is the backstop.
 *
 * Pattern from Saleor's `create_order_from_checkout` (BSD-3): `select_for_update`
 * on the checkout, and `Order.checkout_token` to find the order on replay.
 */
export async function lockCartOrReplay(
  ctx: StoreContext,
  cartId: string,
): Promise<PlaceOrderResult | null> {
  const [c] = await ctx.tx
    .select({ status: cart.status })
    .from(cart)
    .where(eq(cart.id, cartId))
    .for('update')
  if (c?.status !== 'converted') return null
  const [o] = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      paymentMethod: order.paymentMethod,
      depositPaise: order.depositPaise,
      balanceDuePaise: order.balanceDuePaise,
    })
    .from(order)
    .where(eq(order.cartId, cartId))
  // Converted before orders recorded their cart: nothing to replay.
  if (!o) return null
  const [p] = await ctx.tx
    .select({
      id: payment.id,
      status: payment.status,
      checkoutSession: payment.checkoutSession,
    })
    .from(payment)
    .where(
      and(eq(payment.orderId, o.id), notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS])),
    )
    .orderBy(desc(payment.attempt), desc(payment.id))
    .limit(1)
  if (!p) {
    // Paid in full by gift cards or store credit: no provider payment was ever created.
    const providerRef = `${o.paymentMethod ?? GIFT_CARD_PROVIDER}_${o.id}`
    return {
      orderId: o.id,
      orderNumber: o.number,
      attemptId: null,
      paymentStatus: 'captured',
      session: { kind: 'none', provider: o.paymentMethod ?? GIFT_CARD_PROVIDER, providerRef },
      replayed: true,
      depositPaise: o.depositPaise ?? 0,
      balanceDuePaise: o.balanceDuePaise ?? 0,
    }
  }
  // Still `created` when the first submit died before reaching the gateway: the
  // caller starts it, and the attempt's claim keeps that to one gateway call.
  return {
    orderId: o.id,
    orderNumber: o.number,
    attemptId: p.id,
    paymentStatus: p.status,
    depositPaise: o.depositPaise ?? 0,
    balanceDuePaise: o.balanceDuePaise ?? 0,
    session: (p.checkoutSession as CheckoutSession | null) ?? null,
    replayed: true,
  }
}
