import { address, order, orderLine, shipment, store, variant } from '@commerce/db'
import { ASSUMED_WEIGHT_GRAMS, type ShippingProvider, type Tracking } from '@commerce/shipping'
import { eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { fulfilRemainingLines } from '../order/fulfil'
import { recomputeOrderStatuses } from '../order/recompute'
import { insertOutboxEvent } from '../outbox/write'
import { recordRtoForShipment } from '../returns/rto'
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
  // A live booking is reused; a cancelled label or a parcel that came back (RTO) gets a new one.
  const existing = (await ctx.tx.select().from(shipment).where(eq(shipment.orderId, orderId))).find(
    (s) => s.status !== 'cancelled' && s.status !== 'rto',
  )
  if (existing) return existing

  const [to] = await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
  if (!to) throw new Error('shipping address not found')
  const [s] = await ctx.tx.select().from(store).where(eq(store.id, ctx.storeId))
  const settings = parseShippingSettings(s?.shipping)
  const lines = await ctx.tx
    .select({
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: orderLine.quantity,
      unitPricePaise: orderLine.unitPricePaise,
      variantWeightGrams: variant.weightGrams,
      boxPresetId: variant.boxPresetId,
      packageLengthCm: variant.packageLengthCm,
      packageWidthCm: variant.packageWidthCm,
      packageHeightCm: variant.packageHeightCm,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .where(eq(orderLine.orderId, orderId))
  // The location the goods sell from when it has courier pickup on, else Settings › Shipping.
  const shipFrom = await shipFromFor(ctx.tx, {
    taxOrigin: o.taxOrigin,
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
  const threshold = settings.policy.insuranceThresholdPaise
  const insured = options.insured ?? (threshold > 0 && o.totalPaise >= threshold)

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
    })),
    paymentMode: o.paymentMethod === 'cod' ? 'cod' : 'prepaid',
    codAmountPaise: o.paymentMethod === 'cod' ? o.totalPaise : 0,
    valuePaise: o.totalPaise,
    weightGrams,
  })

  const [row] = await ctx.tx
    .insert(shipment)
    .values({
      storeId: ctx.storeId,
      orderId: o.id,
      provider: provider.id,
      waybill: result.waybill,
      providerRef: result.providerRef ?? null,
      labelUrl: result.labelUrl ?? null,
      weightGrams,
      lengthCm: parcelPackage?.lengthCm ?? null,
      widthCm: parcelPackage?.widthCm ?? null,
      heightCm: parcelPackage?.heightCm ?? null,
      insured,
      declaredValuePaise: o.totalPaise,
    })
    .returning()
  if (!row) throw new Error('could not record shipment')
  // The label exists, so the parcel ships: every line is packed and leaves
  // stock, and the recompute (inside) derives the fulfilment status.
  await fulfilRemainingLines(ctx, o.id)
  await recomputeOrderStatuses(ctx, o.id)
  return row
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
