/** SOURCE OF TRUTH: return email data — WHAT: the template fields a return_* message needs (the items going back, the refund, the pickup), the repeat approval message when a courier is booked after it went out, and the exchange-on-its-way message when an exchange draft becomes an order / WHY: `deliverNotification` builds order messages; a return message swaps in the return's own lines and details */
import { order, orderLine, outboxEvent, returnRequest, returnRequestLine } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { TemplateData } from '@commerce/notifications'
import { and, eq, isNull, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { RETURN_REASON_LABELS, type ReturnReason, returnLabel } from './policy'

export async function returnTemplateData(
  ctx: StoreContext,
  returnId: string,
): Promise<Partial<TemplateData> | null> {
  const [r] = await ctx.tx.select().from(returnRequest).where(eq(returnRequest.id, returnId))
  if (!r) return null
  const lines = await ctx.tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      unitPricePaise: orderLine.unitPricePaise,
      quantity: returnRequestLine.quantity,
    })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, returnId))
  const value = lines.reduce((s, l) => s + l.quantity * l.unitPricePaise, 0)
  const [from] = await ctx.tx
    .select({ number: order.number })
    .from(order)
    .where(eq(order.id, r.orderId))
  const reason = r.reason as ReturnReason | null
  return {
    lines: lines.map((l) => ({
      title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
        .filter(Boolean)
        .join(' / '),
      quantity: l.quantity,
      priceLabel: formatMoney(l.quantity * l.unitPricePaise, 'INR'),
    })),
    totalLabel: formatMoney(value, 'INR'),
    taxBreakdown: undefined,
    returnInfo: {
      label: returnLabel(r.number),
      reasonLabel: reason ? RETURN_REASON_LABELS[reason] : undefined,
      decisionNote: r.decisionNote ?? undefined,
      pickup: r.pickupMethod ?? undefined,
      pickupWaybill: r.pickupWaybill ?? undefined,
      refundLabel:
        r.refundAmountPaise !== null ? formatMoney(r.refundAmountPaise, 'INR') : undefined,
      refundMethod:
        r.resolution === 'store_credit'
          ? 'store_credit'
          : r.resolution === 'refund'
            ? 'original'
            : undefined,
      originalOrderNumber: from?.number,
    },
  }
}

/**
 * A return's exchange draft was turned into an order (`convertDraft`): the shopper hears the
 * replacement is on its way, about the new order (its number, link and items). Any other draft
 * converts silently, as before.
 */
export async function announceExchangeOrder(ctx: StoreContext, orderId: string) {
  const [r] = await ctx.tx
    .select({ id: returnRequest.id })
    .from(returnRequest)
    .where(and(eq(returnRequest.storeId, ctx.storeId), eq(returnRequest.exchangeOrderId, orderId)))
    .limit(1)
  if (!r) return
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.exchanged', { orderId, returnId: r.id })
}

/**
 * A courier booked after the approval went out (the merchant picked "later", or the store's
 * auto-approve rule took the request): that email told the shopper to send the parcel
 * themselves, so they get the approval again, now with the courier and its tracking number.
 * Booked in the same step as the approval, the pending approval message already carries it.
 */
export async function announceLatePickup(ctx: StoreContext, r: { id: string; orderId: string }) {
  const [pending] = await ctx.tx
    .select({ id: outboxEvent.id })
    .from(outboxEvent)
    .where(
      and(
        eq(outboxEvent.storeId, ctx.storeId),
        eq(outboxEvent.type, 'return.approved'),
        isNull(outboxEvent.dispatchedAt),
        sql`${outboxEvent.payload}->>'returnId' = ${r.id}`,
      ),
    )
    .limit(1)
  if (pending) return
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.approved', {
    orderId: r.orderId,
    returnId: r.id,
  })
}
