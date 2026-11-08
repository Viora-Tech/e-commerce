/** SOURCE OF TRUTH: previewOrderEdit, editOrder — WHAT: Shopify-style editing of an open or completed order, shipped, delivered or not (add catalogue or custom items, remove with or without restock, quantity, price of unpacked lines, shipping, discount and their labels) and settling the difference / WHY: staff fix orders after payment without cancelling and re-placing them */

import { siteConfig } from '@commerce/config/site'
import {
  order,
  orderLine,
  orderNote,
  payment,
  product,
  refund,
  returnRequestLine,
  store,
  variant,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq, inArray, isNull, ne } from 'drizzle-orm'
import { effectiveGstRatePercent, effectiveHsCode } from '../catalog/effective-tax'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { chargedGstRate, parseStoreTax } from '../tax/settings'
import { ensureCustomItemVariant } from './custom-item'
import {
  type EditPlan,
  type EditTotals,
  type OrderEdit,
  OrderEditRefused,
  type PlannedLine,
  planOrderEdit,
} from './edit-plan'
import { canEditOrder, editsAfterShipping } from './edit-rules'
import { type EditSettlement, settleEditMoney } from './edit-settle'
import {
  type AddedUnits,
  holdAddedUnits,
  releaseLineUnits,
  retaxOrder,
  settleEditedParcels,
} from './edit-stock'
import { heldParcels, holdFulfillment } from './fulfillment-hold'
import { ensureFulfillmentOrders } from './fulfillment-orders'
import { recomputeOrderStatuses } from './recompute'
import { type RefundOptions, type RefundRoute, refundOptions } from './refund-routes'

type OrderRow = typeof order.$inferSelect

/** Settled outside any gateway: an unpaid order waiting on anything else cannot change its amount. */
const OFFLINE = new Set(['cod', 'manual'])

async function loadForEdit(ctx: StoreContext, edit: OrderEdit, lock: boolean) {
  const query = ctx.tx.select().from(order).where(eq(order.id, edit.orderId))
  const [o] = lock ? await query.for('update') : await query
  if (!o || !canEditOrder(o)) {
    throw new OrderEditRefused(
      'not_editable',
      o?.importedFrom
        ? `This order was imported. Manage it in ${siteConfig.brand.name} first, then edit it.`
        : 'A cancelled order cannot be edited',
      ctx.storeId,
    )
  }
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, o.id))
  const ids = [...new Set(edit.add.map((a) => a.variantId))]
  const variants = ids.length
    ? await ctx.tx
        .select({
          id: variant.id,
          title: product.title,
          variantTitle: variant.title,
          pricePaise: variant.pricePaise,
          giftCard: product.isGiftCard,
          taxable: variant.taxable,
          gstRatePercent: effectiveGstRatePercent,
          hsCode: effectiveHsCode,
          costPaise: variant.costPaise,
          requiresShipping: variant.requiresShipping,
        })
        .from(variant)
        .innerJoin(product, eq(product.id, variant.productId))
        .where(and(inArray(variant.id, ids), isNull(variant.archivedAt)))
    : []
  const payments = await ctx.tx.select().from(payment).where(eq(payment.orderId, o.id))
  const refunds = await ctx.tx
    .select({ amountPaise: refund.amountPaise })
    .from(refund)
    .where(and(eq(refund.orderId, o.id), ne(refund.status, 'failed')))
  const kept = payments
    .filter((p) => (p.status === 'captured' || p.status === 'refunded') && !p.refundNeeded)
    .reduce((sum, p) => sum + p.amountPaise, 0)
  const paidPaise = Math.max(0, kept - refunds.reduce((sum, r) => sum + r.amountPaise, 0))
  const before: EditTotals = {
    subtotalPaise: o.subtotalPaise,
    discountPaise: o.discountPaise,
    shippingPaise: o.shippingPaise,
    adjustmentPaise: o.paymentAdjustmentPaise,
    totalPaise: o.totalPaise,
  }
  const plan = planOrderEdit({
    edit,
    current: lines,
    variants,
    before,
    paidPaise,
    labels: { discountLabel: o.discountLabel, shippingLabel: o.shippingRateName },
  })
  return { o, lines, variants, payments, plan }
}

export type OrderEditPreview = EditPlan & {
  /** Money arrived at checkout: a higher total is asked for, a lower one refunded. */
  paidAtCheckout: boolean
  /** How a refund can go back (`refund-routes.ts`). */
  refund: RefundOptions
  /** The customer has an email address to send the payment link to. */
  canEmail: boolean
}

/** The review step: the order as it would be, and what is owed either way. Writes nothing. */
export async function previewOrderEdit(
  ctx: StoreContext,
  edit: OrderEdit,
  providers: readonly PaymentProvider[],
): Promise<OrderEditPreview> {
  const { o, plan } = await loadForEdit(ctx, edit, false)
  return {
    ...plan,
    paidAtCheckout: o.checkoutPaidAt !== null,
    refund: await refundOptions(ctx, o.id, providers),
    canEmail: Boolean(o.email),
  }
}

export type EditOrderOptions = {
  /** When the store owes money back: how (or `none` to keep it, e.g. as store credit). */
  refund: RefundRoute
  /** When the customer owes more: email them the payment link. */
  requestPayment: boolean
  /** Shown on the timeline beside the change list. */
  note?: string | undefined
  /**
   * Email (and WhatsApp) the shopper the updated order (`order_edited`) when its items or total
   * changed. On unless false; skipped when the edit's balance request already told them.
   */
  notifyCustomer?: boolean | undefined
  author: string
}

export type EditOrderResult = {
  order: OrderRow
  plan: EditPlan
  settlement: EditSettlement
}

const qty = (l: PlannedLine) =>
  `${l.title ?? 'Item'}${l.variantTitle && l.variantTitle !== 'Default Title' ? ` (${l.variantTitle})` : ''}`

const rupees = (paise: number) => formatMoney(paise, 'INR', { showZeroDecimals: true })

const quoted = (label: string | null) => (label ? `"${label}"` : 'none')

/** The timeline line for an edit: what changed, the new total, and how the difference was settled. */
function editNote(
  plan: EditPlan,
  settlement: EditSettlement,
  note: string | undefined,
  afterShipping: boolean,
): string {
  const parts: string[] = []
  for (const l of plan.lines) {
    const kept = l.restock === false ? ' (not restocked)' : ''
    if (l.change === 'added') {
      parts.push(`+ Added ${l.quantity} × ${qty(l)}${l.custom ? ' (custom item)' : ''}`)
    }
    if (l.change === 'removed') parts.push(`− Removed ${qty(l)}${kept}`)
    if (l.change !== 'changed') continue
    if (l.quantity !== l.quantityBefore) {
      parts.push(`${qty(l)} ${l.quantityBefore} → ${l.quantity}${kept}`)
    }
    if (l.unitPricePaise !== l.unitPriceBefore) {
      parts.push(`${qty(l)} price ${rupees(l.unitPriceBefore)} → ${rupees(l.unitPricePaise)}`)
    }
  }
  if (plan.after.shippingPaise !== plan.before.shippingPaise) {
    parts.push(
      `shipping ${rupees(plan.before.shippingPaise)} → ${rupees(plan.after.shippingPaise)}`,
    )
  }
  if (plan.after.discountPaise !== plan.before.discountPaise) {
    parts.push(
      `discount ${rupees(plan.before.discountPaise)} → ${rupees(plan.after.discountPaise)}`,
    )
  }
  const { before: lb, after: la } = plan.labels
  if (la.shippingLabel !== lb.shippingLabel) {
    parts.push(`shipping label ${quoted(lb.shippingLabel)} → ${quoted(la.shippingLabel)}`)
  }
  if (la.discountLabel !== lb.discountLabel) {
    parts.push(`discount label ${quoted(lb.discountLabel)} → ${quoted(la.discountLabel)}`)
  }
  const money =
    settlement.kind === 'requested'
      ? `${rupees(settlement.amountPaise)} more due from the customer${settlement.emailed ? '; payment link emailed' : ''}.`
      : settlement.kind === 'owed'
        ? `${rupees(settlement.amountPaise)} more due from the customer.`
        : settlement.kind === 'refunded'
          ? `${rupees(settlement.amountPaise)} ${settlement.route === 'manual' ? 'marked as refunded by hand' : 'refunded to the original payment'}.`
          : settlement.kind === 'kept'
            ? `${rupees(settlement.amountPaise)} owed back, not refunded.`
            : ''
  // One change per line (#1014): the timeline keeps a note's line breaks, so an added or removed
  // item reads as its own "+ Added" / "− Removed" line instead of a word inside one sentence.
  return [
    `Order edited${afterShipping ? ' after shipping (the shipment was not changed)' : ''}:`,
    ...parts,
    `Total ${rupees(plan.before.totalPaise)} → ${rupees(plan.after.totalPaise)}.`,
    money,
    note?.trim() ? `Note: ${note.trim()}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * Save an edit. Under the order's row lock: lines change (a removed line goes, nothing packed
 * can go or be repriced: a shipped unit comes back through a return), stock follows (units taken
 * off are released where their parcel holds them, or written off with restock off; units added,
 * custom items included, are routed and held like a checkout, so OutOfStock refuses the whole
 * edit, and go in a new parcel once the others are packed, which reopens a delivered order;
 * a held order's new parcel is held too), parcels and
 * GST are worked out again, totals move by the difference, then the difference is settled
 * (`edit-settle.ts`: a payment request, or a refund the chosen way). The timeline records it and
 * `order.edited` tells apps (GST invoices re-bill, affiliate commission is recomputed). An unpaid
 * order waiting on an online payment cannot be edited (its amount is already with the gateway).
 */
export async function editOrder(
  ctx: StoreContext,
  edit: OrderEdit,
  opts: EditOrderOptions,
  providers: readonly PaymentProvider[],
): Promise<EditOrderResult> {
  const { o, lines, variants, payments, plan } = await loadForEdit(ctx, edit, true)
  const waitingOnline = payments.some(
    (p) =>
      p.purpose === 'order' &&
      !OFFLINE.has(p.provider) &&
      ['created', 'pending', 'authorized'].includes(p.status),
  )
  if (!o.checkoutPaidAt && waitingOnline) {
    throw new OrderEditRefused(
      'awaiting_payment',
      'The customer is paying for this order online right now; edit it once the payment is in',
      ctx.storeId,
    )
  }
  // Orders older than parcels get theirs before any stock moves.
  await ensureFulfillmentOrders(ctx, o.id)
  const [s] = await ctx.tx
    .select({ gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const storeTax = parseStoreTax(s?.apps)
  const byLine = new Map(lines.map((l) => [l.id, l]))
  const added: AddedUnits[] = []
  const repriced = new Set<string>()
  for (const l of plan.lines) {
    if (l.change === 'same') continue
    if (l.lineId) {
      const line = byLine.get(l.lineId)
      if (!line) continue
      const remove = l.quantity === 0
      const newPrice = !remove && l.unitPricePaise !== line.unitPricePaise
      if (newPrice) repriced.add(line.id)
      // A line on a return was refunded at its price: removing or repricing it would not add up.
      if (remove || newPrice) {
        const [returned] = await ctx.tx
          .select({ id: returnRequestLine.id })
          .from(returnRequestLine)
          .where(eq(returnRequestLine.orderLineId, line.id))
          .limit(1)
        if (returned) {
          throw new OrderEditRefused(
            'returned_line',
            `${qty(l)} is on a return and cannot be ${remove ? 'removed' : 'repriced'}`,
          )
        }
      }
      if (l.quantity < line.quantity) {
        await releaseLineUnits(ctx, {
          orderId: o.id,
          orderLineId: line.id,
          variantId: line.variantId,
          quantity: line.quantity - l.quantity,
          remove,
          restock: l.restock,
        })
      } else if (l.quantity > line.quantity && !line.giftCard) {
        added.push({
          orderLineId: line.id,
          variantId: line.variantId,
          quantity: l.quantity - line.quantity,
        })
      }
      if (remove) await ctx.tx.delete(orderLine).where(eq(orderLine.id, line.id))
      else
        await ctx.tx
          .update(orderLine)
          .set({ quantity: l.quantity, unitPricePaise: l.unitPricePaise })
          .where(eq(orderLine.id, line.id))
      continue
    }
    if (l.custom) {
      // Booked against the hidden "Custom item" variant, which tracks no stock (`custom-item.ts`).
      const customVariantId = await ensureCustomItemVariant(ctx)
      const [row] = await ctx.tx
        .insert(orderLine)
        .values({
          storeId: ctx.storeId,
          orderId: o.id,
          variantId: customVariantId,
          title: l.title,
          variantTitle: null,
          quantity: l.quantity,
          unitPricePaise: l.unitPricePaise,
          gstRatePercent: l.custom.taxable ? chargedGstRate(s?.gstRatePercent ?? 18, storeTax) : 0,
          hsCode: l.custom.hsCode,
        })
        .returning({ id: orderLine.id })
      if (row) added.push({ orderLineId: row.id, variantId: customVariantId, quantity: l.quantity })
      continue
    }
    const v = variants.find((x) => x.id === l.variantId)
    if (!v) continue
    const [row] = await ctx.tx
      .insert(orderLine)
      .values({
        storeId: ctx.storeId,
        orderId: o.id,
        variantId: v.id,
        title: v.title,
        variantTitle: v.variantTitle,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        gstRatePercent: v.taxable
          ? chargedGstRate(v.gstRatePercent ?? s?.gstRatePercent ?? 18, storeTax)
          : 0,
        hsCode: v.hsCode,
        costAtSalePaise: v.costPaise,
        requiresShipping: v.requiresShipping,
      })
      .returning({ id: orderLine.id })
    if (row) added.push({ orderLineId: row.id, variantId: v.id, quantity: l.quantity })
  }
  await holdAddedUnits(ctx, { orderId: o.id, units: added, registrationId: o.gstRegistrationId })
  // A held order stays held: a parcel the edit opened waits for the same release (#1011).
  const [hold] = await heldParcels(ctx.tx, o.id)
  if (hold) await holdFulfillment(ctx, o.id, hold.reason, { code: hold.code, heldBy: hold.heldBy })
  await settleEditedParcels(ctx, o.id)
  await ctx.tx
    .update(order)
    .set({
      subtotalPaise: plan.after.subtotalPaise,
      discountPaise: plan.after.discountPaise,
      shippingPaise: plan.after.shippingPaise,
      totalPaise: plan.after.totalPaise,
      discountLabel: plan.labels.after.discountLabel,
      shippingRateName: plan.labels.after.shippingLabel,
    })
    .where(eq(order.id, o.id))
  await retaxOrder(ctx, o.id, { repriced })
  const settlement = await settleEditMoney(ctx, {
    order: { ...o, totalPaise: plan.after.totalPaise },
    plan,
    route: opts.refund,
    requestPayment: opts.requestPayment,
    author: opts.author,
    providers,
  })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: o.id,
    body: editNote(plan, settlement, opts.note, editsAfterShipping(o)),
    author: opts.author,
  })
  await recomputeOrderStatuses(ctx, o.id)
  // The shopper hears about an edit that changed what they get or pay, once: a balance request
  // with the pay link already says the order was updated.
  const changed =
    plan.lines.some((l) => l.change !== 'same') || plan.after.totalPaise !== plan.before.totalPaise
  const toldByRequest = settlement.kind === 'requested' && settlement.emailed
  const notify = opts.notifyCustomer !== false && changed && !toldByRequest
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.edited', {
    orderId: o.id,
    ...(notify ? {} : { notifyCustomer: false }),
  })
  const [after] = await ctx.tx.select().from(order).where(eq(order.id, o.id))
  return { order: after ?? o, plan, settlement }
}
