/** SOURCE OF TRUTH: return resolutions — WHAT: settle a received return or RTO with a refund to the original payment, store credit, an exchange draft or a re-shipment / WHY: every way money or goods go back to the shopper runs through the existing refund, gift card, draft and shipment paths, so order statuses and the ledger stay right */
import { address, customer, order, orderLine, payment, returnRequestLine } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import type { ShippingProvider } from '@commerce/shipping'
import { and, eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { adjustStock } from '../inventory/levels'
import { createDraft } from '../order/drafts'
import { type RefundInput, type RefundMethod, refundedPaise, refundPayment } from '../order/refund'
import { insertOutboxEvent } from '../outbox/write'
import { createShipmentForOrder } from '../shipping/shipments'
import { returnLabel } from './policy'
import { exchangeLinesFor } from './preferences'
import { lockReturn, ReturnNotAllowed, returnLocation, updateReturnRow } from './service'

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
  const v = await returnValue(ctx, returnId)
  if (!v) return 0
  if (v.kind === 'rto') return v.availablePaise
  return Math.max(0, Math.min(v.availablePaise, v.goodsPaise))
}

/**
 * The most store credit a return can become: what the returned lines were sold for after
 * the order's discount, or, for an RTO, what was paid and not yet refunded. Without it
 * anyone who may refund could mint a gift card of any value on any received return.
 */
export function storeCreditCapPaise(v: {
  kind: 'return' | 'rto'
  goodsPaise: number
  availablePaise: number
}): number {
  return Math.max(0, v.kind === 'rto' ? v.availablePaise : v.goodsPaise)
}

async function returnValue(ctx: StoreContext, returnId: string) {
  const r = await lockReturn(ctx, returnId)
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, r.orderId))
  if (!o) return null
  const availablePaise = (await refundablePayments(ctx, o.id)).reduce(
    (s, p) => s + p.availablePaise,
    0,
  )
  const lines = await ctx.tx
    .select({ quantity: returnRequestLine.quantity, unitPricePaise: orderLine.unitPricePaise })
    .from(returnRequestLine)
    .innerJoin(orderLine, eq(orderLine.id, returnRequestLine.orderLineId))
    .where(eq(returnRequestLine.returnRequestId, returnId))
  const value = lines.reduce((s, l) => s + l.quantity * l.unitPricePaise, 0)
  const share = o.subtotalPaise > 0 ? (o.subtotalPaise - o.discountPaise) / o.subtotalPaise : 1
  const goodsPaise = Math.round(value * share)
  // An RTO of one parcel out of several is worth that parcel's goods, not the whole order.
  const kind =
    r.kind === 'rto' && !(await coversWholeOrder(ctx, o.id, returnId)) ? 'return' : r.kind
  return { kind, goodsPaise, availablePaise }
}

/** Whether a return holds every shipped unit of its order (an RTO of the only parcel). */
async function coversWholeOrder(ctx: StoreContext, orderId: string, returnId: string) {
  const shipped = await ctx.tx
    .select({ id: orderLine.id, quantity: orderLine.fulfilledQuantity })
    .from(orderLine)
    .where(and(eq(orderLine.orderId, orderId), eq(orderLine.giftCard, false)))
  const back = await ctx.tx
    .select({ id: returnRequestLine.orderLineId, quantity: returnRequestLine.quantity })
    .from(returnRequestLine)
    .where(eq(returnRequestLine.returnRequestId, returnId))
  const backBy = new Map(back.map((b) => [b.id, b.quantity]))
  return shipped.every((l) => l.quantity <= 0 || (backBy.get(l.id) ?? 0) >= l.quantity)
}

function assertResolvable(ctx: StoreContext, r: { status: string; number: number }) {
  if (r.status !== 'received') {
    throw new ReturnNotAllowed(
      `Return ${returnLabel(r.number)} must be received before it is settled.`,
      ctx.storeId,
    )
  }
}

/** How money recorded by hand went back on a return; store credit is its own resolution. */
export type HandRefundMethod = Exclude<RefundMethod, 'store_credit'>

export type RefundReturnInput = {
  amountPaise: number
  /** The installed gateway for a payment's provider id; null when it is not connected. */
  providerFor: (providerId: string) => Promise<PaymentProvider | null>
  /**
   * Paid back by hand (UPI, bank transfer, cash): recorded with this method and no gateway call,
   * like a refund recorded on the order page.
   */
  method?: HandRefundMethod | undefined
}

type LockedReturn = Awaited<ReturnType<typeof lockReturn>>
type Refundable = Awaited<ReturnType<typeof refundablePayments>>

/** Refuses an amount over what the order can still give back. */
function assertCovered(ctx: StoreContext, payments: Refundable, amountPaise: number) {
  const available = payments.reduce((s, p) => s + p.availablePaise, 0)
  if (amountPaise > available) {
    throw new ReturnNotAllowed('That is more than is left to refund on this order.', ctx.storeId)
  }
}

/**
 * Spreads a return's money over the order's payments, largest first, through the order page's
 * refund path (`refundPayment`), and raises `refund.created` tagged with the return for each
 * refund that did not fail. The GST invoices plugin credits the returned units from it (CGST
 * s.34), whether the money went back to the gateway, by hand or as store credit.
 */
async function payBack(
  ctx: StoreContext,
  r: LockedReturn,
  payments: Refundable,
  amountPaise: number,
  how: {
    providerFor: (providerId: string) => Promise<PaymentProvider | null>
    extra: Pick<RefundInput, 'manual' | 'method' | 'secret' | 'createdBy' | 'storeCreditReason'>
  },
): Promise<string[]> {
  let left = amountPaise
  const refundIds: string[] = []
  const reason = `${r.kind === 'rto' ? 'RTO' : 'Return'} ${returnLabel(r.number)}`
  for (const p of payments) {
    if (left <= 0) break
    const amount = Math.min(left, p.availablePaise)
    const row = await refundPayment(ctx, await how.providerFor(p.provider), {
      paymentId: p.id,
      amountPaise: amount,
      reason,
      ...how.extra,
    })
    if (row) {
      refundIds.push(row.id)
      if (row.status !== 'failed') {
        // Tagged with the return so the relay skips the generic `refund_issued` message:
        // `return_refunded` (or, for an RTO, no shopper message by design) already covers it.
        await insertOutboxEvent(ctx.tx, ctx.storeId, 'refund.created', {
          orderId: r.orderId,
          refundId: row.id,
          returnId: r.id,
        })
      }
    }
    left -= amount
  }
  return refundIds
}

const noGateway = async () => null

/**
 * Give money back to the way the shopper paid, through the same refund path
 * as the order page (`refundPayment`), largest payment first. Full or partial.
 * With `method`, the merchant paid it back by hand and it is only recorded.
 */
export async function refundReturn(ctx: StoreContext, id: string, input: RefundReturnInput) {
  const r = await lockReturn(ctx, id)
  assertResolvable(ctx, r)
  if (!Number.isInteger(input.amountPaise) || input.amountPaise <= 0) {
    throw new ReturnNotAllowed('Enter an amount to refund.', ctx.storeId)
  }
  const payments = await refundablePayments(ctx, r.orderId)
  assertCovered(ctx, payments, input.amountPaise)
  const refundIds = await payBack(
    ctx,
    r,
    payments,
    input.amountPaise,
    input.method
      ? { providerFor: noGateway, extra: { manual: true, method: input.method } }
      : { providerFor: input.providerFor, extra: {} },
  )
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
 * Give the money back as store credit: onto the store credit balance of the order's customer
 * (found or made from the order's email or phone), the same ledger refunds use; never a gift
 * card code. The credit is recorded as a refund of the order's payments (method
 * `store_credit`), so the same money cannot also be refunded, and the GST invoices plugin issues
 * a credit note for the returned units: spending the credit later is billed in full.
 */
export async function storeCreditReturn(
  ctx: StoreContext,
  id: string,
  input: { amountPaise: number; secret: string; createdBy?: string | undefined },
) {
  const r = await lockReturn(ctx, id)
  assertResolvable(ctx, r)
  const value = await returnValue(ctx, id)
  if (
    !Number.isInteger(input.amountPaise) ||
    input.amountPaise <= 0 ||
    !value ||
    input.amountPaise > storeCreditCapPaise(value)
  ) {
    throw new ReturnNotAllowed(
      'Store credit can be at most what the returned items were paid for.',
      ctx.storeId,
    )
  }
  const payments = await refundablePayments(ctx, r.orderId)
  assertCovered(ctx, payments, input.amountPaise)
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, r.orderId))
  if (!o) throw new ReturnNotAllowed('Order not found', ctx.storeId)
  // Each payment's share goes onto the balance as it is recorded (`refundPayment`).
  const refundIds = await payBack(ctx, r, payments, input.amountPaise, {
    providerFor: noGateway,
    extra: {
      method: 'store_credit',
      secret: input.secret,
      createdBy: input.createdBy ?? null,
      storeCreditReason: `Store credit for return ${returnLabel(r.number)} (order #${o.number})`,
    },
  })
  const row = await updateReturnRow(ctx, id, {
    status: 'resolved',
    resolution: 'store_credit',
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
  return { row }
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
  // What the shopper asked for on the form (another size), else the same items again.
  const wished = input.lines?.length ? null : await exchangeLinesFor(ctx, id)
  const lines = (input.lines?.length ? input.lines : (wished ?? returned)).map((l) => ({
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
      orderLineId: returnRequestLine.orderLineId,
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
      locationId: await returnLocation(ctx, l),
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
