/** SOURCE OF TRUTH: tests for the related products query — shared collection first, then type, vendor and tags, then best sellers; never itself, unpublished or another store's */
import {
  collection,
  collectionProduct,
  createDb,
  newId,
  order,
  orderLine,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { storeLiquidData } from './data'
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
  over: { status?: 'active' | 'draft'; type?: string; vendor?: string; tags?: string[] } = {},
) {
  const id = newId()
  await owner.insert(product).values({
    id,
    storeId,
    title: handle,
    handle,
    status: over.status ?? 'active',
    productType: over.type ?? null,
    vendor: over.vendor ?? null,
    tags: over.tags ?? [],
  })
  return id
}

let orderNumber = 0

/** One order selling `quantity` of the product (a fresh variant), counted unless test or cancelled. */
async function sell(
  storeId: string,
  productId: string,
  quantity: number,
  over: { isTest?: boolean; status?: 'open' | 'cancelled' } = {},
) {
  const [v] = await owner
    .insert(variant)
    .values({ storeId, productId, title: 'Default', pricePaise: 10_000 })
    .returning()
  orderNumber += 1
  const [o] = await owner
    .insert(order)
    .values({
      storeId,
      number: orderNumber,
      status: over.status ?? 'open',
      isTest: over.isTest ?? false,
      subtotalPaise: 10_000 * quantity,
      totalPaise: 10_000 * quantity,
    })
    .returning()
  await owner.insert(orderLine).values({
    storeId,
    orderId: o?.id as string,
    variantId: v?.id as string,
    quantity,
    unitPricePaise: 10_000,
  })
}

describe('relatedProductIds', () => {
  it('ranks a shared collection first, then type and tags; skips itself and unpublished', async () => {
    const storeId = await seedStore()
    const base = await addProduct(storeId, 'base', { type: 'Serum', tags: ['dry'] })
    const inCollection = await addProduct(storeId, 'in-collection')
    const sameType = await addProduct(storeId, 'same-type', { type: 'serum' })
    const sameTag = await addProduct(storeId, 'same-tag', { tags: ['dry'] })
    const draft = await addProduct(storeId, 'draft', { type: 'Serum', status: 'draft' })
    const unrelated = await addProduct(storeId, 'unrelated', { type: 'Soap' })
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
    // `unrelated` shares nothing: it comes last, as a best-seller fill (no sales: newest first).
    expect(ids).toEqual([inCollection, sameType, sameTag, unrelated])
  })

  it('ranks a same-vendor product with the same type, then fills with best sellers by units sold', async () => {
    const storeId = await seedStore()
    const base = await addProduct(storeId, 'base', { vendor: 'Waimers' })
    const sameVendor = await addProduct(storeId, 'same-vendor', { vendor: 'waimers' })
    const seller = await addProduct(storeId, 'seller')
    const newest = await addProduct(storeId, 'newest')
    await sell(storeId, seller, 5)
    // Test and cancelled orders do not count.
    await sell(storeId, newest, 50, { isTest: true })
    await sell(storeId, newest, 50, { status: 'cancelled' })
    const ids = await withStore(app, storeId, (tx) => relatedProductIds(tx, base))
    expect(ids).toEqual([sameVendor, seller, newest])
  })

  it('never reaches into another store', async () => {
    const a = await seedStore()
    const b = await seedStore()
    const base = await addProduct(a, 'base', { type: 'Serum' })
    await addProduct(b, 'other', { type: 'Serum' })
    expect(await withStore(app, a, (tx) => relatedProductIds(tx, base))).toEqual([])
  })
})

describe('storeLiquidData relatedProducts', () => {
  it('complementary with no merchant picks falls back to the related row, buyable only', async () => {
    const storeId = await seedStore()
    const base = await addProduct(storeId, 'base', { type: 'Pad' })
    const pad = await addProduct(storeId, 'pad', { type: 'Pad' })
    const soldOut = await addProduct(storeId, 'sold-out', { type: 'Pad' })
    // Pre-order variants sell with no stock; the sold-out one has no stock and no pre-order.
    await owner.update(product).set({ preorderEnabled: true }).where(eq(product.id, pad))
    for (const productId of [pad, soldOut]) {
      await owner.insert(variant).values({ storeId, productId, title: 'Default', pricePaise: 100 })
    }
    const read = (intent: 'related' | 'complementary') =>
      withStore(app, storeId, async (tx) => {
        const data = await storeLiquidData(tx, { storeId, host: 'w.in', origin: 'https://w.in' })
        return (await data.relatedProducts(base, 4, intent)).map((p) => p.handle)
      })
    expect(await read('complementary')).toEqual(['pad'])
    expect(await read('related')).toEqual(['pad'])
  })
})
