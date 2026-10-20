import {
  type ManualTrackingInput,
  parseShippingSettings,
  recordManualTracking,
  type ShippingRegistry,
  shipFromFor,
  shippingProviderById,
} from '@commerce/core'
import { dayKey } from '@commerce/dates'
import { address, fulfillmentOrder, order, type StoreTx, shipment, store } from '@commerce/db'
import { decodeLabelRef, INDIA_POST_ID, IndiaPostProvider } from '@commerce/shipping-indiapost'
import { renderIndiaPostLabel } from '@commerce/shipping-indiapost/label'
import { ORPCError } from '@orpc/server'
import { and, eq } from 'drizzle-orm'

/**
 * The India Post app's server side: the merchant's hand-set statuses (India Post has no
 * tracking feed for us, see packages/shipping-indiapost/src/india-post.ts) and our own address
 * label. Both work on shipments the shared Create shipment flow booked with the article number.
 */

/** A status the merchant set by hand, for a courier that `tracksManually`. */
export async function recordShipmentStatus(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  shipmentId: string,
  input: ManualTrackingInput,
) {
  const [row] = await tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!row) throw new ORPCError('NOT_FOUND')
  const [s] = await tx.select({ shipping: store.shipping }).from(store).where(eq(store.id, storeId))
  const provider = shippingProviderById(
    registry,
    parseShippingSettings(s?.shipping),
    secret,
    row.provider,
  )
  if (!provider?.tracksManually) {
    throw new ORPCError('PRECONDITION_FAILED', {
      message: 'This courier sends its own tracking; refresh it instead.',
    })
  }
  return recordManualTracking({ storeId, tx }, shipmentId, input).catch((err: unknown) => {
    throw new ORPCError('BAD_REQUEST', {
      message: err instanceof Error ? err.message : String(err),
    })
  })
}

/** Our label PDF for an India Post article number the store booked. */
export async function indiaPostLabel(
  tx: StoreTx,
  storeId: string,
  registry: ShippingRegistry,
  secret: string,
  waybill: string,
): Promise<{ bytes: Uint8Array; name: string }> {
  const [row] = await tx
    .select()
    .from(shipment)
    .where(and(eq(shipment.provider, INDIA_POST_ID), eq(shipment.waybill, waybill)))
  if (!row) throw new ORPCError('NOT_FOUND', { message: 'No India Post parcel with that number.' })
  const [o] = await tx.select().from(order).where(eq(order.id, row.orderId))
  const [to] = o?.shippingAddressId
    ? await tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  if (!o || !to) throw new ORPCError('NOT_FOUND', { message: 'The order has no shipping address.' })
  const [s] = await tx
    .select({ name: store.name, shipping: store.shipping })
    .from(store)
    .where(eq(store.id, storeId))
  const settings = parseShippingSettings(s?.shipping)
  const [parcel] = row.fulfillmentOrderId
    ? await tx
        .select({ locationId: fulfillmentOrder.locationId })
        .from(fulfillmentOrder)
        .where(eq(fulfillmentOrder.id, row.fulfillmentOrderId))
    : []
  const from = await shipFromFor(tx, {
    taxOrigin: o.taxOrigin,
    locationId: parcel?.locationId,
    settings,
    storeName: s?.name ?? '',
  })
  const provider = shippingProviderById(registry, settings, secret, INDIA_POST_ID)
  const ref = decodeLabelRef(row.providerRef)
  const bytes = await renderIndiaPostLabel({
    articleNumber: row.waybill,
    orderNumber: o.number,
    storeName: s?.name ?? '',
    registered: ref.registered,
    codPaise: ref.codPaise,
    weightGrams: row.weightGrams,
    customerId: provider instanceof IndiaPostProvider ? provider.customerId : undefined,
    // India's calendar day, as on the counter receipt.
    bookedOn: dayKey(row.createdAt),
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
    from: from.address,
  })
  return { bytes, name: `india-post-${row.waybill}.pdf` }
}
