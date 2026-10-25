/** SOURCE OF TRUTH: tests for the related products query — shared collection first, then type and tags, never itself, unpublished or another store's */
import {
  collection,
  collectionProduct,
  createDb,
  newId,
  product,
  store,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { relatedProductIds } from './related'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedStore() {
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  return s.id
}

async function addProduct(
  storeId: string,
  handle: string,
  over: { status?: 'active' | 'draft'; type?: string; tags?: string[] } = {},
) {
  const id = newId()
  await owner.insert(product).values({
    id,
    storeId,
    title: handle,
    handle,
    status: over.status ?? 'active',
    productType: over.type ?? null,
    tags: over.tags ?? [],
  })
  return id
}

describe('relatedProductIds', () => {
  it('ranks a shared collection first, then type and tags; skips itself and unpublished', async () => {
    const storeId = await seedStore()
    const base = await addProduct(storeId, 'base', { type: 'Serum', tags: ['dry'] })
    const inCollection = await addProduct(storeId, 'in-collection')
    const sameType = await addProduct(storeId, 'same-type', { type: 'serum' })
    const sameTag = await addProduct(storeId, 'same-tag', { tags: ['dry'] })
    const draft = await addProduct(storeId, 'draft', { type: 'Serum', status: 'draft' })
    await addProduct(storeId, 'unrelated', { type: 'Soap' })
    const [c] = await owner
      .insert(collection)
      .values({ storeId, title: 'Faces', handle: 'faces' })
      .returning()
    if (!c) throw new Error('seed')
    await owner.insert(collectionProduct).values([
      { storeId, collectionId: c.id, productId: base },
      { storeId, collectionId: c.id, productId: inCollection },
      { storeId, collectionId: c.id, productId: draft },
    ])
    const ids = await withStore(app, storeId, (tx) => relatedProductIds(tx, base))
    expect(ids).toEqual([inCollection, sameType, sameTag])
  })

  it('never reaches into another store', async () => {
    const a = await seedStore()
    const b = await seedStore()
    const base = await addProduct(a, 'base', { type: 'Serum' })
    await addProduct(b, 'other', { type: 'Serum' })
    expect(await withStore(app, a, (tx) => relatedProductIds(tx, base))).toEqual([])
  })
})
