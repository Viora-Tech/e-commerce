/** SOURCE OF TRUTH: courier activity, app bar, parcels in transit — WHAT: one courier's moving parcels and newest shipment change in a store / WHY: courier apps' app bar pill and sidebar count read it in one statement */
import { type StoreTx, shipment } from '@commerce/db'
import { and, eq, inArray, max, sql } from 'drizzle-orm'

/** Parcels on the road: picked up, not yet delivered or back. */
const MOVING = ['picked_up', 'in_transit', 'out_for_delivery'] as const

/** A courier's parcels in this store at a glance, for its app bar and sidebar count. */
export type CourierActivity = {
  /** Parcels picked up and not yet delivered or returned. */
  moving: number
  /** The newest change to any of its shipments (a tracking update, a booking); null before any. */
  lastUpdate: Date | null
}

/**
 * One statement over this store's shipments with one courier (`shipment.provider`), for a
 * courier app's `appBar` read (`AppBarContext.courierActivity`).
 */
export async function courierActivity(
  tx: StoreTx,
  storeId: string,
  provider: string,
): Promise<CourierActivity> {
  const [row] = await tx
    .select({
      moving: sql<number>`(count(*) filter (where ${inArray(shipment.status, [...MOVING])}))::int`,
      last: max(shipment.updatedAt),
    })
    .from(shipment)
    .where(and(eq(shipment.storeId, storeId), eq(shipment.provider, provider)))
  return { moving: Number(row?.moving ?? 0), lastUpdate: row?.last ?? null }
}
