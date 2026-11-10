/** SOURCE OF TRUTH: undoPacked
 * WHAT:  "Mark as not shipped": puts every packed item of an order back to To ship (and back in
 *        stock) when no courier booking for it is live, so it can be booked again.
 * WHY:   a shipment cancelled before the 10 Nov fix left its items packed: #2424 read "Shipped"
 *        with a cancelled AWB and could not be booked again (owner, 11 Nov 2026). Also undoes a
 *        "Mark as fulfilled" pressed by mistake.
 * WHERE: `orders.markNotShipped` (api routers/order-undo.ts), the order page's More actions.
 */
import { order, orderNote, shipment } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { unpackFulfillmentOrder } from './fulfillment-orders'
import { recomputeOrderStatuses } from './recompute'

/** Courier statuses after which a label no longer carries the items. */
const ENDED = new Set(['cancelled', 'rto'])

export type UndoPackedResult =
  | { undone: true; units: number }
  | { undone: false; reason: 'not_packed' | 'live_shipment' | 'delivered' }

/**
 * Unpacks the order's parcels when none of its shipments is live (all cancelled or returned, or
 * none at all) and it is not delivered. A live booking must be cancelled first, which unpacks its
 * own parcel.
 */
export async function undoPacked(
  ctx: StoreContext,
  orderId: string,
  author: string | null = null,
): Promise<UndoPackedResult> {
  const [o] = await ctx.tx
    .select({ deliveredAt: order.deliveredAt, status: order.status })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  if (!o || o.status === 'draft' || o.status === 'cancelled') {
    return { undone: false, reason: 'not_packed' }
  }
  if (o.deliveredAt) return { undone: false, reason: 'delivered' }
  const shipments = await ctx.tx
    .select({ status: shipment.status })
    .from(shipment)
    .where(eq(shipment.orderId, orderId))
  if (shipments.some((s) => !ENDED.has(s.status))) {
    return { undone: false, reason: 'live_shipment' }
  }
  const units = await unpackFulfillmentOrder(ctx, orderId, null)
  if (units === 0) return { undone: false, reason: 'not_packed' }
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: `Marked as not shipped: ${units} ${units === 1 ? 'item is' : 'items are'} back to To ship.`,
    author,
  })
  await recomputeOrderStatuses(ctx, orderId)
  return { undone: true, units }
}
