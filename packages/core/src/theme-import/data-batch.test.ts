/** SOURCE OF TRUTH: theme data batch reads tests — products by handle and several collections' products in one load, active only, in collection order, capped */
import { collection, collectionProduct, createDb, product, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { storeLiquidData } from './data'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seed() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  const storeId = s?.id as string
  const rows = await owner
    .insert(product)
    .values([
      { storeId, handle: 'a', title: 'A', status: 'active' },
      { storeId, handle: 'b', title: 'B', status: 'active' },
      { storeId, handle: 'c', title: 'C', status: 'active' },
      { storeId, handle: 'hidden', title: 'Hidden', status: 'draft' },
    ])
    .returning()
  const id = (handle: string) => rows.find((r) => r.handle === handle)?.id as string
  const [one, two] = await owner
    .insert(collection)
    .values([
      { storeId, handle: 'one', title: 'One' },
      { storeId, handle: 'two', title: 'Two' },
    ])
    .returning()
  await owner.insert(collectionProduct).values([
    { storeId, collectionId: one?.id as string, productId: id('c'), position: 0 },
    { storeId, collectionId: one?.id as string, productId: id('hidden'), position: 1 },
    { storeId, collectionId: one?.id as string, productId: id('a'), position: 2 },
    { storeId, collectionId: one?.id as string, productId: id('b'), position: 3 },
    { storeId, collectionId: two?.id as string, productId: id('b'), position: 0 },
  ])
  return storeId
}

const source = (
  storeId: string,
  read: (s: Awaited<ReturnType<typeof storeLiquidData>>) => unknown,
) =>
  withStore(app, storeId, async (tx) =>
    read(await storeLiquidData(tx, { storeId, host: 'w.in', origin: 'https://w.in' })),
  )

describe('storeLiquidData batches', () => {
  it('products: every active product asked for, by handle, in one load', async () => {
    const storeId = await seed()
    const found = (await source(storeId, (s) =>
      s.products?.(['a', 'b', 'hidden', 'missing']),
    )) as Map<string, { handle: string }>
    expect([...found.keys()].sort()).toEqual(['a', 'b'])
    expect(found.get('a')?.handle).toBe('a')
  })

  it('collectionsProducts: each collection in its own order, active only, capped', async () => {
    const storeId = await seed()
    const found = (await source(storeId, (s) =>
      s.collectionsProducts?.(['one', 'two', 'none', 'all'], 2),
    )) as Map<string, { handle: string }[]>
    const handles = (h: string) => found.get(h)?.map((p) => p.handle)
    expect(handles('one')).toEqual(['c', 'a'])
    expect(handles('two')).toEqual(['b'])
    expect(handles('none')).toEqual([])
    expect(handles('all')).toHaveLength(2)
  })
})
