/** SOURCE OF TRUTH: cancelOrderByStaff — WHAT: the order page's "Cancel order" with a reason, restock, notify and refund choice / WHY: one call cancels, gives stock back (or not), refunds the chosen way and records it on the timeline */

import { order, orderNote } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { PaymentProvider } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import { canStaffCancel } from './edit-rules'
import { RefundNotAllowed } from './refund'
import { type RefundRoute, refundOptions, refundOrderAmount } from './refund-routes'
import { cancelOrder } from './status'
import { takeOverImportedOrder } from './takeover'

class OrderNotCancellable extends CommerceError {
  constructor(orderId: string, status: string, storeId?: string) {
    super(
      'ORDER_NOT_CANCELLABLE',
      `Order ${orderId} is ${status}: only an order that has not been shipped can be cancelled`,
      { storeId },
    )
  }
}

/** Why staff cancelled, Shopify-style (#125); stored on the order with the optional note. */
export const ORDER_CANCEL_REASONS = ['customer', 'inventory', 'fraud', 'declined', 'other'] as const
export type OrderCancelReason = (typeof ORDER_CANCEL_REASONS)[number]

/** The timeline's words for each reason. */
const REASON_WORDS: Record<OrderCancelReason, string> = {
  customer: 'Customer changed their mind',
  inventory: 'Out of stock',
  fraud: 'Fraudulent or suspicious order',
  declined: 'Payment declined',
  other: 'Other',
}

export type StaffCancelInput = {
  orderId: string
  /** The reason picked from the list. */
  reasonCode?: OrderCancelReason | undefined
  /** An optional note in the merchant's words (before #125, the only reason); on the timeline. */
  reason?: string | undefined
  /** Put the unsent items back on sale. Off: written off, availability stays as it is. */
  restock: boolean
  /** Send the shopper the "order cancelled" message. */
  notifyCustomer: boolean
  /** How the money taken goes back (`refund-routes.ts`). */
  refund: RefundRoute
  author: string
  /** For `store_credit`: the settings secret the gift card code is encrypted with. */
  settingsSecret?: string | undefined
  /** For `store_credit`: the card's last day (YYYY-MM-DD); none, it never expires. */
  storeCreditExpiresOn?: string | null | undefined
}

const ROUTE_WORDS: Record<RefundRoute, string> = {
  original: 'refunded to the original payment',
  manual: 'marked as refunded by hand',
  store_credit: 'given back as store credit',
  none: 'not refunded',
}

/** The timeline line: who cancelled, why, and what happened to the stock and the money. */
const CANCEL_NOTE = (input: {
  reasonCode?: OrderCancelReason | undefined
  reason?: string | undefined
  restock: boolean
  notifyCustomer: boolean
  refund: RefundRoute
  refundedPaise: number
  /** Money taken that is still with the store after the cancel (chosen: no refund). */
  keptPaise: number
}) =>
  [
    'Order cancelled.',
    input.reasonCode ? `Reason: ${REASON_WORDS[input.reasonCode]}.` : '',
    input.reason?.trim() ? `${input.reasonCode ? 'Note' : 'Reason'}: ${input.reason.trim()}.` : '',
    input.restock ? 'Items restocked.' : 'Items not restocked.',
    input.refundedPaise > 0
      ? `${formatMoney(input.refundedPaise, 'INR', { showZeroDecimals: true })} ${ROUTE_WORDS[input.refund]}.`
      : input.keptPaise > 0
        ? `Not refunded: ${formatMoney(input.keptPaise, 'INR', { showZeroDecimals: true })} left to refund.`
        : 'Nothing to refund.',
    input.notifyCustomer ? 'Customer notified.' : 'Customer not notified.',
  ]
    .filter(Boolean)
    .join(' ')

/**
 * Cancel from the order page. An imported order still open is taken over first
 * (`takeOverImportedOrder`), so its stock is handled like any order's. The refund route is
 * checked before anything changes (the whole call is one transaction: a gateway that refuses
 * rolls the cancel back). Then the order is cancelled (`cancelOrder`: stock released or written
 * off, gift cards returned, the shopper told when asked), what is left of the money goes back
 * the chosen way, and the timeline records it. Apps hear `order.cancelled` either way.
 */
export async function cancelOrderByStaff(
  ctx: StoreContext,
  input: StaffCancelInput,
  providers: readonly PaymentProvider[],
): Promise<typeof order.$inferSelect> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId)).for('update')
  if (!o) throw new OrderNotCancellable(input.orderId, 'missing', ctx.storeId)
  if (!canStaffCancel(o)) {
    throw new OrderNotCancellable(
      input.orderId,
      o.importedFrom ? 'imported history' : o.status,
      ctx.storeId,
    )
  }
  if (o.importedFrom) await takeOverImportedOrder(ctx, input.orderId, input.author)
  const before = await refundOptions(ctx, input.orderId, providers)
  if (input.refund === 'original' && before.refundablePaise > 0 && !before.original) {
    throw new RefundNotAllowed(
      'This payment cannot be refunded from here; mark it as refunded by hand instead',
      ctx.storeId,
    )
  }
  await cancelOrder(ctx, input.orderId, {
    restock: input.restock,
    notifyCustomer: input.notifyCustomer,
  })
  await ctx.tx
    .update(order)
    .set({ cancelReason: input.reasonCode ?? null, cancelNote: input.reason?.trim() || null })
    .where(eq(order.id, input.orderId))
  // `order.cancel_notice` already reaches apps as a cancel; without it they still must hear it.
  if (!input.notifyCustomer) {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.cancelled', { orderId: input.orderId })
  }
  // Gift cards went back inside the cancel; this is what is left.
  const left = await refundOptions(ctx, input.orderId, providers)
  const refundedPaise = input.refund === 'none' ? 0 : left.refundablePaise
  await refundOrderAmount(ctx, {
    orderId: input.orderId,
    amountPaise: refundedPaise,
    route: input.refund,
    reason:
      input.reason?.trim() ||
      (input.reasonCode ? REASON_WORDS[input.reasonCode] : null) ||
      'Order cancelled',
    providers,
    storeCredit:
      input.refund === 'store_credit' && input.settingsSecret
        ? {
            secret: input.settingsSecret,
            createdBy: input.author,
            expiresOn: input.storeCreditExpiresOn ?? null,
          }
        : undefined,
  })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: input.orderId,
    body: CANCEL_NOTE({
      ...input,
      refundedPaise,
      keptPaise: input.refund === 'none' ? left.refundablePaise : 0,
    }),
    author: input.author,
  })
  const [after] = await ctx.tx.select().from(order).where(eq(order.id, input.orderId))
  if (!after) throw new OrderNotCancellable(input.orderId, 'missing', ctx.storeId)
  return after
}
