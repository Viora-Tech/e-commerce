/** SOURCE OF TRUTH: createOrder (the checkout step)
 * WHAT:  The step that writes the order: totals, payment fee, pre-order deposit, per-parcel GST,
 *        order lines and fulfillment orders, inside placeOrder's transaction.
 * WHY:   Split from place-order.ts (#973) to keep the workflow file readable; placeOrder runs it.
 */
import { newId, order, orderLine, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
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
import { primaryRateId } from '../shipping/profiles'
import { computeOrderGst } from '../tax/gst'
import { parseStoreTax } from '../tax/settings'
import type { WorkflowStep } from '../workflow/run'
import { upsertCheckoutCustomer } from './checkout-customer'
import { createFulfillmentOrders, deleteFulfillmentOrders } from './fulfillment-orders'
import { takeOrderNumber } from './order-number'
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
    const orderNumber = await takeOrderNumber(ctx.tx, ctx.storeId)
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
    const shipToState = input.checkout?.address.stateCode ?? null
    // Each parcel splits its own GST from its GSTIN; the order's is their sum (parcel-tax.ts).
    const billed = await taxParcels(ctx.tx, {
      parcels,
      lineOf: (key, quantity) => {
        const line = lines[Number(key)]
        return {
          grossPaise: grossOf(key, quantity),
          ratePercent: line ? lineGstRate(line, s.gstRatePercent, storeTax) : 0,
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
          ratePercent: lineGstRate(l, s.gstRatePercent, storeTax),
        })),
        totalPaise,
        reductionPaise: discountPaise + Math.max(0, -adjustmentPaise),
        shipToState,
        storeState: origin.stateCode,
      })
    const [o] = await ctx.tx
      .insert(order)
      .values({
        storeId: ctx.storeId,
        number: orderNumber,
        status: 'open',
        subtotalPaise,
        taxPaise: tax.taxPaise,
        taxBreakdown: tax,
        gstRegistrationId: origin.gstRegistrationId,
        taxOrigin: origin,
        shippingPaise,
        // A delivery option has no rate row: only a backup order points at its zone rate.
        // A rate joined from several profiles keeps its first part here; the snapshot has all.
        shippingRateId: delivery
          ? backupRateId && primaryRateId(backupRateId)
          : shipping
            ? primaryRateId(shipping.rateId)
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
      })
      .returning({ id: order.id })
    if (!o) throw new Error('order insert returned nothing')
    // In the same transaction as the insert: if a later step throws, the
    // workflow's compensation (below) deletes the order and the whole
    // transaction rolls back, taking this row with it.
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.placed', { orderId: o.id })
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
        preorder: l.preorder.enabled && !l.giftCard,
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
    // The parcels routing chose, where reserveStock holds their stock.
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
    return { orderId: o.id, orderNumber, totalPaise, balanceDuePaise, depositPaise }
  },
  async compensate({ ctx, orderId, discount: applied }) {
    if (!orderId) return
    if (applied) await releaseDiscountUses(ctx, applied, orderId)
    await deleteFulfillmentOrders(ctx.tx, orderId)
    await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, orderId))
    await ctx.tx.delete(order).where(eq(order.id, orderId))
  },
}
