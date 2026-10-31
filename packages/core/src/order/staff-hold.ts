/** SOURCE OF TRUTH: holdOrderByStaff, releaseOrderByStaff — WHAT: "Hold fulfilment" and "Release hold" on the order page (#1011): hold every unshipped parcel with a picked reason and note, release them, a timeline line with who and why, and `order.fulfillment_held` / `order.fulfillment_released` for automations / WHY: staff need to stop an order shipping (stock, address or payment check, the customer asked) without a made-up "in progress" status; the hold itself is `fulfillment-hold.ts`, the same one automations use. */
import { order, orderNote } from '@commerce/db'
import { eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import { canHoldFulfillment, type FulfillmentHoldReason } from './edit-rules'
import { holdFulfillment, holdWords, releaseFulfillment } from './fulfillment-hold'
import { ensureFulfillmentOrders } from './fulfillment-orders'

export type StaffHoldInput = {
  orderId: string
  reason: FulfillmentHoldReason
  /** Optional words with the reason ("Waiting on the blue in M"). */
  note?: string | undefined
  /** Staff email, on the parcels and the timeline line. */
  author: string
}

/** Holding was refused: the order is closed, shipped, imported, or already held. */
export class OrderNotHoldable extends CommerceError {
  constructor(orderNumber: number | null, why: string, storeId?: string) {
    const which = orderNumber === null ? 'This order' : `Order #${orderNumber}`
    super('ORDER_NOT_HOLDABLE', `${which} cannot be put on hold: ${why}`, { storeId })
  }
}

async function lockOrder(ctx: StoreContext, orderId: string) {
  const [o] = await ctx.tx
    .select({
      id: order.id,
      number: order.number,
      status: order.status,
      fulfillmentStatus: order.fulfillmentStatus,
      importedFrom: order.importedFrom,
    })
    .from(order)
    .where(eq(order.id, orderId))
    .for('update')
  return o ?? null
}

/** Holds the order's unshipped parcels; the ids held. Refuses an order that cannot be held. */
export async function holdOrderByStaff(
  ctx: StoreContext,
  input: StaffHoldInput,
): Promise<string[]> {
  const o = await lockOrder(ctx, input.orderId)
  if (!o) throw new OrderNotHoldable(null, 'it was not found', ctx.storeId)
  if (!canHoldFulfillment(o)) {
    throw new OrderNotHoldable(o.number, 'nothing is left to ship', ctx.storeId)
  }
  // An order older than parcels gets them first, so there is something to hold.
  await ensureFulfillmentOrders(ctx, input.orderId)
  const note = input.note?.trim() || null
  const held = await holdFulfillment(ctx, input.orderId, note, {
    code: input.reason,
    heldBy: input.author,
  })
  if (held.length === 0) {
    throw new OrderNotHoldable(o.number, 'it is already on hold', ctx.storeId)
  }
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: input.orderId,
    body: `Fulfilment put on hold: ${holdWords({ code: input.reason, reason: note })}`,
    author: input.author,
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.fulfillment_held', {
    orderId: input.orderId,
  })
  return held
}

/** Lifts every hold on the order; the ids released (empty: nothing was held, nothing written). */
export async function releaseOrderByStaff(
  ctx: StoreContext,
  input: { orderId: string; author: string },
): Promise<string[]> {
  if (!(await lockOrder(ctx, input.orderId))) return []
  const released = await releaseFulfillment(ctx, input.orderId)
  if (released.length === 0) return []
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId: input.orderId,
    body: 'Fulfilment hold released',
    author: input.author,
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.fulfillment_released', {
    orderId: input.orderId,
  })
  return released
}
