/** SOURCE OF TRUTH: one tracking number, one order
 * WHAT:  refuses a hand-typed tracking number (AWB) that already belongs to another order's
 *        shipment, instead of the shipment upsert quietly moving that shipment to this order.
 * WHY:   #2462 and #2464 went out in one box under one Delhivery AWB (15 Nov 2026): packing
 *        #2464 under #2462's AWB moved #2462's shipment, which then never got tracking or closed
 *        as delivered. The same order re-packing under its own AWB still updates its row.
 * WHERE: `fulfilOrderLines` (pack form, Ship it yourself, bulk Mark as fulfilled) and
 *        `createShipmentForOrder` with the merchant's own number (India Post).
 */
import { order, shipment } from '@commerce/db'
import { and, eq, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

/** Courier statuses after which a shipment no longer carries anything. */
const ENDED = new Set(['cancelled', 'rto'])

/**
 * The tracking number is on another order's shipment. `live` says whether that shipment still
 * carries a parcel: then the way to send this order in the same box is "Same box as #A".
 */
export class TrackingNumberOnAnotherOrder extends CommerceError {
  readonly waybill: string
  readonly otherOrderId: string
  readonly otherOrderNumber: number
  readonly live: boolean

  constructor(
    waybill: string,
    other: { id: string; number: number; live: boolean },
    storeId?: string,
  ) {
    super(
      'TRACKING_NUMBER_ON_ANOTHER_ORDER',
      other.live
        ? `Tracking number ${waybill} is already on order #${other.number}. To send this order in the same box, choose "Same box as #${other.number}" when you fulfil it.`
        : `Tracking number ${waybill} was used on order #${other.number}. Use a new tracking number for this order.`,
      { storeId },
    )
    this.waybill = waybill
    this.otherOrderId = other.id
    this.otherOrderNumber = other.number
    this.live = other.live
  }
}

/** The number is on a shipment this store cannot see (another store's courier account). */
export class TrackingNumberTaken extends CommerceError {
  constructor(waybill: string, storeId?: string) {
    super(
      'TRACKING_NUMBER_TAKEN',
      `Tracking number ${waybill} is already used by another shipment. Check the number.`,
      { storeId },
    )
  }
}

/** Throws `TrackingNumberOnAnotherOrder` when this courier's AWB is on a different order. */
export async function assertWaybillFree(
  ctx: StoreContext,
  input: { provider: string; waybill: string; orderId: string },
): Promise<void> {
  const [taken] = await ctx.tx
    .select({ orderId: shipment.orderId, number: order.number, status: shipment.status })
    .from(shipment)
    .innerJoin(order, eq(order.id, shipment.orderId))
    .where(
      and(
        eq(shipment.provider, input.provider),
        eq(shipment.waybill, input.waybill),
        ne(shipment.orderId, input.orderId),
      ),
    )
    .limit(1)
  if (!taken) return
  throw new TrackingNumberOnAnotherOrder(
    input.waybill,
    { id: taken.orderId, number: taken.number, live: !ENDED.has(taken.status) },
    ctx.storeId,
  )
}
