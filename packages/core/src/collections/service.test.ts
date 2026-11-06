import { collection, collectionProduct, createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createProduct } from '../catalog/products'
import { createCollection, ruleProducts, updateCollection } from './service'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('automatic collections', () => {
  it('reads the cheapest live variant of each product, so price rules match', async () => {
    const [s] = await owner.insert(store).values({ slug: 'c', name: 'c' }).returning()
    const storeId = s?.id as string
    const members = await withStore(app, storeId, async (tx) => {
      await createProduct(tx, storeId, {
        title: 'Headset',
        status: 'active',
        options: [],
        variants: [{ optionValues: [], pricePaise: 149_900 }],
      })
      await createProduct(tx, storeId, {
        title: 'Sticker',
        status: 'active',
        options: [],
        variants: [{ optionValues: [], pricePaise: 9_900 }],
      })
      const rows = await ruleProducts(tx)
      expect(rows.map((r) => r.pricePaise).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([
        9_900, 149_900,
      ])
      const id = await createCollection(tx, storeId, {
        title: 'Premium',
        kind: 'automatic',
        rules: { match: 'all', conditions: [{ field: 'price', op: 'gt', value: '1000' }] },
      })
      return tx.select().from(collectionProduct).where(eq(collectionProduct.collectionId, id))
    })
    expect(members).toHaveLength(1)
  })
})

describe('updateCollection', () => {
  it('keeps what a save leaves out, and clears what it sends as null', async () => {
    const [s] = await owner.insert(store).values({ slug: 'u', name: 'U' }).returning()
    if (!s) throw new Error('seed failed')
    const row = await withStore(app, s.id, async (tx) => {
      const id = await createCollection(tx, s.id, {
        title: 'Mice',
        kind: 'manual',
        description: 'Fast mice',
        sortOrder: 'price_asc',
        status: 'draft',
      })
      await updateCollection(tx, s.id, id, {
        title: 'Mice',
        kind: 'manual',
        seoTitle: 'Gaming mice',
      })
      const kept = (await tx.select().from(collection).where(eq(collection.id, id))).at(0)
      await updateCollection(tx, s.id, id, { title: 'Mice', kind: 'manual', description: null })
      const cleared = (await tx.select().from(collection).where(eq(collection.id, id))).at(0)
      return { kept, cleared }
    })
    expect(row.kept).toMatchObject({
      description: 'Fast mice',
      sortOrder: 'price_asc',
      status: 'draft',
      seoTitle: 'Gaming mice',
    })
    expect(row.cleared).toMatchObject({ description: null, seoTitle: 'Gaming mice' })
  })
})
