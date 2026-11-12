/** SOURCE OF TRUTH: placing a draft's goods — WHAT: route a draft's lines to warehouses, hold their stock, bill each parcel's GST and write its fulfillment orders / WHY: a staff draft (`convertDraft`) and a paid checkout draft (`convertCheckoutDraft`) become orders the same way, under the same oversell guard */
import { address, type orderLine, store } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { StoreAddressSchema } from '../settings/general'
import { saveParcelIds } from '../shipping/delivery-options/booking'
import { chargedGstRate, parseStoreTax } from '../tax/settings'
import { draftPreorders, routingPreorder } from './draft-preorder'
import { createFulfillmentOrders } from './fulfillment-orders'
import { taxParcels } from './parcel-tax'
import { routeAndReserve } from './routing-service'

type DraftRow = {
  id: string
  shippingAddressId: string | null
  discountPaise: number
  paymentAdjustmentPaise: number
  shippingPaise: number
  gstRegistrationId: string | null
}

/**
 * Route the draft's lines like a checkout (order/routing.ts) and hold their stock; its stock
 * guard throws `OutOfStock` rather than oversell. Then bill each parcel from its GSTIN (with no
 * shipping state it is IGST) and write the parcels. The caller gives back any hold the draft
 * had first, so the stock is held once, for the order.
 */
export async function routeAndBillDraft(
  ctx: StoreContext,
  o: DraftRow,
  lines: (typeof orderLine.$inferSelect)[],
) {
  const [shipTo] = o.shippingAddressId
    ? await ctx.tx
        .select({ stateCode: address.stateCode })
        .from(address)
        .where(eq(address.id, o.shippingAddressId))
    : []
  const preorders = await draftPreorders(
    ctx,
    lines.map((l) => l.variantId),
  )
  const { parcels } = await routeAndReserve(ctx, {
    lines: lines.map((l) => ({
      key: l.id,
      variantId: l.variantId,
      quantity: l.quantity,
      giftCard: l.giftCard,
      preorder: l.giftCard ? null : routingPreorder(preorders.get(l.variantId)),
    })),
    buyerState: shipTo?.stateCode ?? null,
  })
  const [s] = await ctx.tx
    .select({ address: store.address, gstRatePercent: store.gstRatePercent, apps: store.apps })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const storeTax = parseStoreTax(s?.apps)
  const storeAddress = StoreAddressSchema.safeParse(s?.address ?? {})
  const byId = new Map(lines.map((l) => [l.id, l]))
  const billed = await taxParcels(ctx.tx, {
    parcels,
    lineOf: (key, quantity) => {
      const line = byId.get(key)
      return {
        grossPaise: quantity * (line?.unitPricePaise ?? 0),
        ratePercent:
          !line || line.giftCard
            ? 0
            : chargedGstRate(line.gstRatePercent ?? s?.gstRatePercent ?? 18, storeTax),
      }
    },
    discountPaise: o.discountPaise,
    adjustmentPaise: o.paymentAdjustmentPaise,
    shippingPaise: o.shippingPaise,
    shipToState: shipTo?.stateCode ?? null,
    storeState: storeAddress.success ? storeAddress.data.state : null,
  })
  const made = await createFulfillmentOrders(ctx, {
    orderId: o.id,
    plans: parcels.map((p, i) => ({
      locationId: p.locationId,
      status: p.status,
      needsTransfer: p.needsTransfer,
      money: billed.money[i],
      lines: p.lines.map((l) => ({
        orderLineId: l.key,
        quantity: l.quantity,
        fulfilledQuantity: 0,
      })),
    })),
    fallbackRegistrationId: o.gstRegistrationId,
  })
  // A checkout draft of a split cart: its parcel routes learn their parcel ids (booking).
  if (parcels.length > 1)
    await saveParcelIds(
      ctx.tx,
      o.id,
      parcels.map((p, i) => ({ id: made[i], locationId: p.locationId, status: p.status })),
    )
  return { parcels, preorders, billed }
}
