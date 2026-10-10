/** SOURCE OF TRUTH: orderParcelsView, ParcelView
 * WHAT:  An order's parcels as people read them: where each ships from (warehouse, city,
 *        state, GSTIN), what is in it, whether it is packed, and whether it waits on a stock
 *        transfer.
 * WHY:   One order may ship in several parcels from different warehouses (order/routing.ts).
 *        The admin order page and the shopper's order pages and emails all show the same
 *        picture, so it is read in one place.
 * WHERE: admin `orders.get` (`parcels`); shopper order views and messages.
 */
import {
  type FulfillmentOrderStatus,
  fulfillmentOrder,
  fulfillmentOrderLine,
  gstRegistration,
  location,
  orderLine,
  type StoreTx,
} from '@commerce/db'
import { asc, eq } from 'drizzle-orm'
import { INDIAN_STATE_NAMES } from '../tax/states'

export type ParcelLineView = {
  orderLineId: string
  title: string | null
  variantTitle: string | null
  quantity: number
  fulfilledQuantity: number
}

export type ParcelView = {
  id: string
  /** Parcel 1, 2, ... */
  position: number
  status: FulfillmentOrderStatus
  needsTransfer: boolean
  locationId: string
  locationName: string
  city: string | null
  stateCode: string | null
  stateName: string | null
  /** The GSTIN it is billed under; null in a store without one. */
  gstin: string | null
  totalPaise: number | null
  lines: ParcelLineView[]
}

/** The order's parcels in parcel order, cancelled ones included (they show as cancelled). */
export async function orderParcelsView(tx: StoreTx, orderId: string): Promise<ParcelView[]> {
  const parcels = await tx
    .select({
      id: fulfillmentOrder.id,
      position: fulfillmentOrder.position,
      status: fulfillmentOrder.status,
      needsTransfer: fulfillmentOrder.needsTransfer,
      totalPaise: fulfillmentOrder.totalPaise,
      locationId: location.id,
      locationName: location.name,
      city: location.city,
      stateCode: location.stateCode,
      gstin: gstRegistration.gstin,
    })
    .from(fulfillmentOrder)
    .innerJoin(location, eq(location.id, fulfillmentOrder.locationId))
    .leftJoin(gstRegistration, eq(gstRegistration.id, fulfillmentOrder.gstRegistrationId))
    .where(eq(fulfillmentOrder.orderId, orderId))
    .orderBy(asc(fulfillmentOrder.position))
  if (parcels.length === 0) return []
  const lines = await tx
    .select({
      fulfillmentOrderId: fulfillmentOrderLine.fulfillmentOrderId,
      orderLineId: fulfillmentOrderLine.orderLineId,
      title: orderLine.title,
      variantTitle: orderLine.variantTitle,
      quantity: fulfillmentOrderLine.quantity,
      fulfilledQuantity: fulfillmentOrderLine.fulfilledQuantity,
    })
    .from(fulfillmentOrderLine)
    .innerJoin(orderLine, eq(orderLine.id, fulfillmentOrderLine.orderLineId))
    .where(eq(orderLine.orderId, orderId))
    .orderBy(asc(orderLine.id))
  return parcels.map((p) => {
    const stateCode = p.stateCode?.trim().toUpperCase() || null
    return {
      ...p,
      stateCode,
      stateName: stateCode ? (INDIAN_STATE_NAMES[stateCode] ?? null) : null,
      lines: lines
        .filter((l) => l.fulfillmentOrderId === p.id)
        .map(({ fulfillmentOrderId: _fo, ...l }) => l),
    }
  })
}
