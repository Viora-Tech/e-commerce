import { order, orderLine, shipment } from '@commerce/db'
import { and, eq, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

export type FulfilLineInput = { lineId: string; quantity: number }

export type FulfilOrderInput = {
  orderId: string
  lines: FulfilLineInput[]
  /** Courier name typed by the merchant when the parcel is not booked through a plugin. */
  courier?: string | undefined
  trackingNumber?: string | undefined
  trackingUrl?: string | undefined
}

export type FulfilOrderResult = {
  orderId: string
  /** True once every line is packed, which is when the order becomes "fulfilled". */
  complete: boolean
  fulfilledLines: number
  shipmentId: string | null
}

export class NothingToFulfil extends CommerceError {
  constructor(orderId: string, storeId?: string) {
    super('NOTHING_TO_FULFIL', `Order ${orderId} has nothing left to pack`, { storeId })
  }
}

export class FulfilTooMany extends CommerceError {
  constructor(lineId: string, storeId?: string) {
    super('FULFIL_TOO_MANY', `You cannot pack more of line ${lineId} than was ordered`, { storeId })
  }
}

const MANUAL_PROVIDER = 'manual'

/**
 * Pack some or all of an order by hand: the merchant picks lines and
 * quantities, optionally with a courier and tracking number. Booking through a
 * shipping plugin is a separate path (`bookShipment`); this one records what
 * the merchant did themselves, so the only side effects are in the database.
 *
 * Must run inside `withStore`. Marking the order fulfilled is left to the
 * caller's notification step so the shopper is told once, not per line.
 */
export async function fulfilOrderLines(
  ctx: StoreContext,
  input: FulfilOrderInput,
): Promise<FulfilOrderResult> {
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, input.orderId))
  const byId = new Map(lines.map((l) => [l.id, l]))

  const wanted = input.lines.filter((l) => l.quantity > 0)
  if (wanted.length === 0) throw new NothingToFulfil(input.orderId, ctx.storeId)

  for (const pick of wanted) {
    const line = byId.get(pick.lineId)
    if (!line) throw new FulfilTooMany(pick.lineId, ctx.storeId)
    if (line.fulfilledQuantity + pick.quantity > line.quantity) {
      throw new FulfilTooMany(pick.lineId, ctx.storeId)
    }
  }

  for (const pick of wanted) {
    await ctx.tx
      .update(orderLine)
      .set({ fulfilledQuantity: sql`${orderLine.fulfilledQuantity} + ${pick.quantity}` })
      .where(and(eq(orderLine.id, pick.lineId), eq(orderLine.orderId, input.orderId)))
  }

  const after = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, input.orderId))
  const complete = after.every((l) => l.fulfilledQuantity >= l.quantity)

  let shipmentId: string | null = null
  const waybill = input.trackingNumber?.trim()
  if (waybill) {
    /* One shipment row per waybill: re-packing under the same number updates it
       rather than creating a duplicate the tracking poller would fight over. */
    const [row] = await ctx.tx
      .insert(shipment)
      .values({
        storeId: ctx.storeId,
        orderId: input.orderId,
        provider: input.courier?.trim() || MANUAL_PROVIDER,
        waybill,
        status: 'created',
        trackingUrl: input.trackingUrl?.trim() || null,
      })
      .onConflictDoUpdate({
        target: [shipment.provider, shipment.waybill],
        set: { orderId: input.orderId, updatedAt: new Date() },
      })
      .returning({ id: shipment.id })
    shipmentId = row?.id ?? null
  }

  if (complete) {
    await ctx.tx
      .update(order)
      .set({ status: 'fulfilled' })
      .where(and(eq(order.id, input.orderId), eq(order.status, 'paid')))
    /* An unpaid order (cash on delivery) still gets packed; its status stays
       "placed" until the money is collected. */
  }

  return {
    orderId: input.orderId,
    complete,
    fulfilledLines: wanted.length,
    shipmentId,
  }
}
