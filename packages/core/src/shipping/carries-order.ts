/** SOURCE OF TRUTH: which shipments carry an order — WHAT: its own shipments plus any box it went in with another order ("Same box as #A", `shipment_shared_order`) / WHY: every reader of an order's parcel (status, the order page, the shopper's tracking, the shipped message) must see the shared box, or that order reads as shipped with no courier */
import { shipment, shipmentSharedOrder } from '@commerce/db'
import { type SQL, sql } from 'drizzle-orm'

/**
 * A `where` on `shipment` (unaliased) for the shipments that carry this order: the ones booked
 * for it and the ones it shares a box in.
 */
export function carriesOrder(orderId: string | SQL): SQL {
  return sql`(${shipment.orderId} = ${orderId} or exists (select 1 from ${shipmentSharedOrder} sso where sso.shipment_id = ${shipment.id} and sso.order_id = ${orderId}))`
}
