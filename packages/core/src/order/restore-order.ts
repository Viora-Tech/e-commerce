/** SOURCE OF TRUTH: restoreCancelledOrder
 * WHAT:  "Restore order": a cancelled order goes back to open, its unpacked units are held
 *        again and its parcels reopen, so it can be packed and shipped as before.
 * WHY:   a cancel pressed by mistake had no way back (owner, 11 Nov 2026).
 * WHERE: `orders.restore` (api routers/order-undo.ts), the order page's More actions.
 *
 * Refused once money or credit went back to the shopper (a refund, a gift card or store credit
 * returned): restoring would leave the order open with its payment already given back.
 * Units written off at cancel ("Restock" off) are held again from what is on hand.
 */
import { order, orderNote, payment, refund } from '@commerce/db'
import { and, count, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { STORE_CREDIT_PROVIDER } from '../payments/split-tender'
import { reopenFulfillmentOrders } from './fulfillment-orders'
import { recomputeOrderStatuses } from './recompute'

export type RestoreOrderResult =
  | { restored: true; units: number }
  | { restored: false; reason: 'not_cancelled' | 'refunded' | 'credit_returned' }

export async function restoreCancelledOrder(
  ctx: StoreContext,
  orderId: string,
  author: string | null = null,
): Promise<RestoreOrderResult> {
  const [o] = await ctx.tx
    .select({ status: order.status })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  if (o?.status !== 'cancelled') return { restored: false, reason: 'not_cancelled' }
  const [refunds] = await ctx.tx
    .select({ n: count() })
    .from(refund)
    .where(eq(refund.orderId, orderId))
  if ((refunds?.n ?? 0) > 0) return { restored: false, reason: 'refunded' }
  const [credit] = await ctx.tx
    .select({ n: count() })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, STORE_CREDIT_PROVIDER),
        eq(payment.status, 'cancelled'),
      ),
    )
  if ((credit?.n ?? 0) > 0) return { restored: false, reason: 'credit_returned' }
  await ctx.tx
    .update(order)
    .set({ status: 'open', archivedAt: null, cancelReason: null, cancelNote: null })
    .where(eq(order.id, orderId))
  const units = await reopenFulfillmentOrders(ctx, orderId)
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: `Restored the cancelled order: open again${units > 0 ? `, ${units} ${units === 1 ? 'item' : 'items'} held again` : ''}.`,
    author,
  })
  await recomputeOrderStatuses(ctx, orderId)
  return { restored: true, units }
}
