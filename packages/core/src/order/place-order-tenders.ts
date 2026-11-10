/** SOURCE OF TRUTH: redeemCards, spendStoreCredit
 * WHAT:  The checkout workflow's tender steps that pay before the gateway: gift cards, then the
 *        signed-in shopper's store credit.
 * WHY:   Split from `./place-order` by concern; the steps run in the same workflow there.
 * WHERE: `placeOrder` (./place-order.ts).
 */
import { spendStoreCreditOnOrder } from '../customers/store-credit-checkout'
import { GiftCardError, redeemGiftCards, reverseGiftCardRedemptions } from '../gift-cards/service'
import type { WorkflowStep } from '../workflow/run'
import { chargeNowPaise } from './place-order-rules'
import type { State } from './place-order-types'

/**
 * Spend the applied gift cards against the total. Runs after the order exists
 * (payments reference it) and before the provider is charged, so the provider
 * only ever sees the remainder. COD cannot collect a remainder: a card spent on
 * a parcel that is then refused would sit locked until someone refunded it.
 */
export const redeemCards: WorkflowStep<State> = {
  name: 'redeemGiftCards',
  async run({ ctx, input, orderId, totalPaise }) {
    const ids = input.giftCardIds ?? []
    if (!orderId || ids.length === 0) return {}
    const { redeemedPaise, redemptions } = await redeemGiftCards(ctx, {
      orderId,
      giftCardIds: ids,
      amountDuePaise: totalPaise,
    })
    if (redeemedPaise < totalPaise && input.paymentProvider.id === 'cod') {
      await reverseGiftCardRedemptions(ctx, redemptions)
      throw new GiftCardError(
        'not_allowed',
        'Cash on delivery cannot be used with a gift card. Pay the rest online.',
        ctx.storeId,
      )
    }
    return { giftCardPaise: redeemedPaise, redemptions }
  },
  async compensate({ ctx, redemptions }) {
    await reverseGiftCardRedemptions(ctx, redemptions)
  },
}

/**
 * Spend the signed-in shopper's store credit on what gift cards left of the amount due now
 * (`customers/store-credit-checkout.ts`). Covering it all, the credit is captured and no
 * provider is asked; otherwise it is held until the gateway is paid and given back if the order
 * is cancelled unpaid. Cash on delivery cannot collect a remainder, as with gift cards. Store
 * credit is a payment: the total, discount and GST were settled by `createOrder` and stay.
 * Everything here is in the checkout's transaction, so a later refusal undoes it.
 */
export const spendStoreCredit: WorkflowStep<State> = {
  name: 'spendStoreCredit',
  async run({ ctx, input, lines, orderId, totalPaise, balanceDuePaise, giftCardPaise }) {
    const customerId = input.storeCredit?.customerId
    // Store credit never buys a gift card (it would turn the balance into a code anyone can
    // spend); checkout does not offer it on a gift card basket, so it is simply not used.
    if (!orderId || !customerId || lines.some((l) => l.giftCard)) return {}
    const spent = await spendStoreCreditOnOrder(ctx, {
      orderId,
      customerId,
      duePaise: chargeNowPaise({ totalPaise, balanceDuePaise }) - giftCardPaise,
      cover: input.paymentProvider.id === 'cod' ? 'all' : 'any',
    })
    return spent ? { storeCreditPaise: spent.amountPaise } : {}
  },
}
