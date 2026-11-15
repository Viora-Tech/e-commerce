/** SOURCE OF TRUTH: applying a courier's tracking answer — WHAT: stores the scan on the shipment and moves its order (in transit, delivered, RTO, NDR) / WHY: the tracking poll, the courier webhooks and manual tracking must all move an order the same way */
import { shipment } from '@commerce/db'
import type { Tracking } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recomputeOrderStatuses } from '../order/recompute'
import { insertOutboxEvent } from '../outbox/write'
import { recordRtoForShipment } from '../returns/rto'
import { syncNdrFromTracking } from './ndr'
import type { ShipmentRow } from './shipments'

/** When the delivered scan happened, from the courier's events; now when it gave no time. */
function deliveredAt(tracking: Tracking): Date {
  const at = tracking.events.filter((e) => e.status === 'delivered').at(-1)?.at
  const d = at ? new Date(at) : new Date()
  return Number.isNaN(d.getTime()) ? new Date() : d
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
      // The delivered scan's time, for promised-vs-delivered (the latest delivered event).
      ...(tracking.status === 'delivered' && !before.deliveredAt
        ? { deliveredAt: deliveredAt(tracking) }
        : {}),
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
