/** SOURCE OF TRUTH: splitFulfillmentOrder
 * WHAT:  Partial shipment: an open parcel keeps the units shipping now; the rest move to a
 *        new parcel at the same location ("Part 2"), which stays in To ship.
 * WHY:   Owner, 11 Nov 2026: Shopify needs a cloned shipment with items added by hand; here the
 *        merchant ticks what goes and the rest follows automatically (Figma 916:10179).
 * WHERE: shipments.splitParcel (admin Create shipment); the moved units keep their location,
 *        so no stock moves. Both parcels drop their money shares (subtotal … tax): invoices
 *        fall back to the order's own totals, as for parcels made without shares.
 */
import { fulfillmentOrder, fulfillmentOrderLine } from '@commerce/db'
import { and, desc, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

export type KeepLine = { orderLineId: string; quantity: number }

const NO_SHARES = {
  subtotalPaise: null,
  discountPaise: null,
  adjustmentPaise: null,
  shippingPaise: null,
  totalPaise: null,
  taxPaise: null,
  taxBreakdown: null,
} as const

/** Splits parcel `fulfillmentOrderId`; returns the new parcel's id (the units left behind). */
export async function splitFulfillmentOrder(
  ctx: StoreContext,
  orderId: string,
  fulfillmentOrderId: string,
  keep: readonly KeepLine[],
): Promise<{ restId: string }> {
  const [fo] = await ctx.tx
    .select()
    .from(fulfillmentOrder)
    .where(and(eq(fulfillmentOrder.id, fulfillmentOrderId), eq(fulfillmentOrder.orderId, orderId)))
    .for('update')
  if (!fo) throw new CommerceError('not_found', 'This parcel no longer exists.')
  if (fo.status !== 'open' || fo.heldAt) {
    throw new CommerceError(
      'invalid_state',
      'Only an open parcel that is not on hold can be split.',
    )
  }
  const lines = await ctx.tx
    .select()
    .from(fulfillmentOrderLine)
    .where(eq(fulfillmentOrderLine.fulfillmentOrderId, fo.id))
    .for('update')
  const wanted = new Map(keep.map((k) => [k.orderLineId, k.quantity]))
  let kept = 0
  let moved = 0
  const moves: Array<{ line: (typeof lines)[number]; move: number }> = []
  for (const line of lines) {
    const open = line.quantity - line.fulfilledQuantity
    const stay = wanted.get(line.orderLineId) ?? 0
    if (!Number.isInteger(stay) || stay < 0 || stay > open) {
      throw new CommerceError('invalid_input', 'A quantity is more than the parcel holds.')
    }
    kept += stay
    moved += open - stay
    if (open - stay > 0) moves.push({ line, move: open - stay })
  }
  if (kept === 0) throw new CommerceError('invalid_input', 'Pick at least one item to ship now.')
  if (moved === 0) throw new CommerceError('invalid_input', 'Nothing is left for a second parcel.')

  const [last] = await ctx.tx
    .select({ position: fulfillmentOrder.position })
    .from(fulfillmentOrder)
    .where(eq(fulfillmentOrder.orderId, orderId))
    .orderBy(desc(fulfillmentOrder.position))
    .limit(1)
  const [rest] = await ctx.tx
    .insert(fulfillmentOrder)
    .values({
      storeId: ctx.storeId,
      orderId,
      locationId: fo.locationId,
      gstRegistrationId: fo.gstRegistrationId,
      position: (last?.position ?? fo.position) + 1,
      status: 'open',
      needsTransfer: fo.needsTransfer,
      taxOrigin: fo.taxOrigin,
      deliveryEstimate: fo.deliveryEstimate,
    })
    .returning({ id: fulfillmentOrder.id })
  if (!rest) throw new Error('fulfilment order insert returned nothing')

  await ctx.tx.insert(fulfillmentOrderLine).values(
    moves.map(({ line, move }) => ({
      storeId: ctx.storeId,
      fulfillmentOrderId: rest.id,
      orderLineId: line.orderLineId,
      quantity: move,
    })),
  )
  for (const { line, move } of moves) {
    const left = line.quantity - move
    if (left === 0) {
      await ctx.tx.delete(fulfillmentOrderLine).where(eq(fulfillmentOrderLine.id, line.id))
    } else {
      await ctx.tx
        .update(fulfillmentOrderLine)
        .set({ quantity: left })
        .where(eq(fulfillmentOrderLine.id, line.id))
    }
  }
  await ctx.tx
    .update(fulfillmentOrder)
    .set({ ...NO_SHARES, updatedAt: new Date() })
    .where(eq(fulfillmentOrder.id, fo.id))
  return { restId: rest.id }
}
