/** SOURCE OF TRUTH: fulfilment holds — WHAT: put an order's unshipped parcels on hold (`fulfillment_order.held_at`, with a reason), release them, and the guard every shipment booking calls (`assertNotHeld`) / WHY: an automation's "Hold fulfilment" (risky COD, fraud review) must really stop a label being booked until someone releases it; a pre-order parcel's `status = on_hold` is a different thing (goods waiting for stock) and is left alone. */
import { fulfillmentOrder, order, type StoreTx } from '@commerce/db'
import { and, eq, inArray, isNotNull, isNull } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

/** Parcels that can still ship, so a hold means something on them. */
const SHIPPABLE = ['open', 'on_hold'] as const

/** A booking was refused because the parcel (or the order) is held. */
export class FulfillmentOnHold extends CommerceError {
  readonly reason: string | null
  constructor(orderNumber: number | null, reason: string | null, storeId?: string) {
    const which = orderNumber === null ? 'This order' : `Order #${orderNumber}`
    super(
      'FULFILLMENT_ON_HOLD',
      `${which} is on hold${reason ? ` (${reason})` : ''}. Release the hold before shipping it.`,
      { storeId },
    )
    this.reason = reason
  }
}

/** Holds every unshipped, unheld parcel of the order; the ids it held (empty: nothing to hold). */
export async function holdFulfillment(
  ctx: StoreContext,
  orderId: string,
  reason: string | null,
): Promise<string[]> {
  const held = await ctx.tx
    .update(fulfillmentOrder)
    .set({ heldAt: new Date(), holdReason: reason || null, updatedAt: new Date() })
    .where(
      and(
        eq(fulfillmentOrder.orderId, orderId),
        inArray(fulfillmentOrder.status, [...SHIPPABLE]),
        isNull(fulfillmentOrder.heldAt),
      ),
    )
    .returning({ id: fulfillmentOrder.id })
  return held.map((p) => p.id)
}

/** Lifts every hold on the order; the ids it released (empty: nothing was held). */
export async function releaseFulfillment(ctx: StoreContext, orderId: string): Promise<string[]> {
  const released = await ctx.tx
    .update(fulfillmentOrder)
    .set({ heldAt: null, holdReason: null, updatedAt: new Date() })
    .where(and(eq(fulfillmentOrder.orderId, orderId), isNotNull(fulfillmentOrder.heldAt)))
    .returning({ id: fulfillmentOrder.id })
  return released.map((p) => p.id)
}

/** The order's held parcels (still shippable), with why. */
export async function heldParcels(
  tx: StoreTx,
  orderId: string,
): Promise<{ id: string; reason: string | null }[]> {
  const rows = await tx
    .select({ id: fulfillmentOrder.id, reason: fulfillmentOrder.holdReason })
    .from(fulfillmentOrder)
    .where(
      and(
        eq(fulfillmentOrder.orderId, orderId),
        inArray(fulfillmentOrder.status, [...SHIPPABLE]),
        isNotNull(fulfillmentOrder.heldAt),
      ),
    )
  return rows
}

/**
 * Refuses a booking for a held parcel: the named one, or any of the order's when it ships
 * whole. Called by every path that books a label (`createShipmentForOrder`).
 */
export async function assertNotHeld(
  ctx: StoreContext,
  orderId: string,
  fulfillmentOrderId?: string | null,
): Promise<void> {
  const held = await heldParcels(ctx.tx, orderId)
  const hit = fulfillmentOrderId ? held.find((p) => p.id === fulfillmentOrderId) : held[0]
  if (!hit) return
  const [o] = await ctx.tx.select({ number: order.number }).from(order).where(eq(order.id, orderId))
  throw new FulfillmentOnHold(o?.number ?? null, hit.reason, ctx.storeId)
}
