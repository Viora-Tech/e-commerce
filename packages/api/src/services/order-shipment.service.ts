/**
 * WHAT:  the order page's shipment panel: the order's newest shipment, or the box it went in with
 *        another order ("Same box as #A"), with which orders share that box.
 * WHY:   an order packed in another order's box has no shipment of its own (#2462/#2464, 15 Nov
 *        2026), yet it must show that parcel's courier, AWB and tracking.
 * WHERE: `orders.get` (routers/orders.ts).
 */
import { carriesOrder, type ShippingRegistry } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { order, shipment, shipmentSharedOrder } from '@commerce/db'
import { desc, eq } from 'drizzle-orm'
import { describeShipment, type ShipmentDetails } from './shipping.service'

/** An order on the other end of a shared box. */
export type BoxOrder = { orderId: string; number: number }

export type OrderShipmentDetails = ShipmentDetails & {
  /** Set when this order rides in another order's box: that order. Its actions live there. */
  sameBoxAs: BoxOrder | null
  /** The other orders packed in this order's box. */
  alsoCarries: BoxOrder[]
}

/** The order's latest shipment (its own, or a shared box) as its details view shows it. */
export async function shipmentDetailsForOrder(
  tx: StoreTx,
  registry: ShippingRegistry,
  orderId: string,
): Promise<OrderShipmentDetails | null> {
  const [row] = await tx
    .select()
    .from(shipment)
    .where(carriesOrder(orderId))
    .orderBy(desc(shipment.createdAt))
    .limit(1)
  if (!row) return null
  const details = await describeShipment(tx, registry, row)
  if (row.orderId !== orderId) {
    const [booked] = await tx
      .select({ orderId: order.id, number: order.number })
      .from(order)
      .where(eq(order.id, row.orderId))
    return {
      ...details,
      // Cancel, Edit tracking and pickups belong to the order the box was booked for.
      canEditTracking: false,
      canRequestPickup: false,
      sameBoxAs: booked ?? null,
      alsoCarries: [],
    }
  }
  const riders = await tx
    .select({ orderId: order.id, number: order.number })
    .from(shipmentSharedOrder)
    .innerJoin(order, eq(order.id, shipmentSharedOrder.orderId))
    .where(eq(shipmentSharedOrder.shipmentId, row.id))
    .orderBy(order.number)
  return { ...details, sameBoxAs: null, alsoCarries: riders }
}
