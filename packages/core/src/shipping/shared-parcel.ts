/** SOURCE OF TRUTH: one box, several orders ("Same box as #A")
 * WHAT:  an order whose items went out in another order's box rides on that order's shipment
 *        (`shipment_shared_order`): no second courier booking, the same AWB and tracking, shipped,
 *        delivered and RTO with it. Which boxes it may join, joining one, and leaving one.
 * WHY:   #2462 and #2464 (one customer) were packed in one box under one Delhivery AWB (owner,
 *        15 Nov 2026). Typing the AWB on the second order moved the first one's shipment; now
 *        that number is refused (order/waybill-owner.ts) and this is the way to record it.
 * WHERE: `fulfilOrderLines` (`sameBoxAs`), `applyTracking` (followers), `undoPacked` and
 *        `cancelShipment` (leaving), the order page's Fulfil items card (`orders.sameBoxChoices`).
 */
import { order, orderNote, shipment, shipmentSharedOrder } from '@commerce/db'
import { and, desc, eq, inArray, ne, notInArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { unpackFulfillmentOrder } from '../order/fulfillment-orders'
import { recomputeOrderStatuses } from '../order/recompute'

/** A box another order of this customer is in, still with the courier or waiting for them. */
export type SameBoxChoice = {
  shipmentId: string
  orderId: string
  orderNumber: number
  waybill: string
  /** The carrier as booked or typed ("Delhivery"), else the courier app's id. */
  courier: string
  status: string
}

/** Shipments an order can still join: not cancelled, not back (RTO), not delivered. */
const JOINABLE = ['created', 'picked_up', 'in_transit', 'out_for_delivery'] as const

class SameBoxRefused extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('SAME_BOX_REFUSED', message, { storeId })
  }
}

/** The customer an order belongs to: its customer record, else its email. */
async function ownerOf(ctx: StoreContext, orderId: string) {
  const [o] = await ctx.tx
    .select({ customerId: order.customerId, email: order.email })
    .from(order)
    .where(eq(order.id, orderId))
  return o ?? null
}

/**
 * The live boxes of the same customer's other open orders this order could go in, newest first.
 * An order with neither a customer nor an email has none: there is no way to tell it is theirs.
 */
export async function sameBoxChoices(ctx: StoreContext, orderId: string): Promise<SameBoxChoice[]> {
  const who = await ownerOf(ctx, orderId)
  const email = who?.email?.trim().toLowerCase()
  if (!who || (!who.customerId && !email)) return []
  return ctx.tx
    .select({
      shipmentId: shipment.id,
      orderId: order.id,
      orderNumber: order.number,
      waybill: shipment.waybill,
      courier: sql<string>`coalesce(nullif(${shipment.carrier}, ''), ${shipment.provider})`,
      status: shipment.status,
    })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .where(
      and(
        ne(order.id, orderId),
        notInArray(order.status, ['cancelled', 'draft']),
        inArray(shipment.status, [...JOINABLE]),
        who.customerId
          ? eq(order.customerId, who.customerId)
          : sql`lower(${order.email}) = ${email}`,
        sql`not exists (select 1 from ${shipmentSharedOrder} sso where sso.shipment_id = ${shipment.id} and sso.order_id = ${orderId})`,
      ),
    )
    .orderBy(desc(shipment.createdAt))
    .limit(20)
}

/** Refuses a box this order may not join (see `sameBoxChoices`); returns the box otherwise. */
export async function assertSameBox(
  ctx: StoreContext,
  orderId: string,
  shipmentId: string,
): Promise<SameBoxChoice> {
  const box = (await sameBoxChoices(ctx, orderId)).find((c) => c.shipmentId === shipmentId)
  if (!box) {
    throw new SameBoxRefused(
      'That parcel cannot take this order: it must be a live shipment of another open order from the same customer.',
      ctx.storeId,
    )
  }
  return box
}

/** Puts the order in the box and says so on both orders' timelines. */
export async function joinSameBox(
  ctx: StoreContext,
  input: { orderId: string; box: SameBoxChoice; fulfillmentOrderId: string | null },
): Promise<void> {
  await ctx.tx
    .insert(shipmentSharedOrder)
    .values({
      storeId: ctx.storeId,
      shipmentId: input.box.shipmentId,
      orderId: input.orderId,
      fulfillmentOrderId: input.fulfillmentOrderId,
    })
    .onConflictDoNothing()
  const [o] = await ctx.tx
    .select({ number: order.number })
    .from(order)
    .where(eq(order.id, input.orderId))
  await ctx.tx.insert(orderNote).values([
    {
      storeId: ctx.storeId,
      orderId: input.orderId,
      body: `Packed in the same box as order #${input.box.orderNumber} (${input.box.courier}, AWB ${input.box.waybill}).`,
      author: null,
    },
    {
      storeId: ctx.storeId,
      orderId: input.box.orderId,
      body: `Order #${o?.number ?? ''} went in this order's box (AWB ${input.box.waybill}).`,
      author: null,
    },
  ])
}

/** The other orders a shipment carries, with the parcel each put in it. */
export async function sharedOrdersOf(ctx: StoreContext, shipmentId: string) {
  return ctx.tx
    .select({
      orderId: shipmentSharedOrder.orderId,
      fulfillmentOrderId: shipmentSharedOrder.fulfillmentOrderId,
    })
    .from(shipmentSharedOrder)
    .where(eq(shipmentSharedOrder.shipmentId, shipmentId))
}

/** Takes the order out of every box it rides in ("Mark as not shipped" on it). */
export async function leaveSharedBoxes(ctx: StoreContext, orderId: string): Promise<number> {
  const gone = await ctx.tx
    .delete(shipmentSharedOrder)
    .where(eq(shipmentSharedOrder.orderId, orderId))
    .returning({ id: shipmentSharedOrder.id })
  return gone.length
}

/**
 * The box's own label was cancelled (Cancel shipment, or Mark as not shipped on the order it was
 * booked for): the orders riding in it come out too. Their items go back to To ship and back in
 * stock, as the booked order's do, and each timeline says why.
 */
export async function releaseSharedOrders(
  ctx: StoreContext,
  shipmentIds: readonly string[],
  author: string | null = null,
): Promise<void> {
  if (shipmentIds.length === 0) return
  const riders = await ctx.tx
    .delete(shipmentSharedOrder)
    .where(inArray(shipmentSharedOrder.shipmentId, [...shipmentIds]))
    .returning({
      orderId: shipmentSharedOrder.orderId,
      fulfillmentOrderId: shipmentSharedOrder.fulfillmentOrderId,
      shipmentId: shipmentSharedOrder.shipmentId,
    })
  for (const r of riders) {
    const [box] = await ctx.tx
      .select({ waybill: shipment.waybill })
      .from(shipment)
      .where(eq(shipment.id, r.shipmentId))
    await unpackFulfillmentOrder(ctx, r.orderId, r.fulfillmentOrderId)
    await ctx.tx.insert(orderNote).values({
      storeId: ctx.storeId,
      orderId: r.orderId,
      body: `The shared box (AWB ${box?.waybill ?? ''}) was cancelled. This order's items are back to To ship.`,
      author,
    })
    await recomputeOrderStatuses(ctx, r.orderId)
  }
}
