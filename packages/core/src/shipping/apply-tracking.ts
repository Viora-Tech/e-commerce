/** SOURCE OF TRUTH: applying a courier's tracking answer — WHAT: stores the scan on the shipment and moves its order (in transit, delivered, RTO, NDR) / WHY: the tracking poll, the courier webhooks and manual tracking must all move an order the same way */
import { orderNote, shipment } from '@commerce/db'
import type { Tracking } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recomputeOrderStatuses } from '../order/recompute'
import { insertOutboxEvent } from '../outbox/write'
import { recordRtoForShipment } from '../returns/rto'
import { syncNdrFromTracking } from './ndr'
import { sharedOrdersOf } from './shared-parcel'
import { lostScanFields } from './shipment-lost'
import type { ShipmentRow } from './shipments'

/** When the delivered scan happened, from the courier's events; now when it gave no time. */
function deliveredAt(tracking: Tracking): Date {
  const at = tracking.events.filter((e) => e.status === 'delivered').at(-1)?.at
  const d = at ? new Date(at) : new Date()
  return Number.isNaN(d.getTime()) ? new Date() : d
}

/**
 * Store a fresh Tracking answer; flips the order to delivered when the courier says so. Every
 * order in the box moves with it: the one it was booked for and any packed in the same box
 * ("Same box as #A"), each with its own events and, when it comes back, its own RTO task.
 */
export async function applyTracking(
  ctx: StoreContext,
  shipmentId: string,
  tracking: Tracking,
): Promise<{ shipment: ShipmentRow; becameDelivered: boolean }> {
  const [before] = await ctx.tx.select().from(shipment).where(eq(shipment.id, shipmentId))
  if (!before) throw new Error('shipment not found')
  /* A lost parcel stays lost on an ordinary scan; only delivered or back (found after all) moves
     it on. The courier's own lost scan opens the claim as "Mark as lost" does (shipment-lost). */
  const found = tracking.status === 'delivered' || tracking.status === 'rto'
  const status = before.status === 'lost' && !found ? 'lost' : tracking.status
  const becameLost = before.status !== 'lost' && status === 'lost'
  const [row] = await ctx.tx
    .update(shipment)
    .set({
      ...(becameLost ? lostScanFields(before) : {}),
      status,
      tracking,
      trackingUrl: tracking.trackingUrl ?? before.trackingUrl,
      // The delivered scan's time, for promised-vs-delivered (the latest delivered event).
      ...(tracking.status === 'delivered' && !before.deliveredAt
        ? { deliveredAt: deliveredAt(tracking) }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(shipment.id, shipmentId))
    .returning()
  if (!row) throw new Error('shipment not found')
  if (becameLost) {
    await ctx.tx.insert(orderNote).values({
      storeId: ctx.storeId,
      orderId: row.orderId,
      body: `${row.provider === 'delhivery' ? 'Delhivery' : 'The courier'} marked AWB ${row.waybill} as lost. Reship it from Shipments › Lost, and track the courier claim there.`,
      author: null,
    })
  }
  const becameDelivered = before.status !== 'delivered' && tracking.status === 'delivered'
  const becameOutForDelivery =
    before.status !== 'out_for_delivery' && row.status === 'out_for_delivery'
  const orders =
    before.status === row.status
      ? []
      : [
          { orderId: row.orderId, fulfillmentOrderId: row.fulfillmentOrderId },
          ...(await sharedOrdersOf(ctx, row.id)),
        ]
  for (const carried of orders) {
    // Courier events (in transit, delivered, RTO) move the fulfilment status.
    await recomputeOrderStatuses(ctx, carried.orderId)
    if (becameOutForDelivery) {
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'shipment.out_for_delivery', {
        orderId: carried.orderId,
      })
    }
    if (becameDelivered) {
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.delivered', { orderId: carried.orderId })
    }
    // The parcel came back undelivered: open the order's RTO task (once per shipment and order).
    if (before.status !== 'rto' && row.status === 'rto') {
      await recordRtoForShipment(ctx, row, carried)
    }
  }
  // Raises or clears the delivery-problem flag from this same scan; see `syncNdrFromTracking`.
  const final = await syncNdrFromTracking(ctx, row, tracking)
  return { shipment: final, becameDelivered }
}
