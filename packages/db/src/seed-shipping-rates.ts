import { eq } from 'drizzle-orm'
import { createDb, type Db } from './client'
import { shippingRate, shippingZone, store } from './schema'
import type { StoreTx } from './with-store'

/**
 * One "All India" shipping zone for a store: ₹49 flat, free from ₹999. Adds
 * rows only; a store that already has any zone is left alone, so running
 * this twice (or after the merchant edited their rates) changes nothing.
 * Takes either a plain `Db` (the seed script, on the owner connection) or a
 * store-scoped `StoreTx` (a running store's own creation, under RLS).
 */
export async function seedWaimersShipping(db: Db | StoreTx, storeId: string): Promise<boolean> {
  const [existing] = await db
    .select({ id: shippingZone.id })
    .from(shippingZone)
    .where(eq(shippingZone.storeId, storeId))
    .limit(1)
  if (existing) return false
  const [zone] = await db
    .insert(shippingZone)
    .values({ storeId, name: 'All India', stateCodes: [], pincodeRules: [], position: 0 })
    .returning({ id: shippingZone.id })
  if (!zone) throw new Error('shipping zone insert failed')
  await db.insert(shippingRate).values({
    storeId,
    zoneId: zone.id,
    name: 'Standard',
    condition: 'none',
    pricePaise: 4900,
    freeAbovePaise: 99900,
    position: 0,
  })
  return true
}

export async function seedShippingRates(ownerUrl: string): Promise<void> {
  const db = createDb(ownerUrl)
  try {
    const [s] = await db.select().from(store).where(eq(store.slug, 'waimers'))
    if (!s) throw new Error('seed the store first (bun run db:seed)')
    const added = await seedWaimersShipping(db, s.id)
    console.log(
      added ? 'seed: added the All India shipping zone' : 'seed: shipping zones already present',
    )
  } finally {
    await db.$client.end()
  }
}

if ((import.meta as { main?: boolean }).main) {
  const url = process.env.DATABASE_URL_OWNER
  if (!url) throw new Error('DATABASE_URL_OWNER is required')
  await seedShippingRates(url)
}
