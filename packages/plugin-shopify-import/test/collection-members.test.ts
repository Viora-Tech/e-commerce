/**
 * Products imported after their collections join them. Waimers added products on
 * Shopify after the first import; "Import remaining" brought the products over but
 * skipped the collections (already here), so /collections/mice showed 77 of 82.
 * A narrowed run now adds the products it wrote to the manual collections Shopify
 * has them in, without undoing what the merchant changed here. A fake Admin API only.
 */
import { collection, collectionProduct, product, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { and, asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ImportResource } from '../src/client'
import { connect } from '../src/connection'
import { executeRun } from '../src/run'
import { importRun } from '../src/schema'
import { createApiRun, createRemainingRun, startRun } from '../src/service'
import { fakeShopify, productNode } from './fixtures/fake-shopify'
import {
  app,
  deps,
  fakeFetch,
  json,
  MemoryStorageProvider,
  owner,
  SECRET,
  seedStore,
} from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const cost = {
  requestedQueryCost: 10,
  throttleStatus: { maximumAvailable: 20000, currentlyAvailable: 19000, restoreRate: 1000 },
}
const none = { hasNextPage: false, endCursor: null }

type Col = { id: number; handle: string; members: string[]; rules?: boolean }

function collectionNode(c: Col) {
  return {
    id: `gid://shopify/Collection/${c.id}`,
    handle: c.handle,
    title: c.handle,
    descriptionHtml: '',
    sortOrder: 'MANUAL',
    templateSuffix: null,
    image: null,
    seo: null,
    ruleSet: c.rules
      ? {
          appliedDisjunctively: false,
          rules: [{ column: 'VENDOR', relation: 'EQUALS', condition: 'Waimers' }],
        }
      : null,
    products: { pageInfo: none, nodes: c.members.map((handle) => ({ handle })) },
  }
}

async function store() {
  const fake = fakeShopify({ customers: 0, orders: 0, products: 2 })
  const cols: Col[] = [
    { id: 1, handle: 'mice', members: ['tee', 'product-2'] },
    { id: 2, handle: 'all-waimers', members: ['tee', 'product-2'], rules: true },
  ]
  const graphql = (query: string, variables: Record<string, unknown>) =>
    query.includes('query Collections(')
      ? json({
          data: { collections: { pageInfo: none, nodes: cols.map(collectionNode) } },
          extensions: { cost },
        })
      : fake.graphql(query, variables)
  const fetchImpl = fake.wrap(fakeFetch(graphql))
  const storeId = await seedStore()
  await withStore(app, storeId, (tx) =>
    connect(
      tx,
      storeId,
      { shopDomain: 'waimers.myshopify.com', accessToken: 'shpat_0123456789abcdef' },
      SECRET,
      fetchImpl,
    ),
  )
  const d = deps(storeId, new MemoryStorageProvider(), {
    fetch: fetchImpl,
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))),
  })
  const finished = async (runId: string) => {
    const [done] = await owner.select().from(importRun).where(eq(importRun.id, runId))
    expect(done?.status).toBe('completed')
  }
  /** Preview, then import it, the way the admin does. */
  const importAll = async (resources: ImportResource[]) => {
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources, createdBy: null }),
    )
    await executeRun(d, run.id)
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)
    await finished(run.id)
  }
  const remaining = async (resources: ImportResource[]) => {
    const run = await withStore(app, storeId, (tx) =>
      createRemainingRun(tx, storeId, { resources, createdBy: null }),
    )
    await executeRun(d, run.id)
    await finished(run.id)
  }
  return { fake, cols, importAll, remaining }
}

async function members(handle: string): Promise<string[]> {
  const rows = await owner
    .select({ handle: product.handle })
    .from(collectionProduct)
    .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
    .innerJoin(product, eq(product.id, collectionProduct.productId))
    .where(eq(collection.handle, handle))
    .orderBy(asc(collectionProduct.position))
  return rows.map((r) => r.handle)
}

describe('products imported after their collections', () => {
  it('"Import remaining" of products adds the new ones to their manual collections', async () => {
    const s = await store()
    await s.importAll(['products', 'collections'])
    expect(await members('mice')).toEqual(['tee', 'product-2'])

    // On Shopify: two new products, put into Mice.
    s.fake.data.products.push(productNode(3), productNode(4))
    s.cols[0]?.members.push('product-3', 'product-4')
    // The merchant took product-2 out of Mice here.
    const [mice] = await owner.select().from(collection).where(eq(collection.handle, 'mice'))
    const [p2] = await owner.select().from(product).where(eq(product.handle, 'product-2'))
    await owner
      .delete(collectionProduct)
      .where(
        and(
          eq(collectionProduct.productId, p2?.id as string),
          eq(collectionProduct.collectionId, mice?.id as string),
        ),
      )

    await s.remaining(['products'])
    expect(await owner.select().from(product)).toHaveLength(4)
    // The new ones join after what is there; product-2 (not written again) stays out.
    expect(await members('mice')).toEqual(['tee', 'product-3', 'product-4'])
    // An automatic collection follows its rules, not Shopify's list.
    expect((await members('all-waimers')).sort()).toEqual(
      ['product-2', 'product-3', 'product-4', 'tee'].sort(),
    )

    // Pressed again: nothing new, nothing duplicated.
    await s.remaining(['products'])
    expect(await members('mice')).toEqual(['tee', 'product-3', 'product-4'])
  })

  it('a products-only import links products to collections imported earlier', async () => {
    const s = await store()
    await s.importAll(['products', 'collections'])
    s.fake.data.products.push(productNode(3))
    s.cols[0]?.members.push('product-3')
    await s.importAll(['products'])
    expect(await members('mice')).toEqual(['tee', 'product-2', 'product-3'])
  })
})
