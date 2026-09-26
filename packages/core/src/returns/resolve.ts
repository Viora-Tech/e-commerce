/** SOURCE OF TRUTH: return resolutions — WHAT: settle a received return or RTO with a refund to the original payment, store credit, an exchange draft or a re-shipment / WHY: every way money or goods go back to the shopper runs through the existing refund, gift card, draft and shipment paths, so order statuses and the ledger stay right */
import { address, customer, order, orderLine, payment, returnRequestLine } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import type { ShippingProvider } from '@commerce/shipping'
import { and, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { issueGiftCard } from '../gift-cards/service'
import { adjustStock } from '../inventory/levels'
import { createDraft } from '../order/drafts'
import { refundedPaise, refundPayment } from '../order/refund'
import { insertOutboxEvent } from '../outbox/write'
import { createShipmentForOrder } from '../shipping/shipments'
import { returnLabel } from './policy'
import { lockReturn, ReturnNotAllowed, sellingLocation, updateReturnRow } from './service'

/** Captured payments on an order and how much of each can still go back. */
export async function refundablePayments(ctx: StoreContext, orderId: string) {
  const rows = await ctx.tx
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        inArray(payment.status, ['captured', 'refunded']),
        eq(payment.refundNeeded, false),
      ),
    )
  const out: { id: string; provider: string; availablePaise: number }[] = []
  for (const p of rows) {
    const left = p.amountPaise - (await refundedPaise(ctx, p.id))
    if (left > 0) out.push({ id: p.id, provider: p.provider, availablePaise: left })
  }
  return out.sort((a, b) => b.availablePaise - a.availablePaise)
}

/**
 * The refund to suggest: what the returned items cost after the order's
 * discount, never more than can still go back. An RTO suggests the whole
 * order (shipping included), since nothing reached the shopper.
 */
export async function suggestedRefundPaise(ctx: StoreContext, returnId: string): Promise<number> {
  const r = await lockReturn(ctx, returnId)
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, r.orderId))
  if (!o) return 0
  const available = (await refundablePayments(ctx, o.id)).reduce((s, p) => s + p.availablePaise, 0)
  if (r.kind === 'rto') return available
  const lines = await ctx.tx
    .select({ quantity: returnRequestLine.quantity, unitPricePaise: orderLine.unitPricePaise })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, returnId))
  const value = lines.reduce((s, l) => s + l.quantity * l.unitPricePaise, 0)
  const share = o.subtotalPaise > 0 ? (o.subtotalPaise - o.discountPaise) / o.subtotalPaise : 1
  return Math.max(0, Math.min(available, Math.round(value * share)))
}

function assertResolvable(ctx: StoreContext, r: { status: string; number: number }) {
  if (r.status !== 'received') {
    throw new ReturnNotAllowed(
      `Return ${returnLabel(r.number)} must be received before it is settled.`,
      ctx.storeId,
    )
  }
}

export type RefundReturnInput = {
  amountPaise: number
  /** The installed gateway for a payment's provider id; null when it is not connected. */
  providerFor: (providerId: string) => Promise<PaymentProvider | null>
}

/**
 * Give money back to the way the shopper paid, through the same refund path
 * as the order page (`refundPayment`), largest payment first. Full or partial.
 */
export async function refundReturn(ctx: StoreContext, id: string, input: RefundReturnInput) {
  const r = await lockReturn(ctx, id)
  assertResolvable(ctx, r)
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new ReturnNotAllowed('Enter an amount to refund.', ctx.storeId)
  }
  const payments = await refundablePayments(ctx, r.orderId)
  const available = payments.reduce((s, p) => s + p.availablePaise, 0)
  if (input.amountPaise > available) {
    throw new ReturnNotAllowed('That is more than is left to refund on this order.', ctx.storeId)
  }
  let left = input.amountPaise
  const refundIds: string[] = []
  const reason = `${r.kind === 'rto' ? 'RTO' : 'Return'} ${returnLabel(r.number)}`
  for (const p of payments) {
    if (left <= 0) break
    const amount = Math.min(left, p.availablePaise)
    const row = await refundPayment(ctx, await input.providerFor(p.provider), {
      paymentId: p.id,
      amountPaise: amount,
      reason,
    })
    if (row) {
      refundIds.push(row.id)
      if (row.status !== 'failed') {
        await insertOutboxEvent(ctx.tx, ctx.storeId, 'refund.created', {
          orderId: r.orderId,
          refundId: row.id,
        })
      }
    }
    left -= amount
  }
  const row = await updateReturnRow(ctx, id, {
    status: 'resolved',
    resolution: 'refund',
    refundAmountPaise: input.amountPaise,
    refundIds,
    resolvedAt: new Date(),
  })
  if (r.kind === 'return') {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.refunded', {
      orderId: r.orderId,
      returnId: r.id,
    })
  }
  return row
}

/**
 * Give the money back as store credit: a gift card in the shopper's name, the
 * platform's existing gift card. Returns the code once so the caller can email it.
 */
export async function storeCreditReturn(
  ctx: StoreContext,
  id: string,
  input: { amountPaise: number; secret: string; createdBy?: string | undefined },
) {
  const r = await lockReturn(ctx, id)
  assertResolvable(ctx, r)
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, r.orderId))
  if (!o) throw new ReturnNotAllowed('Order not found', ctx.storeId)
  const [cu] = o.customerId
    ? await ctx.tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const issued = await issueGiftCard(
    ctx,
    {
      valuePaise: input.amountPaise,
      customerId: o.customerId,
      recipientEmail: o.email,
      recipientName: cu?.name ?? null,
      note: `Store credit for return ${returnLabel(r.number)} (order #${o.number})`,
      createdBy: input.createdBy ?? null,
      orderId: o.id,
    },
    input.secret,
  )
  if (!issued) throw new ReturnNotAllowed('The store credit could not be created.', ctx.storeId)
  const row = await updateReturnRow(ctx, id, {
    status: 'resolved',
    resolution: 'store_credit',
    refundAmountPaise: input.amountPaise,
    giftCardId: issued.card.id,
    resolvedAt: new Date(),
  })
  if (r.kind === 'return') {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'return.refunded', {
      orderId: r.orderId,
      returnId: r.id,
    })
  }
  return { row, giftCardId: issued.card.id }
}

/**
 * Send replacements: a draft order for the same items (or the ones given) at
 * no charge, to the same address. The merchant reviews it and turns it into
 * an order from Drafts, which reserves the stock and ships like any other.
 */
export async function exchangeReturn(
  ctx: StoreContext,
  id: string,
  input: { lines?: { variantId: string; quantity: number }[] | undefined } = {},
) {
  const r = await lockReturn(ctx, id)
  assertResolvable(ctx, r)
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, r.orderId))
  if (!o) throw new ReturnNotAllowed('Order not found', ctx.storeId)
  const returned = await ctx.tx
    .select({ variantId: orderLine.variantId, quantity: returnRequestLine.quantity })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, id))
  const lines = (input.lines?.length ? input.lines : returned).map((l) => ({
    variantId: l.variantId,
    quantity: l.quantity,
    unitPricePaise: 0,
  }))
  const [addr] = o.shippingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const [cu] = o.customerId
    ? await ctx.tx.select().from(customer).where(eq(customer.id, o.customerId))
    : []
  const draft = await createDraft(ctx, {
    customerId: o.customerId,
    email: o.email,
    phone: o.phone,
    customerName: cu?.name ?? null,
    shipping: addr
      ? {
          name: addr.name,
          line1: addr.line1,
          line2: addr.line2 ?? undefined,
          city: addr.city,
          stateCode: addr.stateCode,
          pincode: addr.pincode,
          phone: addr.phone,
        }
      : null,
    lines,
    discountPaise: 0,
    shippingPaise: 0,
    paymentMethod: 'manual',
    note: `Exchange for return ${returnLabel(r.number)} of order #${o.number}`,
  })
  const row = await updateReturnRow(ctx, id, {
    status: 'resolved',
    resolution: 'exchange',
    exchangeOrderId: draft.id,
    resolvedAt: new Date(),
  })
  return { row, draftId: draft.id, draftNumber: draft.number }
}

/**
 * Send an RTO parcel out again: a new shipment with the courier. If the items
 * were put back in stock meanwhile, they come out again first.
 */
export async function reshipReturn(ctx: StoreContext, id: string, provider: ShippingProvider) {
  const r = await lockReturn(ctx, id)
  if (r.kind !== 'rto') throw new ReturnNotAllowed('Only an RTO can be re-shipped.', ctx.storeId)
  assertResolvable(ctx, r)
  const lines = await ctx.tx
    .select({
      restocked: returnRequestLine.restockedQuantity,
      variantId: orderLine.variantId,
    })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, id))
  for (const l of lines) {
    if (l.restocked <= 0) continue
    await adjustStock(ctx.tx, {
      storeId: ctx.storeId,
      variantId: l.variantId,
      locationId: await sellingLocation(ctx, l.variantId),
      delta: -l.restocked,
      reason: 'sold',
      note: `Re-shipped after RTO ${returnLabel(r.number)}`,
    })
  }
  const next = await createShipmentForOrder(ctx, provider, r.orderId)
  return updateReturnRow(ctx, id, {
    status: 'resolved',
    resolution: 'reship',
    reshipShipmentId: next.id,
    resolvedAt: new Date(),
  })
}
