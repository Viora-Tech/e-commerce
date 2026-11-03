/** SOURCE OF TRUTH: inbound shipment arrival — WHAT: a shipment is delivered once every purchase
 * order on it has nothing left to receive, and receiving the whole shipment receives each order's
 * outstanding units / WHY: the shipments list showed imports "On the way" after their goods were in
 * stock (#1062), and marking a shipment delivered did nothing to its orders (#1065).
 */
import { inboundShipment, purchaseOrder, type StoreTx } from '@commerce/db'
import { and, eq, ne, sql } from 'drizzle-orm'

/** Purchase order statuses with nothing left to receive. */
const DONE = new Set(['received', 'closed'])

/**
 * Marks the shipment delivered (arrived today, unless a date was already set) when it has at
 * least one live purchase order and every one of them is fully received or closed. Cancelled
 * orders are ignored. A shipment already delivered stays as it is. Returns whether it changed.
 */
export async function syncShipmentArrival(
  tx: StoreTx,
  storeId: string,
  shipmentId: string,
): Promise<boolean> {
  const orders = await tx
    .select({ status: purchaseOrder.status })
    .from(purchaseOrder)
    .where(
      and(
        eq(purchaseOrder.storeId, storeId),
        eq(purchaseOrder.inboundShipmentId, shipmentId),
        ne(purchaseOrder.status, 'cancelled'),
      ),
    )
  if (orders.length === 0 || !orders.every((o) => DONE.has(o.status))) return false
  const now = new Date()
  const changed = await tx
    .update(inboundShipment)
    .set({
      status: 'delivered',
      arrivedAt: sql`coalesce(${inboundShipment.arrivedAt}, ${now.toISOString()}::timestamptz)`,
      updatedAt: now,
    })
    .where(
      and(
        eq(inboundShipment.id, shipmentId),
        eq(inboundShipment.storeId, storeId),
        ne(inboundShipment.status, 'delivered'),
      ),
    )
    .returning({ id: inboundShipment.id })
  return changed.length > 0
}
