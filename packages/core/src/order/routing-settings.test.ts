import {
  createDb,
  inventoryLevel,
  location,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { parseShippingSettings } from '../shipping/settings'
import { GstRegistrationError, listBusinessGst } from '../tax/registrations'
import { reorderLocations, setLocationSelling, setMaxParcels } from './routing-settings'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

/** Haryana (default), Delhi and Mumbai, a shirt with stock at each, and a saved courier secret. */
async function seed() {
  const [s] = await owner
    .insert(store)
    .values({
      slug: 'w',
      name: 'Waimers',
      shipping: { enabled: ['fake'], providers: { fake: { token: 'secret' } } },
    })
    .returning()
  const storeId = s?.id as string
  const locs = await owner
    .insert(location)
    .values([
      { storeId, name: 'Haryana', isDefault: true, fulfilsOnlineOrders: true, priority: 0 },
      { storeId, name: 'Delhi', priority: 1 },
      { storeId, name: 'Mumbai', priority: 2 },
    ])
    .returning()
  const id = (name: string) => locs.find((l) => l.name === name)?.id as string
  const [p] = await owner
    .insert(product)
    .values({ storeId, handle: 'tee', title: 'Tee' })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId: p?.id as string, title: 'M', pricePaise: 100 })
    .returning()
  await owner
    .insert(inventoryLevel)
    .values(locs.map((l) => ({ storeId, variantId: v?.id as string, locationId: l.id, onHand: 2 })))
  return {
    storeId,
    variantId: v?.id as string,
    haryana: id('Haryana'),
    delhi: id('Delhi'),
    mumbai: id('Mumbai'),
  }
}

type Seeded = Awaited<ReturnType<typeof seed>>

const inStore = <T>(t: Seeded, fn: Parameters<typeof withStore<T>>[2]) =>
  withStore(app, t.storeId, fn)

async function sellingRows(t: Seeded) {
  const rows = await owner
    .select({ locationId: inventoryLevel.locationId, sells: inventoryLevel.fulfilsOnline })
    .from(inventoryLevel)
    .where(eq(inventoryLevel.variantId, t.variantId))
  return rows
    .filter((r) => r.sells)
    .map((r) => r.locationId)
    .sort()
}

describe('ships online orders', () => {
  it('switching a location on lets its stock sell, and off again', async () => {
    const t = await seed()
    await inStore(t, (tx) =>
      setLocationSelling(tx, t.storeId, { locationId: t.delhi, sells: true }),
    )
    expect(await sellingRows(t)).toEqual([t.haryana, t.delhi].sort())
    const view = await inStore(t, (tx) => listBusinessGst(tx, t.storeId))
    expect(view.locations.find((l) => l.id === t.delhi)?.fulfilsOnlineOrders).toBe(true)
    await inStore(t, (tx) =>
      setLocationSelling(tx, t.storeId, { locationId: t.delhi, sells: false }),
    )
    expect(await sellingRows(t)).toEqual([t.haryana])
  })

  it('the default location always ships online orders', async () => {
    const t = await seed()
    const err = await inStore(t, (tx) =>
      setLocationSelling(tx, t.storeId, { locationId: t.haryana, sells: false }),
    ).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(GstRegistrationError)
    expect((err as GstRegistrationError).code).toBe('DEFAULT_SELLS')
    expect(await sellingRows(t)).toEqual([t.haryana])
  })
})

describe('routing order and parcel limit', () => {
  it('saves the order checkout tries locations in, and lists them that way', async () => {
    const t = await seed()
    await inStore(t, (tx) =>
      reorderLocations(tx, t.storeId, { locationIds: [t.mumbai, t.haryana, t.delhi] }),
    )
    const rows = await owner
      .select({ id: location.id, priority: location.priority })
      .from(location)
      .orderBy(asc(location.priority))
    expect(rows).toEqual([
      { id: t.mumbai, priority: 0 },
      { id: t.haryana, priority: 1 },
      { id: t.delhi, priority: 2 },
    ])
    const view = await inStore(t, (tx) => listBusinessGst(tx, t.storeId))
    expect(view.locations.map((l) => l.id)).toEqual([t.mumbai, t.haryana, t.delhi])
  })

  it('refuses a location from another store', async () => {
    const t = await seed()
    await expect(
      inStore(t, (tx) =>
        reorderLocations(tx, t.storeId, {
          locationIds: [t.haryana, '0199a000-0000-7000-8000-000000000001'],
        }),
      ),
    ).rejects.toThrow()
  })

  it('sets the parcel limit and keeps every other shipping setting', async () => {
    const t = await seed()
    expect((await inStore(t, (tx) => listBusinessGst(tx, t.storeId))).maxParcels).toBe(2)
    await inStore(t, (tx) => setMaxParcels(tx, t.storeId, { maxParcels: 3 }))
    const [s] = await owner.select().from(store).where(eq(store.id, t.storeId))
    const settings = parseShippingSettings(s?.shipping)
    expect(settings.routing.maxParcels).toBe(3)
    expect(settings.providers).toEqual({ fake: { token: 'secret' } })
    expect((await inStore(t, (tx) => listBusinessGst(tx, t.storeId))).maxParcels).toBe(3)
    await expect(
      inStore(t, (tx) => setMaxParcels(tx, t.storeId, { maxParcels: 9 })),
    ).rejects.toThrow()
  })
})
