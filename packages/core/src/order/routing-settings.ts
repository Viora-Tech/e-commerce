/** SOURCE OF TRUTH: setLocationSelling, reorderLocations, setMaxParcels
 * WHAT:  The merchant's routing choices on Settings › Locations: which locations ship online
 *        orders, the order checkout tries them in, and the most parcels one order may become.
 * WHY:   Routing (order/routing.ts) reads exactly these. The default location always ships
 *        online orders, so a store can never end up with nowhere to sell from (DEFAULT_SELLS).
 * WHERE: `businessGst.setLocationSelling`, `businessGst.reorderLocations`,
 *        `businessGst.setMaxParcels`; the view is part of `listBusinessGst`.
 */
import { location, type StoreTx, store } from '@commerce/db'
import { eq, inArray, sql } from 'drizzle-orm'
import { assertLocations } from '../inventory/levels'
import {
  type LocationOrderInput,
  LocationOrderInputSchema,
  type LocationSellingInput,
  LocationSellingInputSchema,
  MaxParcelsInputSchema,
} from '../tax/registration-schemas'
import { GstRegistrationError } from '../tax/registrations'

/** Turn "Ships online orders" on or off for one location. */
export async function setLocationSelling(
  tx: StoreTx,
  storeId: string,
  raw: LocationSellingInput,
): Promise<void> {
  const input = LocationSellingInputSchema.parse(raw)
  const [loc] = await tx
    .select({ id: location.id, isDefault: location.isDefault })
    .from(location)
    .where(eq(location.id, input.locationId))
  if (!loc) throw new GstRegistrationError('NOT_FOUND', 'Location not found', storeId)
  if (loc.isDefault && !input.sells) {
    throw new GstRegistrationError(
      'DEFAULT_SELLS',
      'Your default location always ships online orders. Make another location the default first.',
      storeId,
    )
  }
  // A trigger copies this onto the location's stock rows (migration 0098).
  await tx.update(location).set({ fulfilsOnlineOrders: input.sells }).where(eq(location.id, loc.id))
}

/** Set the order checkout tries locations in: the first id ships first. */
export async function reorderLocations(
  tx: StoreTx,
  storeId: string,
  raw: LocationOrderInput,
): Promise<void> {
  const { locationIds } = LocationOrderInputSchema.parse(raw)
  const ids = [...new Set(locationIds)]
  await assertLocations(tx, storeId, ids)
  await tx
    .update(location)
    .set({
      priority: sql`array_position(${sql`array[${sql.join(
        ids.map((id) => sql`${id}::uuid`),
        sql`, `,
      )}]`}, ${location.id}) - 1`,
    })
    .where(inArray(location.id, ids))
}

/** The most parcels one order may be split into (`store.shipping.routing.maxParcels`). */
export async function setMaxParcels(
  tx: StoreTx,
  storeId: string,
  raw: { maxParcels: number },
): Promise<number> {
  const { maxParcels } = MaxParcelsInputSchema.parse(raw)
  // Only this key changes: courier secrets in the same column stay as they are.
  await tx
    .update(store)
    .set({
      shipping: sql`jsonb_set(coalesce(${store.shipping}, '{}'::jsonb), '{routing}', ${JSON.stringify({ maxParcels })}::jsonb)`,
    })
    .where(eq(store.id, storeId))
  return maxParcels
}
