/** SOURCE OF TRUTH: createOrder (the checkout step)
 * WHAT:  The step that writes the order: totals, payment fee, pre-order deposit, per-parcel GST,
 *        order lines and fulfillment orders, inside placeOrder's transaction.
 * WHY:   Split from place-order.ts (#973) to keep the workflow file readable; placeOrder runs it.
 */
import { newId, order, orderLine, orderNote, type StoreTx, store } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { isAbroad, taxRegimeFor } from '../checkout/address-abroad'
import { requestCodConfirmation } from '../cod-rto/confirm'
import { tagsForRisk } from '../cod-rto/risk'
import { applyDiscount } from '../discounts/evaluate'
import { recordDiscountUses, releaseDiscountUses } from '../discounts/usage'
import { insertOutboxEvent } from '../outbox/write'
import { applyPaymentAdjustment } from '../payments/adjustments'
import { parsePaymentSettings } from '../payments/settings'
import { computeDepositFromSettings } from '../preorder/deposit'
import { preorderNoteText } from '../preorder/note'
import { resolveShipDate } from '../preorder/settings'
import { parsePreorderStoreSettings } from '../preorder/store-settings'
import { StoreAddressSchema } from '../settings/general'
import { rateRowId } from '../shipping/local-options'
import { primaryRateId } from '../shipping/profiles'
import { computeOrderGst } from '../tax/gst'
import { parseStoreTax } from '../tax/settings'
import type { WorkflowStep } from '../workflow/run'
import { paysOnlineAtCheckout } from './aggregate-status'
import { upsertCheckoutCustomer } from './checkout-customer'
import { CHECKED_OUT_AGAIN_NOTE } from './checkout-draft'
import { PAID_ANOTHER_WAY_NOTE } from './checkout-reopen'
import { draftPlaceholder } from './draft-ref'
import { createFulfillmentOrders, deleteFulfillmentOrders } from './fulfillment-orders'
import { takeDraftNumber, takeOrderNumber } from './order-number'
import { taxParcels } from './parcel-tax'
import { lineGstRate, paymentAdjustmentFor, sumPaise } from './place-order-rules'
import type { State } from './place-order-types'

/**
 * Insert the order, its lines and its parcels (fulfillment orders) with the money and GST worked
 * out here on the server, plus the outbox event and the discount uses. Compensation deletes them.
 */
export const createOrder: WorkflowStep<State> = {
  name: 'createOrder',
  async run({
    ctx,
    lines,
    parcels,
    input,
    discount: applied,
    cartAttribution,
    cartTracking,
    shipping,
    delivery,
    backupRateId,
    contact,
    risk,
    draft,
    reserved,
    rewrite,
  }) {
    const { customerId, shippingAddressId } = input.checkout
      ? await upsertCheckoutCustomer(ctx, input.checkout, contact, input.secret)
      : { customerId: null, shippingAddressId: null }
    // The store's settings are only read here: the number comes from `store_counter`, so the
    // checkout no longer holds the store row locked until it commits (0177).
    const [s] = await ctx.tx
      .select({
        payments: store.payments,
        address: store.address,
        gstRatePercent: store.gstRatePercent,
        apps: store.apps,
        preorder: store.preorder,
      })
      .from(store)
      .where(eq(store.id, ctx.storeId))
    if (!s) throw new Error(`store ${ctx.storeId} not visible in context`)
    const storePreorderNote = parsePreorderStoreSettings(s.preorder).note
    const storeTax = parseStoreTax(s.apps)
    // An unpaid checkout kept as a draft takes a draft number (#D57), or keeps the one of the
    // shopper's open draft it is used again for; the order number waits for the money.
    const draftNumber = draft
      ? (draft.reuse?.draftNumber ?? (await takeDraftNumber(ctx.tx, ctx.storeId)))
      : null
    // The cart's own order written again (another way to pay) keeps its number.
    const orderNumber =
      draftNumber !== null
        ? draftPlaceholder(draftNumber)
        : rewrite && !rewrite.wasDraft
          ? rewrite.number
          : await takeOrderNumber(ctx.tx, ctx.storeId)
    const now = new Date()
    const subtotalPaise = sumPaise(lines)
    // Discount first, then the payment-method fee or discount on what is left.
    // Both are applied server-side here; the checkout preview is only a hint.
    // A free-shipping discount zeroes the rate here (applyDiscount).
    const { discountPaise, shippingPaise, discountedSubtotalPaise } = applyDiscount(
      subtotalPaise,
      shipping?.pricePaise ?? 0,
      applied,
    )
    const adjustment = paymentAdjustmentFor(
      input.paymentProvider.id,
      parsePaymentSettings(s.payments).adjustments[input.paymentProvider.id],
      shipping,
    )
    const { adjustmentPaise, totalPaise: afterAdjustment } = applyPaymentAdjustment(
      discountedSubtotalPaise,
      adjustment,
    )
    const totalPaise = afterAdjustment + shippingPaise
    /* Listed prices include GST, so the tax is split out of the total rather
       than added to it; the shopper pays the same either way. Shipping is
       charged GST-inclusive too and is not a reduction: it lands in the
       "charges" part of the total, which follows the principal supply's rate
       (a composite supply), exactly like the COD fee. */
    /*
     * Each pre-order line's own deposit rule decides what is charged now vs.
     * later; everything else (shipping, non-pre-order items, tax) is charged
     * in full today. `full` mode pre-order lines defer nothing. Deposits are
     * computed against the line's list price (unit price * quantity),
     * ignoring the order-level discount split: PR2 (balance collection) can
     * refine this once it has to reconcile a partial refund against a
     * discounted deposit; for now the deposit is always a fraction of the
     * undiscounted line, which only ever *overstates* what is charged now.
     */
    const preorderLines = lines.filter((l) => l.preorder.enabled && !l.giftCard)
    const balanceDuePaise = preorderLines.reduce((sum, l) => {
      const { balancePaise } = computeDepositFromSettings(
        l.quantity * l.unitPricePaise,
        l.preorder,
        l.quantity,
      )
      return sum + balancePaise
    }, 0)
    const depositPaise = preorderLines.reduce((sum, l) => {
      const { depositPaise: dep } = computeDepositFromSettings(
        l.quantity * l.unitPricePaise,
        l.preorder,
        l.quantity,
      )
      return sum + dep
    }, 0)
    const tags = preorderLines.length > 0 ? ['pre-order'] : []
    const storeAddress = StoreAddressSchema.safeParse(s.address ?? {})
    // The GSTIN of the location the goods ship from decides CGST + SGST or IGST (tax/origin.ts).
    const grossOf = (key: string, quantity: number) =>
      quantity * (lines[Number(key)]?.unitPricePaise ?? 0)
    const storeState = storeAddress.success ? storeAddress.data.state : null
    // An export (address abroad) has no Indian GST state; under a LUT it carries no GST at all.
    const countryCode = input.checkout?.address.countryCode
    const abroad = isAbroad(countryCode)
    const mode = abroad ? await exportMode(ctx.tx, ctx.storeId) : null
    const taxRegime = taxRegimeFor(countryCode, mode)
    const zeroRated = taxRegime === 'export_lut'
    const shipToState = abroad ? null : (input.checkout?.address.stateCode ?? null)
    // Each parcel splits its own GST from its GSTIN; the order's is their sum (parcel-tax.ts).
    const billed = await taxParcels(ctx.tx, {
      parcels,
      lineOf: (key, quantity) => {
        const line = lines[Number(key)]
        return {
          grossPaise: grossOf(key, quantity),
          ratePercent: line && !zeroRated ? lineGstRate(line, s.gstRatePercent, storeTax) : 0,
        }
      },
      discountPaise,
      adjustmentPaise,
      shippingPaise,
      shipToState,
      storeState,
    })
    const origin = billed.origin
    const tax =
      billed.tax ??
      computeOrderGst({
        lines: lines.map((l) => ({
          grossPaise: l.quantity * l.unitPricePaise,
          ratePercent: zeroRated ? 0 : lineGstRate(l, s.gstRatePercent, storeTax),
        })),
        totalPaise,
        reductionPaise: discountPaise + Math.max(0, -adjustmentPaise),
        shipToState,
        storeState: origin.stateCode,
      })
    const values = {
      storeId: ctx.storeId,
      number: orderNumber,
      status: draft ? ('draft' as const) : ('open' as const),
      ...(draft
        ? {
            draftNumber,
            draftSource: 'checkout' as const,
            draftExpiredAt: null,
            // The draft holds what reserveStock reserved, until the unpaid window ends.
            draftReserved: reserved.length > 0 ? reserved : null,
            reservedUntil:
              reserved.length > 0 ? new Date(now.getTime() + draft.holdMinutes * 60_000) : null,
            lastActivityAt: now,
            placedAt: now,
          }
        : rewrite?.wasDraft
          ? // The shopper's draft becomes the order (cash on delivery): no hold, placed now.
            { draftReserved: null, reservedUntil: null, placedAt: now, lastActivityAt: now }
          : {}),
      subtotalPaise,
      taxPaise: tax.taxPaise,
      taxBreakdown: tax,
      taxRegime,
      gstRegistrationId: origin.gstRegistrationId,
      taxOrigin: origin,
      shippingPaise,
      // A delivery option has no rate row: only a backup order points at its zone rate.
      // A rate joined from several profiles keeps its first part here; the snapshot has all.
      shippingRateId: delivery
        ? backupRateId && primaryRateId(backupRateId)
        : shipping
          ? rateRowId(shipping.rateId, primaryRateId)
          : null,
      shippingRateName: shipping?.name ?? null,
      shipping: shipping
        ? {
            rateId: shipping.rateId,
            rateName: shipping.name,
            zoneId: shipping.zoneId,
            zoneName: shipping.zoneName,
            listPricePaise: shipping.listPricePaise,
            pricePaise: shippingPaise,
            codSurchargePaise: shipping.codSurchargePaise,
            minTransitDays: shipping.minTransitDays,
            maxTransitDays: shipping.maxTransitDays,
            ...(shipping.parts && !delivery
              ? {
                  profiles: shipping.parts.map((p) => ({
                    profileId: p.profileId,
                    profileName: p.profileName,
                    rateId: p.rateId,
                    rateName: p.name,
                    zoneId: p.zoneId,
                    zoneName: p.zoneName,
                    pricePaise: p.pricePaise,
                  })),
                }
              : {}),
            ...(delivery ? { delivery } : {}),
            ...(shipping.local && !delivery ? { local: shipping.local } : {}),
          }
        : null,
      paymentAdjustmentPaise: adjustmentPaise,
      paymentAdjustmentLabel: adjustmentPaise ? (adjustment?.label ?? null) : null,
      discountId: applied?.discount.id ?? null,
      discountCode: applied?.discount.code ?? null,
      discountLabel: applied ? applied.label : null,
      discountPaise,
      totalPaise,
      customerId,
      shippingAddressId,
      // As typed (the customer row is keyed on the lower-cased one); null when optional and blank.
      email: input.checkout?.email.trim() || null,
      phone: contact?.phone ?? input.checkout?.phone ?? null,
      buyerGstin: contact?.gstin ?? null,
      buyerBusinessName: contact?.businessName ?? null,
      customerNote: contact?.note ?? null,
      paymentMethod: input.paymentProvider.id,
      // The gateway runs on its test keys: no real money, kept out of reports and invoices.
      isTest: input.paymentProvider.mode === 'test',
      attribution: cartAttribution,
      tracking: cartTracking,
      cartId: input.cartId,
      tags: risk ? tagsForRisk(tags, risk.risk, risk.settings) : tags,
      rtoRisk: risk?.risk ?? null,
      depositPaise: preorderLines.length > 0 ? depositPaise : null,
      balanceDuePaise: preorderLines.length > 0 ? balanceDuePaise : null,
    }
    // The same items again on the shopper's open draft: the row (id, #D number) is written over.
    // The cart's own order paid another way: the same row too.
    const rowId = draft?.reuse?.id ?? rewrite?.id
    const [o] = rowId
      ? await ctx.tx
          .update(order)
          .set(values)
          .where(eq(order.id, rowId))
          .returning({ id: order.id })
      : await ctx.tx.insert(order).values(values).returning({ id: order.id })
    if (!o) throw new Error('order insert returned nothing')
    // In the same transaction as the insert: if a later step throws, the
    // workflow's compensation (below) deletes the order and the whole
    // transaction rolls back, taking this row with it. A gateway checkout with money
    // to collect waits: recomputeOrderStatuses writes it when the money arrives.
    const waitsForMoney =
      totalPaise > 0 &&
      paysOnlineAtCheckout({
        cartId: input.cartId,
        importedFrom: null,
        paymentMethod: input.paymentProvider.id,
      })
    // A draft is announced when it converts (checkout-draft.ts), never while it waits.
    if (!waitsForMoney && !draft) {
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.placed', { orderId: o.id })
    }
    if (risk?.verify) await requestCodConfirmation(ctx, o.id)
    const lineIds = lines.map(() => newId())
    await ctx.tx.insert(orderLine).values(
      lines.map((l, i) => ({
        id: lineIds[i],
        storeId: ctx.storeId,
        orderId: o.id,
        variantId: l.variantId,
        title: l.title,
        variantTitle: l.variantTitle,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        gstRatePercent: lineGstRate(l, s.gstRatePercent, storeTax),
        hsCode: l.giftCard ? null : l.hsCode,
        giftCard: l.giftCard,
        requiresShipping: l.requiresShipping,
        preorder: l.preorder.enabled && !l.giftCard,
        // Products › Pre-orders counts a campaign's orders and revenue from this (#141).
        preorderCampaignId:
          l.preorder.enabled && !l.giftCard ? (l.preorderCampaign?.id ?? null) : null,
        // What the unit cost the store as it sold: profit never reads today's cost.
        costAtSalePaise: l.giftCard ? null : l.costPaise,
        preorderShipDate:
          l.preorder.enabled && !l.giftCard ? resolveShipDate(l.preorder, new Date()) : null,
        // The note the shopper agreed to, kept as it read at the sale for the email and order pages.
        preorderNote:
          l.preorder.enabled && !l.giftCard
            ? preorderNoteText({
                productNote: l.preorderNote,
                storeNote: storePreorderNote,
                shipDate: resolveShipDate(l.preorder, new Date()),
              })
            : null,
      })),
    )
    // A UPI / bank transfer draft: the shopper is told it is received and how to pay it.
    if (draft && input.paymentProvider.id === 'manual' && (!draft.reuse || rewrite)) {
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.transfer_requested', { orderId: o.id })
    }
    if (draft?.reuse || rewrite) {
      await ctx.tx.insert(orderNote).values({
        storeId: ctx.storeId,
        orderId: o.id,
        body: rewrite ? PAID_ANOTHER_WAY_NOTE(input.paymentProvider.label) : CHECKED_OUT_AGAIN_NOTE,
        author: 'system',
      })
    }
    // The parcels routing chose, where reserveStock holds their stock. A draft has none yet:
    // they are routed again when it converts (checkout-draft.ts).
    if (!draft)
      await createFulfillmentOrders(ctx, {
        orderId: o.id,
        plans: parcels.map((p, i) => ({
          locationId: p.locationId,
          status: p.status,
          needsTransfer: p.needsTransfer,
          money: billed.money[i],
          deliveryEstimate: input.deliveryEstimates?.[p.locationId] ?? null,
          lines: p.lines.map((l) => ({
            orderLineId: lineIds[Number(l.key)] as string,
            quantity: l.quantity,
            fulfilledQuantity: 0,
          })),
        })),
        fallbackRegistrationId: origin.gstRegistrationId,
      })
    if (applied) {
      const email = (contact ? contact.email : input.checkout?.email.trim().toLowerCase()) || null
      await recordDiscountUses(ctx, applied, { id: o.id, customerId, email, discountPaise })
    }
    return {
      orderId: o.id,
      orderNumber,
      totalPaise,
      balanceDuePaise,
      depositPaise,
      ...(draft && draftNumber !== null ? { draft: { ...draft, draftNumber } } : {}),
    }
  },
  async compensate({ ctx, orderId, discount: applied, draft, rewrite }) {
    if (!orderId) return
    if (applied) await releaseDiscountUses(ctx, applied, orderId)
    await deleteFulfillmentOrders(ctx.tx, orderId)
    await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
    // The shopper's open draft used again stays; the rolled-back transaction restores it.
    if (!draft?.reuse && !rewrite) await ctx.tx.delete(order).where(eq(order.id, orderId))
  },
}

/**
 * The GST invoices app's export setting (`invoice_settings.settings.exportMode`): `igst` when
 * the store pays IGST on exports and claims it back, else `lut` (no row, or the app's default).
 */
async function exportMode(tx: StoreTx, storeId: string): Promise<'lut' | 'igst'> {
  const rows = await tx.execute<{ mode: string | null }>(
    sql`select settings ->> 'exportMode' as mode from invoice_settings where store_id = ${storeId} limit 1`,
  )
  return rows[0]?.mode === 'igst' ? 'igst' : 'lut'
}
