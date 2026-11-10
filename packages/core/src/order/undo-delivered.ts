/** SOURCE OF TRUTH: undoDelivered
 * WHAT:  "Mark as not delivered": clears an order's hand-over date and puts parcels that read
 *        Delivered only because of "Mark as delivered" back to their tracked status.
 * WHY:   "Mark as delivered" pressed by mistake had no way back (owner, 11 Nov 2026).
 * WHERE: `orders.markNotDelivered` (api routers/order-undo.ts), the order page's More actions.
 */
import { order, orderNote, shipment } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recomputeOrderStatuses } from './recompute'

/**
 * "Mark as not delivered": undoes a "Mark as delivered" pressed by mistake. Clears the order's
 * hand-over date, and parcels that read Delivered only because of that button (their courier's
 * tracking never said delivered) go back to what their tracking last said. Parcels the courier
 * itself reported delivered are left alone. The shopper's Delivered message cannot be recalled.
 * Returns false when the order is not marked delivered (nothing to undo).
 */
export async function undoDelivered(
  ctx: StoreContext,
  orderId: string,
  author: string | null = null,
): Promise<boolean> {
  const [o] = await ctx.tx
    .select({ deliveredAt: order.deliveredAt, status: order.status })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  if (!o?.deliveredAt || o.status === 'draft' || o.status === 'cancelled') return false
  await ctx.tx.update(order).set({ deliveredAt: null }).where(eq(order.id, orderId))
  const trackedStatus = sql<string>`coalesce(nullif(${shipment.tracking}->>'status', ''), 'created')`
  await ctx.tx
    .update(shipment)
    .set({ status: sql`${trackedStatus}`, deliveredAt: null, updatedAt: new Date() })
    .where(
      and(
        eq(shipment.orderId, orderId),
        eq(shipment.status, 'delivered'),
        sql`coalesce(${shipment.tracking}->>'status', '') <> 'delivered'`,
      ),
    )
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: 'Marked as not delivered: the delivery was recorded by mistake.',
    author,
  })
  await recomputeOrderStatuses(ctx, orderId)
  return true
}
