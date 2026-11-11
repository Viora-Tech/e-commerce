/** SOURCE OF TRUTH: paying a draft invoice online — WHAT: loads the signed invoice page, and turns the draft into an order with a fresh payment attempt / WHY: the storefront's invoice link pays through the same convert and attempt path as checkout */
import { order, orderLine, payment, store } from '@commerce/db'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { createPaymentAttempt } from '../payments/attempts'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { orderRef } from './draft-ref'
import { DraftPaidByStoreCredit, draftStoreCredit } from './draft-store-credit'
import { convertDraft } from './drafts'

/**
 * The customer pays a draft invoice online: the draft becomes an order on that gateway (stock
 * held, GST billed, exactly as the admin's convert), and gets a fresh payment attempt for its
 * total (less any store credit applied, held until it is paid), ready to start with the
 * gateway. The convert's placeholder "pending" payment is
 * replaced by the attempt, so retries and the webhook see a normal online order.
 * Throws what `convertDraft` throws (out of stock, not a draft, empty).
 */
export async function convertDraftForOnlinePayment(
  ctx: StoreContext,
  draftId: string,
  providerId: string,
): Promise<{ orderId: string; orderNumber: number; attemptId: string } | null> {
  // A shopper's unpaid checkout is paid from its own order page (retry), never converted unpaid.
  const [head] = await ctx.tx
    .select({ draftSource: order.draftSource, totalPaise: order.totalPaise })
    .from(order)
    .where(eq(order.id, draftId))
  if (head?.draftSource === 'checkout') return null
  // Store credit staff applied: held until the gateway pays the rest, the attempt asks only for
  // the rest. Credit covering it all leaves nothing to pay online: staff convert that one.
  const credit = (await draftStoreCredit(ctx, draftId))?.amountPaise ?? 0
  if (head && credit > 0 && head.totalPaise - credit <= 0) {
    throw new DraftPaidByStoreCredit(ctx.storeId)
  }
  const converted = await convertDraft(ctx, draftId, {
    paymentMethod: providerId,
    holdStoreCredit: true,
  })
  if (!converted) return null
  await ctx.tx
    .delete(payment)
    .where(and(eq(payment.orderId, draftId), eq(payment.providerRef, `draft_${draftId}`)))
  const attempt = await createPaymentAttempt(ctx, {
    orderId: draftId,
    provider: providerId,
    amountPaise: converted.totalPaise - credit,
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.placed', { orderId: draftId })
  return { orderId: draftId, orderNumber: converted.number, attemptId: attempt.id }
}

type InvoiceStatus = (typeof order.$inferSelect)['status']

/** Still waiting for its money: a draft, or the order it became, not yet paid. */
const invoicePayable = (o: { status: InvoiceStatus; checkoutPaidAt: Date | null }): boolean =>
  o.status === 'draft' || (o.status === 'open' && !o.checkoutPaidAt)

/**
 * Where a draft invoice's "Pay" stands: still a draft (convert it first), or already an order
 * (retry its payment), and whether anything is left to pay. Null when the order is gone.
 */
export async function draftInvoiceState(
  ctx: StoreContext,
  orderId: string,
): Promise<{ number: number; status: InvoiceStatus; payable: boolean } | null> {
  const [o] = await ctx.tx
    .select({ number: order.number, status: order.status, checkoutPaidAt: order.checkoutPaidAt })
    .from(order)
    .where(eq(order.id, orderId))
  return o ? { number: o.number, status: o.status, payable: invoicePayable(o) } : null
}

/**
 * What a draft invoice's signed page shows: the items, the total and the store's name, and
 * whether it is still payable. Null when the order is gone.
 */
export async function loadDraftInvoice(ctx: StoreContext, orderId: string) {
  const [o] = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      draftNumber: order.draftNumber,
      status: order.status,
      checkoutPaidAt: order.checkoutPaidAt,
      totalPaise: order.totalPaise,
    })
    .from(order)
    .where(eq(order.id, orderId))
  if (!o) return null
  const [s] = await ctx.tx.select({ name: store.name }).from(store).where(eq(store.id, ctx.storeId))
  const lines = await ctx.tx
    .select({
      id: orderLine.id,
      title: orderLine.title,
      variant: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
    })
    .from(orderLine)
    .where(eq(orderLine.orderId, o.id))
    .orderBy(asc(orderLine.id))
  // Store credit staff applied (still a draft), held or taken (once it is an order).
  const [credit] = await ctx.tx
    .select({ paise: sql<number>`coalesce(sum(${payment.amountPaise}), 0)::int` })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, o.id),
        eq(payment.provider, STORE_CREDIT_PROVIDER),
        inArray(payment.status, ['created', 'pending', 'captured']),
      ),
    )
  const storeCreditPaise = credit?.paise ?? 0
  return {
    id: o.id,
    number: o.number,
    /** What follows the # on the page: "D12" while a draft, the order number once placed. */
    ref: orderRef(o),
    totalPaise: o.totalPaise,
    /** Paid from the customer's store credit; the rest is what the Pay button asks for. */
    storeCreditPaise,
    duePaise: Math.max(0, o.totalPaise - storeCreditPaise),
    payable: invoicePayable(o),
    lines,
    storeName: s?.name ?? '',
  }
}
