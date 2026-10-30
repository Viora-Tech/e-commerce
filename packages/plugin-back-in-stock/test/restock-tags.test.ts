/**
 * Shopify restock-app customer tags (`restock-<handle>`) become waiting signups (audit #198).
 */
import { createDb, customer, newId, product, store, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { importRestockTags } from '../src/restock-tags'
import { listSignups } from '../src/signups'

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
  const slug = `s-${Math.random().toString(36).slice(2)}`
  const [s] = await owner.insert(store).values({ slug, name: slug }).returning()
  if (!s) throw new Error('seed')
  const productId = newId()
  await owner.insert(product).values({
    id: productId,
    storeId: s.id,
    title: 'Dysphoria Mio',
    handle: 'dysphoria-mio-wireless-mouse',
  })
  const variantId = newId()
  await owner.insert(variant).values({
    id: variantId,
    storeId: s.id,
    productId,
    title: 'Default',
    pricePaise: 100000,
  })
  await owner.insert(customer).values([
    { storeId: s.id, email: 'asha@example.com', tags: ['restock-dysphoria-mio', 'vip'] },
    { storeId: s.id, email: 'ravi@example.com', tags: ['Restock-dysphoria-mio'] },
    { storeId: s.id, email: 'no@example.com', tags: ['restock-gone-product'] },
    { storeId: s.id, email: null, phone: '919800000000', tags: ['restock-dysphoria-mio'] },
  ])
  return { storeId: s.id, variantId }
}

describe('importRestockTags', () => {
  it('adds confirmed signups for the tagged product, once, and names unknown tags', async () => {
    const { storeId, variantId } = await seed()
    const first = await withStore(app, storeId, (tx) => importRestockTags(tx, storeId))
    expect(first.added).toBe(2)
    expect(first.unmatched).toEqual([{ tag: 'restock-gone-product', customers: 1 }])
    const rows = await withStore(app, storeId, (tx) => listSignups(tx, storeId))
    expect(rows.map((r) => [r.email, r.variantId, r.status]).sort()).toEqual([
      ['asha@example.com', variantId, 'confirmed'],
      ['ravi@example.com', variantId, 'confirmed'],
    ])
    const again = await withStore(app, storeId, (tx) => importRestockTags(tx, storeId))
    expect(again.added).toBe(0)
  })
})
