/** SOURCE OF TRUTH: orderPartShipping
 * WHAT:  An order that ships in parts, parcel by parcel: each parcel's label (courier, AWB, when
 *        it was booked, the delivery date the courier or checkout gave), each waiting item's
 *        availability, and when the customer was told the order ships in parts.
 * WHY:   The order page's Partly shipped card (Figma 918:10852): "Parcel 1 · In transit ·
 *        Delhivery · AWB … · shipped 15 Oct · delivery by Sat, 18 Oct"; "Parcel 2 · To ship ·
 *        Pre-order · arrives 22 Oct"; "Customer was told on 15 Oct that the order ships in 2 parts".
 * WHERE: orders.get (`partShipping`). Null for an order in one parcel.
 */
import { fulfillmentOrder, type StoreTx, shipment } from '@commerce/db'
import { and, desc, eq, inArray } from 'drizzle-orm'
import type { ShippingRegistry } from '../shipping/settings'
import { type LineAvailability, linesAvailability } from './parcel-availability'
import type { ParcelView } from './parcel-view'

export type PartShippingParcel = {
  id: string
  /** The parcel's live label, null until one is booked. */
  shipment: {
    id: string
    provider: string
    /** The courier's name ("Delhivery"), from the store's shipping apps. */
    providerLabel: string
    /** The service booked ("Delhivery Surface"), when the courier names one. */
    serviceLabel: string | null
    waybill: string
    status: string
    trackingUrl: string | null
    bookedAt: Date
    /** `YYYY-MM-DD`: the courier's promised date, else the window the shopper was told. */
    deliveryBy: string | null
  } | null
  /** Each unsent line's availability (lines packed already are left out). */
  lines: Array<{ orderLineId: string; availability: LineAvailability }>
}

export type PartShipping = {
  /** The latest time the customer was told the order ships in parts; null when never. */
  customerToldAt: Date | null
  parcels: PartShippingParcel[]
}

const expectedDateOf = (tracking: unknown): string | null => {
  const d = (tracking as { expectedDate?: unknown } | null)?.expectedDate
  return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null
}

export async function orderPartShipping(
  tx: StoreTx,
  orderId: string,
  parcels: readonly ParcelView[],
  /** The store's couriers, for each label's courier name. */
  shipping: ShippingRegistry,
): Promise<PartShipping | null> {
  const live = parcels.filter((p) => p.status !== 'cancelled')
  if (live.length < 2) return null
  const ids = live.map((p) => p.id)
  const [labels, told] = await Promise.all([
    tx
      .select({
        id: shipment.id,
        parcelId: shipment.fulfillmentOrderId,
        provider: shipment.provider,
        serviceLabel: shipment.serviceLabel,
        waybill: shipment.waybill,
        status: shipment.status,
        trackingUrl: shipment.trackingUrl,
        tracking: shipment.tracking,
        bookedAt: shipment.createdAt,
      })
      .from(shipment)
      .where(and(eq(shipment.orderId, orderId), inArray(shipment.fulfillmentOrderId, ids)))
      .orderBy(desc(shipment.createdAt)),
    tx
      .select({ at: fulfillmentOrder.customerToldAt })
      .from(fulfillmentOrder)
      .where(eq(fulfillmentOrder.orderId, orderId)),
  ])
  const waiting = live.flatMap((p) =>
    p.lines
      .filter((l) => l.quantity > l.fulfilledQuantity)
      .map((l) => ({
        parcelId: p.id,
        orderLineId: l.orderLineId,
        quantity: l.quantity - l.fulfilledQuantity,
        locationId: p.locationId,
      })),
  )
  const availability = await linesAvailability(tx, waiting)
  const toldAt = told
    .flatMap((t) => (t.at ? [t.at] : []))
    .sort((a, b) => b.getTime() - a.getTime())[0]
  return {
    customerToldAt: toldAt ?? null,
    parcels: live.map((p) => {
      const label = labels.find(
        (l) => l.parcelId === p.id && l.status !== 'cancelled' && l.status !== 'rto',
      )
      return {
        id: p.id,
        shipment: label
          ? {
              id: label.id,
              provider: label.provider,
              providerLabel: shipping.get(label.provider)?.label ?? label.provider,
              serviceLabel: label.serviceLabel,
              waybill: label.waybill,
              status: label.status,
              trackingUrl: label.trackingUrl,
              bookedAt: label.bookedAt,
              deliveryBy: expectedDateOf(label.tracking) ?? p.deliveryEstimate?.latest ?? null,
            }
          : null,
        lines: waiting.flatMap((w, i) =>
          w.parcelId === p.id
            ? [{ orderLineId: w.orderLineId, availability: availability[i] as LineAvailability }]
            : [],
        ),
      }
    }),
  }
}
