/** SOURCE OF TRUTH: courier activity, app bar, courier overview tiles, parcels in transit — WHAT: one courier's parcels in a store at a glance (moving, delayed, booked today, RTO this month) and its newest shipment change / WHY: courier apps' app bar pill, sidebar count and Overview tiles read it in one statement */
import { dayKey, startOfDay, startOfMonth } from '@commerce/dates'
import { type StoreTx, shipment } from '@commerce/db'
import { and, eq, gte, inArray, lt, max, ne, sql } from 'drizzle-orm'

/** Parcels on the road: picked up, not yet delivered or back. */
const MOVING = ['picked_up', 'in_transit', 'out_for_delivery'] as const

/** A courier's parcels in this store at a glance, for its app bar, sidebar count and Overview. */
export type CourierActivity = {
  /** Parcels picked up and not yet delivered or returned. */
  moving: number
  /** Of those, the ones past the date the courier promised (`tracking.expectedDate`). */
  delayed: number
  /** Booked since midnight (India time), cancelled ones left out. */
  bookedToday: number
  /** What the courier charged for today's bookings, where it said (paise). */
  chargedTodayPaise: number
  /** Booked since the 1st of this month (India time), cancelled ones left out. */
  bookedThisMonth: number
  /** Of this month's bookings, the ones coming back (RTO). */
  rtoThisMonth: number
  /** The newest change to any of its shipments (a tracking update, a booking); null before any. */
  lastUpdate: Date | null
}

/**
 * One statement over this store's shipments with one courier (`shipment.provider`), for a
 * courier app's `appBar` read (`AppBarContext.courierActivity`) and its Overview tiles
 * (`shipments.courierOverview`). `now` is for tests.
 */
export async function courierActivity(
  tx: StoreTx,
  storeId: string,
  provider: string,
  now: Date = new Date(),
): Promise<CourierActivity> {
  const moving = inArray(shipment.status, [...MOVING])
  const booked = ne(shipment.status, 'cancelled')
  const today = startOfDay(now)
  const month = startOfMonth(now)
  const thisMonth = and(booked, gte(shipment.createdAt, month))
  const [row] = await tx
    .select({
      moving: sql<number>`(count(*) filter (where ${moving}))::int`,
      delayed: sql<number>`(count(*) filter (where ${and(
        moving,
        lt(sql`${shipment.tracking}->>'expectedDate'`, dayKey(now)),
      )}))::int`,
      bookedToday: sql<number>`(count(*) filter (where ${and(booked, gte(shipment.createdAt, today))}))::int`,
      chargedToday: sql<number>`(coalesce(sum(${shipment.courierChargePaise}) filter (where ${and(
        booked,
        gte(shipment.createdAt, today),
      )}), 0))::int`,
      bookedThisMonth: sql<number>`(count(*) filter (where ${thisMonth}))::int`,
      rtoThisMonth: sql<number>`(count(*) filter (where ${and(thisMonth, eq(shipment.status, 'rto'))}))::int`,
      last: max(shipment.updatedAt),
    })
    .from(shipment)
    .where(and(eq(shipment.storeId, storeId), eq(shipment.provider, provider)))
  return {
    moving: Number(row?.moving ?? 0),
    delayed: Number(row?.delayed ?? 0),
    bookedToday: Number(row?.bookedToday ?? 0),
    chargedTodayPaise: Number(row?.chargedToday ?? 0),
    bookedThisMonth: Number(row?.bookedThisMonth ?? 0),
    rtoThisMonth: Number(row?.rtoThisMonth ?? 0),
    lastUpdate: row?.last ?? null,
  }
}
