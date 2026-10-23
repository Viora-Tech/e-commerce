import {
  address,
  fulfillmentOrder,
  fulfillmentOrderLine,
  order,
  orderLine,
  shipment,
  store,
  variant,
} from '@commerce/db'
import { ASSUMED_WEIGHT_GRAMS, type ShippingProvider, type Tracking } from '@commerce/shipping'
import { and, eq, inArray, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { fulfilParcelLines, fulfilRemainingLines } from '../order/fulfil'
import { assertNotHeld } from '../order/fulfillment-hold'
import { ensureFulfillmentOrders, soleFulfillmentOrder } from '../order/fulfillment-orders'
import { recomputeOrderStatuses } from '../order/recompute'
import { insertOutboxEvent } from '../outbox/write'
import { recordRtoForShipment } from '../returns/rto'
import { shipmentDocumentsAsLabel } from './label-documents'
import { storeShippingLabel } from './label-store'
import { syncNdrFromTracking } from './ndr'
import { effectiveWeightGrams, resolveParcelPackage, resolveParcelWeightGrams } from './parcel'
import { defaultBoxPreset, parseShippingSettings } from './settings'
import { shipFromFor } from './ship-from'

export type ShipmentRow = typeof shipment.$inferSelect

/** Statuses the tracking job keeps polling; the rest are terminal. */
export const OPEN_SHIPMENT_STATUSES = [
  'created',
  'picked_up',
  'in_transit',
  'out_for_delivery',
] as const

/**
 * Book a consignment with the courier for an order and record it.
 *
 * The order must have a shipping address. Parcel weight sums the order's own
 * variant weights when every line has one, else falls back to the store's
 * default box weight (see `resolveParcelWeightGrams`), and finally
 * `ASSUMED_WEIGHT_GRAMS` if the store has no box preset either. A
 * product/variant's own box (custom dims, or a named preset), when every line
 * agrees on one, can push that weight up to its volumetric weight, since
 * couriers bill by whichever is greater. The order is marked fulfilled here
 * because the label exists now; whether the courier has collected it is what
 * tracking is for.
 */
export type CreateShipmentOptions = {
  /** Overrides the computed weight, e.g. the merchant's per-row edit in the booking panel. */
  weightGrams?: number | undefined
  dimensionsCm?: { length: number; width: number; height: number } | undefined
  /** Explicit merchant choice; defaults from the store's "insure above ₹X" policy when omitted. */
  insured?: boolean | undefined
  /**
   * Book just this parcel (fulfilment order) of the order: its unpacked units, leaving from its
   * location. Omitted, the whole order goes in one consignment, as before.
   */
  fulfillmentOrderId?: string | undefined
  /**
   * Where the courier collects it, picked in the Create shipment flow: a location id, or null
   * for Settings › Shipping's address. Omitted, the parcel's location decides (`shipFromFor`).
   */
  pickupLocationId?: string | null | undefined
  /** Cash on delivery or prepaid; defaults from the order's payment method. */
  paymentMode?: 'cod' | 'prepaid' | undefined
  /** What the courier collects at the door; defaults to the parcel's (or order's) value. */
  codAmountPaise?: number | undefined
  /** The courier service picked in the rate table (`CourierRateRow.serviceId`). */
  serviceId?: string | undefined
  /** The merchant's own tracking number, for a courier with `requiresTrackingNumber` (India Post). */
  trackingNumber?: string | undefined
}

/** A line's customs fields, only those it has (domestic couriers never read them). */
function customsFields(l: {
  lineHsCode: string | null
  variantHsCode: string | null
  countryOfOrigin: string | null
  sku: string | null
  variantWeightGrams: number | null
}) {
  const hsCode = (l.lineHsCode || l.variantHsCode)?.trim()
  const origin = l.countryOfOrigin?.trim()
  return {
    ...(hsCode ? { hsCode } : {}),
    ...(origin ? { countryOfOrigin: origin } : {}),
    ...(l.sku ? { sku: l.sku } : {}),
    ...(l.variantWeightGrams ? { unitWeightGrams: l.variantWeightGrams } : {}),
  }
}

/** One parcel of an order and the units it still has to send, by order line. */
async function loadParcel(ctx: StoreContext, orderId: string, fulfillmentOrderId: string) {
  const [parcel] = await ctx.tx
    .select({
      id: fulfillmentOrder.id,
      locationId: fulfillmentOrder.locationId,
      totalPaise: fulfillmentOrder.totalPaise,
    })
    .from(fulfillmentOrder)
    .where(
      and(
        eq(fulfillmentOrder.id, fulfillmentOrderId),
        eq(fulfillmentOrder.orderId, orderId),
        ne(fulfillmentOrder.status, 'cancelled'),
      ),
    )
  if (!parcel) throw new Error('This parcel is not part of the order, or it was cancelled.')
  const units = await ctx.tx
    .select({
      orderLineId: fulfillmentOrderLine.orderLineId,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
    })
    .from(fulfillmentOrderLine)
    .where(eq(fulfillmentOrderLine.fulfillmentOrderId, parcel.id))
  const unpacked = new Map<string, number>()
  for (const u of units) {
    const left = u.quantity - u.fulfilledQuantity
    if (left > 0) unpacked.set(u.orderLineId, (unpacked.get(u.orderLineId) ?? 0) + left)
  }
  return { ...parcel, unpacked }
}

export async function createShipmentForOrder(
  ctx: StoreContext,
  provider: ShippingProvider,
  orderId: string,
  options: CreateShipmentOptions = {},
): Promise<ShipmentRow> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId))
  if (!o) throw new Error('order not found')
  if (!o.shippingAddressId) throw new Error('order has no shipping address')
  /* A live booking is reused (for the parcel, when one was named); a cancelled label or a
     parcel that came back (RTO) gets a new one. */
  const parcelOnly = options.fulfillmentOrderId
  const existing = (await ctx.tx.select().from(shipment).where(eq(shipment.orderId, orderId))).find(
    (s) =>
      s.status !== 'cancelled' &&
      s.status !== 'rto' &&
      (!parcelOnly || s.fulfillmentOrderId === parcelOnly),
  )
  if (existing) return existing
  // A held parcel (or, booking the whole order, any held parcel) is not booked until released.
  await assertNotHeld(ctx, o.id, parcelOnly ?? null)

  const [to] = await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
  if (!to) throw new Error('shipping address not found')
  const [s] = await ctx.tx.select().from(store).where(eq(store.id, ctx.storeId))
  const settings = parseShippingSettings(s?.shipping)
  const orderLines = await ctx.tx
    .select({
      id: orderLine.id,
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      /* Customs fields, for a parcel going abroad: the HS code as it stood at order time,
         else the variant's own. */
      lineHsCode: orderLine.hsCode,
      variantHsCode: variant.hsCode,
      countryOfOrigin: variant.countryOfOrigin,
      sku: variant.sku,
      variantWeightGrams: variant.weightGrams,
      boxPresetId: variant.boxPresetId,
      packageLengthCm: variant.packageLengthCm,
      packageWidthCm: variant.packageWidthCm,
      packageHeightCm: variant.packageHeightCm,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .where(eq(orderLine.orderId, orderId))
  /* The parcel's location (the order's, when it ships whole) when it has courier pickup on,
     else Settings › Shipping - unless the merchant picked where it leaves from. */
  await ensureFulfillmentOrders(ctx, o.id)
  const named = parcelOnly ? await loadParcel(ctx, o.id, parcelOnly) : null
  const sole = await soleFulfillmentOrder(ctx, o.id)
  const parcelId = named?.id ?? sole
  const [parcel] = named
    ? [named]
    : parcelId
      ? await ctx.tx
          .select({ locationId: fulfillmentOrder.locationId })
          .from(fulfillmentOrder)
          .where(eq(fulfillmentOrder.id, parcelId))
      : []
  // A named parcel carries only its own unpacked units; the whole order carries every line.
  const lines = named
    ? orderLines.flatMap((l) => {
        const quantity = named.unpacked.get(l.id) ?? 0
        return quantity > 0 ? [{ ...l, quantity }] : []
      })
    : orderLines
  if (named && lines.length === 0) throw new Error('This parcel has nothing left to ship.')
  const shipFrom = await shipFromFor(ctx.tx, {
    taxOrigin: o.taxOrigin,
    locationId: options.pickupLocationId ?? parcel?.locationId,
    storeAddress: options.pickupLocationId === null,
    settings,
    storeName: s?.name ?? '',
  })
  const boxWeightGrams = defaultBoxPreset(settings)?.weightGrams ?? ASSUMED_WEIGHT_GRAMS
  /* A product/variant's own package (custom dims, or one of the store's named boxes) is used
     when every sellable line agrees on one; its volumetric weight is compared against the
     actual weight, as couriers bill by whichever is greater. The merchant's own weight or
     dimensions from the booking panel win outright, as before. */
  const parcelPackage = options.dimensionsCm
    ? {
        lengthCm: options.dimensionsCm.length,
        widthCm: options.dimensionsCm.width,
        heightCm: options.dimensionsCm.height,
      }
    : resolveParcelPackage(lines, settings.boxPresets)
  const weightGrams =
    options.weightGrams ||
    effectiveWeightGrams(
      resolveParcelWeightGrams(lines, boxWeightGrams),
      options.dimensionsCm ? null : parcelPackage,
    )
  // A parcel that is the whole order is worth the order; one of several, its own share.
  const valuePaise =
    named && named.id !== sole
      ? (named.totalPaise ?? lines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0))
      : o.totalPaise
  const paymentMode = options.paymentMode ?? (o.paymentMethod === 'cod' ? 'cod' : 'prepaid')
  const codAmountPaise = paymentMode === 'cod' ? (options.codAmountPaise ?? valuePaise) : 0
  const threshold = settings.policy.insuranceThresholdPaise
  const insured = options.insured ?? (threshold > 0 && valuePaise >= threshold)

  const result = await provider.createShipment({
    orderId: o.id,
    orderNumber: o.number,
    to: {
      name: to.name,
      line1: to.line1,
      line2: to.line2 ?? undefined,
      city: to.city,
      state: to.stateCode,
      pincode: to.pincode,
      country: to.country,
      phone: to.phone,
    },
    from: shipFrom.address,
    ...(shipFrom.pickupLocationName ? { pickupLocationName: shipFrom.pickupLocationName } : {}),
    lines: lines.map((l) => ({
      title: [l.title, l.variantTitle !== 'Default' ? l.variantTitle : null]
        .filter(Boolean)
        .join(' / '),
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
      ...customsFields(l),
    })),
    paymentMode,
    codAmountPaise,
    valuePaise,
    weightGrams,
    ...(options.serviceId ? { serviceId: options.serviceId } : {}),
    ...(options.trackingNumber ? { trackingNumber: options.trackingNumber } : {}),
    ...(parcelPackage
      ? {
          dimensionsCm: {
            length: parcelPackage.lengthCm,
            width: parcelPackage.widthCm,
            height: parcelPackage.heightCm,
          },
        }
      : {}),
    ...(s?.gstin ? { exporterGstin: s.gstin } : {}),
  })

  // The consignment carries its parcel: the named one, or the order's only one.
  const [row] = await ctx.tx
    .insert(shipment)
    .values({
      storeId: ctx.storeId,
      orderId: o.id,
      fulfillmentOrderId: parcelId,
      provider: provider.id,
      waybill: result.waybill,
      providerRef: result.providerRef ?? null,
      labelUrl: result.labelUrl ?? null,
      trackingUrl: result.trackingUrl ?? null,
      weightGrams,
      lengthCm: parcelPackage?.lengthCm ?? null,
      widthCm: parcelPackage?.widthCm ?? null,
      heightCm: parcelPackage?.heightCm ?? null,
      insured,
      declaredValuePaise: valuePaise,
      // What the courier charges, when its booking said; the merchant can type it otherwise.
      courierChargePaise: result.chargePaise ?? null,
    })
    .returning()
  if (!row) throw new Error('could not record shipment')
  /* A courier that hands back the PDF itself (Blue Dart, DTDC) or several (DHL Express, FedEx:
     label and commercial invoice, joined label-first): kept privately, linked by id. The
     booking stands even if storage fails: the AWB is real, and the label can be reprinted
     from the courier's own site. */
  let booked = row
  const labelDocument = result.labelUrl
    ? undefined
    : (result.labelDocument ??
      (result.documents?.length
        ? await shipmentDocumentsAsLabel(result.documents).catch(() => null)
        : null))
  if (labelDocument) {
    const labelUrl = await storeShippingLabel(ctx, row.id, labelDocument)
    if (labelUrl) {
      const [withLabel] = await ctx.tx
        .update(shipment)
        .set({ labelUrl })
        .where(eq(shipment.id, row.id))
        .returning()
      booked = withLabel ?? row
    }
  }
  // The label exists, so the parcel ships: its lines (every line, for the whole order) are
  // packed and leave stock, and the recompute (inside) derives the fulfilment status.
  if (named) await fulfilParcelLines(ctx, o.id, named.id)
  else await fulfilRemainingLines(ctx, o.id)
  await recomputeOrderStatuses(ctx, o.id)
  return booked
}

/** Store a fresh Tracking answer; flips the order to delivered when the courier says so. */
export async function applyTracking(
  ctx: StoreContext,
  shipmentId: string,
  tracking: Tracking,
): Promise<{ shipment: ShipmentRow; becameDelivered: boolean }> {
  const [before] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!before) throw new Error('shipment not found')
  const [row] = await ctx.tx
    .update(shipment)
    .set({
      status: tracking.status,
      tracking,
      trackingUrl: tracking.trackingUrl ?? before.trackingUrl,
      updatedAt: new Date(),
    })
    .where(eq(shipment.id, shipmentId))
    .returning()
  if (!row) throw new Error('shipment not found')
  const becameDelivered = before.status !== 'delivered' && tracking.status === 'delivered'
  const becameOutForDelivery =
    before.status !== 'out_for_delivery' && row.status === 'out_for_delivery'
  // Courier events (in transit, delivered, RTO) move the fulfilment status.
  if (before.status !== row.status) await recomputeOrderStatuses(ctx, row.orderId)
  if (becameOutForDelivery) {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'shipment.out_for_delivery', {
      orderId: row.orderId,
    })
  }
  if (becameDelivered) {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.delivered', { orderId: row.orderId })
  }
  // The parcel came back undelivered: open the order's RTO task (once per shipment).
  if (before.status !== 'rto' && row.status === 'rto') await recordRtoForShipment(ctx, row)
  // Raises or clears the delivery-problem flag from this same scan; see `syncNdrFromTracking`.
  const final = await syncNdrFromTracking(ctx, row, tracking)
  return { shipment: final, becameDelivered }
}

export async function cancelShipment(
  ctx: StoreContext,
  provider: ShippingProvider,
  shipmentId: string,
): Promise<ShipmentRow> {
  const [row] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new Error('shipment not found')
  // Most couriers cancel by waybill; RapidShyp's cancel_order wants its own
  // order id instead (stored as providerRef on create) - see
  // packages/shipping-rapidshyp/src/rapidshyp.ts.
  await provider.cancel(row.providerRef || row.waybill)
  const [updated] = await ctx.tx
    .update(shipment)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(shipment.id, shipmentId))
    .returning()
  await recomputeOrderStatuses(ctx, row.orderId)
  return updated ?? row
}

/** Shipments still moving, for the tracking job. */
export async function listOpenShipments(ctx: StoreContext): Promise<ShipmentRow[]> {
  return ctx.tx
    .select()
    .from(shipment)
    .where(inArray(shipment.status, [...OPEN_SHIPMENT_STATUSES]))
}

export type BulkCreateResult = {
  orderId: string
  ok: boolean
  shipmentId?: string
  waybill?: string
  labelUrl?: string | null
  error?: string
}

/**
 * Book several orders with one courier in one go (the Shipments workspace's
 * bulk action). Each order is its own best-effort attempt: one courier
 * rejection (a bad pincode, a duplicate) never stops the rest from booking.
 */
export async function bulkCreateShipments(
  ctx: StoreContext,
  provider: ShippingProvider,
  orderIds: string[],
  options: CreateShipmentOptions = {},
): Promise<BulkCreateResult[]> {
  const results: BulkCreateResult[] = []
  for (const orderId of orderIds) {
    try {
      const row = await createShipmentForOrder(ctx, provider, orderId, options)
      results.push({
        orderId,
        ok: true,
        shipmentId: row.id,
        waybill: row.waybill,
        labelUrl: row.labelUrl,
      })
    } catch (err) {
      results.push({ orderId, ok: false, error: err instanceof Error ? err.message : String(err) })
    }
  }
  return results
}
