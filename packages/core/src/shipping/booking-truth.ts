/**
 * WHAT:  what a booking really was, from the courier's own answer: the courier service it went
 *        to, what it costs, and a pickup the courier scheduled as part of it.
 * WHY:   order #2082 (22 Nov 2026): Amazon Shipping Surface was picked through RapidShyp, Blue Dart
 *        Surface was booked, and the shipment still read Amazon's name and ₹123.85; RapidShyp had
 *        scheduled the pickup, yet the shipment said "no pickup yet" and sat in Booked.
 * WHERE: `createShipmentForOrder` (./shipments.ts).
 */
import { dayKey } from '@commerce/dates'
import { orderNote, shipment, shipmentPickup } from '@commerce/db'
import type { CreateShipmentResult, ShippingProvider } from '@commerce/shipping'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { bookedCarrier } from './delivery-options/routes'

/**
 * `shipment_pickup.time_from` for a pickup the courier scheduled itself at booking: no time
 * was asked for, the courier comes in its own slot. The details view words it that way.
 */
export const COURIER_SLOT = ''

type Asked = {
  serviceId?: string | undefined
  serviceLabel?: string | undefined
  carrier?: string | undefined
  /** The price the merchant saw for the picked courier, before insurance (paise). */
  quotedChargePaise?: number | undefined
}

export type BookedCourier = {
  serviceLabel: string | null
  /** Null: keep the carrier worked out from the pick. */
  carrier: string | null
  courierChargePaise: number | null
  /** Set when the courier booked another service than the one picked. */
  swapped: { asked: string; booked: string } | null
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The service, carrier and charge to record. The courier's answer wins over the pick: another
 * service booked is recorded by its own name (`Blue Dart Surface (RapidShyp)`), and the quote
 * the merchant saw is kept as the courier charge only when the courier booked what was quoted.
 * A charge in the courier's own answer always wins.
 */
export function bookedCourier(
  provider: Pick<ShippingProvider, 'id' | 'label'>,
  asked: Asked,
  result: Pick<CreateShipmentResult, 'bookedService' | 'chargePaise'>,
): BookedCourier {
  const askedLabel = asked.serviceLabel?.trim() || null
  const booked = result.bookedService
  const swapped =
    asked.serviceId && booked?.id && !same(asked.serviceId, booked.id)
      ? { asked: askedLabel ?? asked.serviceId, booked: booked.label?.trim() || booked.id }
      : null
  const quoted =
    !swapped && asked.quotedChargePaise != null && asked.quotedChargePaise > 0
      ? Math.round(asked.quotedChargePaise)
      : null
  return {
    serviceLabel: swapped ? `${swapped.booked} (${provider.label})` : askedLabel,
    carrier: swapped ? bookedCarrier(provider, swapped.booked) : null,
    courierChargePaise: result.chargePaise ?? quoted,
    swapped,
  }
}

/** The order's timeline says the courier booked another service than the one picked. */
export async function noteCourierSwapped(
  ctx: StoreContext,
  orderId: string,
  provider: Pick<ShippingProvider, 'label'>,
  swapped: { asked: string; booked: string },
): Promise<void> {
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: `${provider.label} booked ${swapped.booked} instead of ${swapped.asked}. The courier charge was left empty: type what ${provider.label} charged in Profit.`,
    author: null,
  })
}

/**
 * The courier scheduled the pickup as part of the booking: the shipment goes on a scheduled
 * pickup for today at its pickup place (the one already there for this courier, place and day,
 * else a new one), so it lists in To be picked up and Create pickup does not ask again.
 */
export async function recordPickupAtBooking(
  ctx: StoreContext,
  provider: Pick<ShippingProvider, 'id'>,
  row: typeof shipment.$inferSelect,
  now: Date = new Date(),
): Promise<typeof shipment.$inferSelect> {
  const day = dayKey(now)
  const place = row.pickupLocationName ?? ''
  const [open] = await ctx.tx
    .select()
    .from(shipmentPickup)
    .where(
      and(
        eq(shipmentPickup.storeId, ctx.storeId),
        eq(shipmentPickup.provider, provider.id),
        eq(shipmentPickup.status, 'scheduled'),
        eq(shipmentPickup.scheduledFor, day),
        eq(shipmentPickup.pickupLocationName, place),
      ),
    )
    .limit(1)
  const pickup = open
    ? (
        await ctx.tx
          .update(shipmentPickup)
          .set({ expectedPackageCount: open.expectedPackageCount + 1, updatedAt: now })
          .where(eq(shipmentPickup.id, open.id))
          .returning()
      )[0]
    : (
        await ctx.tx
          .insert(shipmentPickup)
          .values({
            storeId: ctx.storeId,
            provider: provider.id,
            scheduledFor: day,
            timeFrom: COURIER_SLOT,
            expectedPackageCount: 1,
            pickupLocationName: place,
            status: 'scheduled',
          })
          .returning()
      )[0]
  if (!pickup) return row
  const [onPickup] = await ctx.tx
    .update(shipment)
    .set({ pickupId: pickup.id, updatedAt: now })
    .where(eq(shipment.id, row.id))
    .returning()
  return onPickup ?? row
}
