/** SOURCE OF TRUTH: undoPackedLine
 * WHAT:  "Mark as unfulfilled" on one line of the Fulfilled card: that line's packed units go
 *        back to To ship (and back in stock), the order's other packed lines stay as they are.
 * WHY:   owner, 22 Nov 2026: a wrong item marked shipped could only be undone for the whole
 *        order; Shopify has a ⋯ on the fulfilment for this.
 * WHERE: `orders.markLineNotShipped` (api routers/order-undo.ts), the Fulfilled card's row ⋯.
 */
import { fulfillmentOrderLine, order, orderNote, shipment } from '@commerce/db'
import { and, eq, gt, inArray, isNull, or } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { unpackFulfillmentOrder } from './fulfillment-orders'
import { recomputeOrderStatuses } from './recompute'
import type { UndoPackedResult } from './undo-packed'

/** Courier statuses after which a label no longer carries the items. */
const ENDED = ['cancelled', 'rto']

/**
 * Unpacks one order line in every parcel that holds it packed. Refused while a courier label
 * on one of those parcels (or on the whole order) is live: Cancel shipment undoes that one. A
 * tracking number typed by hand closes with the last packed unit of its parcel.
 */
export async function undoPackedLine(
  ctx: StoreContext,
  orderId: string,
  orderLineId: string,
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
  const held = await ctx.tx
    .select({ parcel: fulfillmentOrderLine.fulfillmentOrderId })
    .from(fulfillmentOrderLine)
    .where(
      and(
        eq(fulfillmentOrderLine.orderLineId, orderLineId),
        gt(fulfillmentOrderLine.fulfilledQuantity, 0),
      ),
    )
  const parcels = [...new Set(held.map((h) => h.parcel))]
  if (parcels.length === 0) return { undone: false, reason: 'not_packed' }
  const live = (
    await ctx.tx
      .select({
        id: shipment.id,
        status: shipment.status,
        labelUrl: shipment.labelUrl,
        parcel: shipment.fulfillmentOrderId,
      })
      .from(shipment)
      .where(
        and(
          eq(shipment.orderId, orderId),
          or(isNull(shipment.fulfillmentOrderId), inArray(shipment.fulfillmentOrderId, parcels)),
        ),
      )
  ).filter((s) => !ENDED.includes(s.status))
  if (live.some((s) => s.labelUrl !== null)) return { undone: false, reason: 'live_shipment' }

  let units = 0
  for (const parcel of parcels) {
    units += await unpackFulfillmentOrder(ctx, orderId, parcel, orderLineId)
  }
  if (units === 0) return { undone: false, reason: 'not_packed' }
  // A hand-typed tracking number whose parcel has nothing packed left closes with it.
  const stillPacked = new Set(
    (
      await ctx.tx
        .select({ parcel: fulfillmentOrderLine.fulfillmentOrderId })
        .from(fulfillmentOrderLine)
        .where(
          and(
            inArray(fulfillmentOrderLine.fulfillmentOrderId, parcels),
            gt(fulfillmentOrderLine.fulfilledQuantity, 0),
          ),
        )
    ).map((r) => r.parcel),
  )
  const closing = live.filter((s) => s.parcel !== null && !stillPacked.has(s.parcel))
  if (closing.length > 0) {
    await ctx.tx
      .update(shipment)
      .set({ status: 'cancelled', updatedAt: new Date() })
      .where(
        inArray(
          shipment.id,
          closing.map((s) => s.id),
        ),
      )
  }
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: `Marked as unfulfilled: ${units} ${units === 1 ? 'unit' : 'units'} of one item back to To ship.`,
    author,
  })
  await recomputeOrderStatuses(ctx, orderId)
  return { undone: true, units }
}
