/**
 * A product Shopify keeps off the Online Store (active, but its storefront 404s it) is
 * imported hidden. Waimers' ATK RS keyboards showed in /collections/atk and /keyboard here
 * while waimers.in hid them. A shop that publishes nothing to the Online Store (headless)
 * keeps its active products active. A fake Admin API only.
 */
import { product, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../src/connection'
import { parseProductsCsv } from '../src/csv-products'
import { executeRun } from '../src/run'
import { createApiRun, startRun } from '../src/service'
import { productStatus } from '../src/shopify-api'
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
  requestedQueryCost: 1,
  throttleStatus: { maximumAvailable: 20000, currentlyAvailable: 19000, restoreRate: 1000 },
}

async function importProducts(onlineStore: boolean) {
  const fake = fakeShopify({ customers: 0, orders: 0, products: 0 })
  fake.data.products = [
    productNode(1, { publishedAt: '2026-04-06T11:39:57Z' }),
    productNode(2, { publishedAt: null }),
    productNode(3, { status: 'DRAFT', publishedAt: null }),
  ]
  const graphql = (query: string, variables: Record<string, unknown>) =>
    query.includes('query OnlineStoreProducts')
      ? json({
          data: { products: { nodes: onlineStore ? [{ id: 'gid://shopify/Product/1' }] : [] } },
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
  const run = await withStore(app, storeId, (tx) =>
    createApiRun(tx, storeId, { resources: ['products'], createdBy: null }),
  )
  await executeRun(d, run.id)
  await withStore(app, storeId, (tx) => startRun(tx, run.id))
  await executeRun(d, run.id)
  const rows = await owner
    .select({ handle: product.handle, status: product.status })
    .from(product)
    .orderBy(asc(product.handle))
  return Object.fromEntries(rows.map((r) => [r.handle, r.status]))
}

describe('products off the Online Store', () => {
  it('imports an active product Shopify does not publish as hidden', async () => {
    expect(await importProducts(true)).toEqual({
      'product-2': 'draft',
      'product-3': 'draft',
      tee: 'active',
    })
  })

  it('leaves active products active in a shop that publishes nothing to the Online Store', async () => {
    expect(await importProducts(false)).toEqual({
      'product-2': 'active',
      'product-3': 'draft',
      tee: 'active',
    })
  })

  it('maps status and publication', () => {
    expect(productStatus({ status: 'ACTIVE', publishedAt: null }, true)).toBe('draft')
    expect(productStatus({ status: 'ACTIVE', publishedAt: '2026-01-01T00:00:00Z' }, true)).toBe(
      'active',
    )
    // An older copy without the field is not hidden.
    expect(productStatus({ status: 'ACTIVE' }, true)).toBe('active')
    expect(productStatus({ status: 'ARCHIVED', publishedAt: null }, false)).toBe('archived')
  })

  it('a CSV row that is active but not published reads as draft', () => {
    const header = 'Handle,Title,Published,Variant Price,Status'
    const csv = [
      header,
      'kb-a,Keyboard A,false,999,active',
      'kb-b,Keyboard B,true,999,active',
    ].join('\n')
    const { products } = parseProductsCsv(csv)
    expect(products.map((p) => [p.handle, p.status])).toEqual([
      ['kb-a', 'draft'],
      ['kb-b', 'active'],
    ])
  })
})
