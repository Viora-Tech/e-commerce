/** SOURCE OF TRUTH: loadLocalOptionLocations, setLocationLocalDelivery, setLocationStorePickup
 * WHAT:  Local delivery and pickup in store per location (audit #163): reading them for the
 *        checkout quote, and saving them from Settings › Locations › a location.
 * WHY:   The rule itself is pure (`local-options.ts`); this is the database side of it.
 */
import { location, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { CommerceError } from '../errors'
import {
  type LocalDelivery,
  LocalDeliverySchema,
  type LocalOptionLocation,
  parseLocalDelivery,
  parseStorePickup,
  type StorePickup,
  StorePickupSchema,
} from './local-options'

/** Every location with its local delivery and pickup settings. RLS scopes the rows. */
export async function loadLocalOptionLocations(tx: StoreTx): Promise<LocalOptionLocation[]> {
  const rows = await tx
    .select({
      id: location.id,
      name: location.name,
      active: location.active,
      localDelivery: location.localDelivery,
      storePickup: location.storePickup,
    })
    .from(location)
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    active: r.active,
    localDelivery: parseLocalDelivery(r.localDelivery),
    storePickup: parseStorePickup(r.storePickup),
  }))
}

async function saveLocal(
  tx: StoreTx,
  storeId: string,
  locationId: string,
  set: Partial<Pick<typeof location.$inferInsert, 'localDelivery' | 'storePickup'>>,
): Promise<void> {
  const rows = await tx
    .update(location)
    .set(set)
    .where(eq(location.id, locationId))
    .returning({ id: location.id })
  if (rows.length === 0) {
    throw new CommerceError('NOT_FOUND', `Location ${locationId} not found`, { storeId })
  }
}

/** Save a location's local delivery; null removes it. */
export async function setLocationLocalDelivery(
  tx: StoreTx,
  storeId: string,
  locationId: string,
  raw: LocalDelivery | null,
): Promise<LocalDelivery | null> {
  const value = raw ? LocalDeliverySchema.parse(raw) : null
  const pincodes = value ? [...new Set(value.pincodes)] : []
  await saveLocal(tx, storeId, locationId, {
    localDelivery: value ? { ...value, pincodes } : null,
  })
  return value ? { ...value, pincodes } : null
}

/** Save a location's pickup in store; null removes it. */
export async function setLocationStorePickup(
  tx: StoreTx,
  storeId: string,
  locationId: string,
  raw: StorePickup | null,
): Promise<StorePickup | null> {
  const value = raw ? StorePickupSchema.parse(raw) : null
  await saveLocal(tx, storeId, locationId, { storePickup: value })
  return value
}
