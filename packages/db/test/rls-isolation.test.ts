import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { createDb } from '../src/client'
import { product, store } from '../src/schema'
import { withoutStore, withStore } from '../src/with-store'
import { resetDb } from './reset'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function seedTwoStores() {
  const [a, b] = await owner
    .insert(store)
    .values([
      { slug: 'a', name: 'Store A' },
      { slug: 'b', name: 'Store B' },
    ])
    .returning()
  if (!a || !b) throw new Error('seed failed')
  await owner.insert(product).values([
    { storeId: a.id, handle: 'pa', title: 'A product' },
    { storeId: b.id, handle: 'pb', title: 'B product' },
  ])
  return { a, b }
}

describe('store isolation', () => {
  it('each store context sees only its own rows', async () => {
    const { a, b } = await seedTwoStores()
    const seenByA = await withStore(app, a.id, (tx) => tx.select().from(product))
    const seenByB = await withStore(app, b.id, (tx) => tx.select().from(product))
    expect(seenByA.map((p) => p.handle)).toEqual(['pa'])
    expect(seenByB.map((p) => p.handle)).toEqual(['pb'])
  })

  it('the app role sees nothing without a store context', async () => {
    await seedTwoStores()
    const rows = await app.select().from(product)
    expect(rows).toEqual([])
  })

  it('a store cannot insert a row for another store', async () => {
    const { a, b } = await seedTwoStores()
    const err = await withStore(app, a.id, (tx) =>
      tx.insert(product).values({ storeId: b.id, handle: 'smuggled', title: 'x' }),
    ).catch((e: unknown) => e)
    // Drizzle wraps the driver error; the Postgres message lives in `cause`.
    const message =
      err instanceof Error ? ((err.cause as Error | undefined)?.message ?? err.message) : ''
    expect(message).toMatch(/row-level security/)
    const rows = await owner.select().from(product)
    expect(rows.map((p) => p.handle).sort()).toEqual(['pa', 'pb'])
  })

  it('withoutStore on the owner connection sees every row', async () => {
    await seedTwoStores()
    const rows = await withoutStore(owner, (tx) => tx.select().from(product))
    expect(rows).toHaveLength(2)
  })
})
