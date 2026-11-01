/**
 * Bulk Operations plumbing (`bulk.ts`), the `mapLimit` concurrency helper, and
 * that writing products concurrently stays idempotent. All mocked fetch —
 * never calls Shopify.
 */
import { product, variant, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { BulkUnavailableError, reassembleBulkStream, runBulkQuery, streamJsonl } from '../src/bulk'
import { mapLimit } from '../src/concurrency'
import { ShopifyClient } from '../src/shopify-client'
import type { NProduct } from '../src/types'
import { writeProduct } from '../src/write-products'
import { app, deps, json, MemoryStorageProvider, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const cost = {
  requestedQueryCost: 5,
  throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1900, restoreRate: 100 },
}

describe('mapLimit', () => {
  it('runs at most `limit` at a time and returns results in input order', async () => {
    let inFlight = 0
    let maxInFlight = 0
    const items = [30, 10, 20, 5, 15, 25]
    const results = await mapLimit(items, 2, async (ms, i) => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((r) => setTimeout(r, ms))
      inFlight--
      return i
    })
    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(results).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('handles an empty list and a limit larger than the list', async () => {
    expect(await mapLimit([], 4, async (x) => x)).toEqual([])
    expect(await mapLimit([1, 2], 10, async (x) => x * 2)).toEqual([2, 4])
  })
})

describe('bulk operations', () => {
  it('runs a query, polls to completion, and reassembles the JSONL parent/child stream', async () => {
    let polls = 0
    const jsonl = [
      { id: 'gid://shopify/Product/1', handle: 'aria-headset', title: 'Aria Headset' },
      {
        id: 'gid://shopify/ProductVariant/11',
        title: 'Black',
        __parentId: 'gid://shopify/Product/1',
      },
      {
        id: 'gid://shopify/MediaImage/21',
        alt: 'Front',
        __parentId: 'gid://shopify/Product/1',
      },
      { id: 'gid://shopify/Product/2', handle: 'keycaps', title: 'Keycaps' },
      {
        id: 'gid://shopify/ProductVariant/22',
        title: 'Red',
        __parentId: 'gid://shopify/Product/2',
      },
      {
        id: 'gid://shopify/ProductVariant/23',
        title: 'Blue',
        __parentId: 'gid://shopify/Product/2',
      },
    ]
      .map((line) => JSON.stringify(line))
      .join('\n')

    const endpoint = 'https://waimers.myshopify.com/admin/api/2026-10/graphql.json'
    const sent: string[] = []
    // The run mutation first, then our own operation by id: RUNNING once, then COMPLETED.
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: 'shpat_test',
      sleep: async () => {},
      fetch: (async (input, init) => {
        const url = String(input)
        if (url === 'https://cdn.example.com/bulk/result.jsonl') {
          return new Response(jsonl, { headers: { 'content-type': 'text/plain' } })
        }
        if (url !== endpoint) throw new Error(`unexpected fetch: ${url}`)
        const body = JSON.parse((init?.body as string) ?? '{}') as {
          query: string
          variables: { id?: string }
        }
        sent.push(body.query)
        if (body.query.includes('bulkOperationRunQuery')) {
          return json({
            data: {
              bulkOperationRunQuery: {
                bulkOperation: { id: 'gid://shopify/BulkOperation/1', status: 'CREATED' },
                userErrors: [],
              },
            },
            extensions: { cost },
          })
        }
        expect(body.variables.id).toBe('gid://shopify/BulkOperation/1')
        polls++
        const status = polls < 2 ? 'RUNNING' : 'COMPLETED'
        return json({
          data: {
            bulkOperation: {
              id: 'gid://shopify/BulkOperation/1',
              status,
              errorCode: null,
              url: status === 'COMPLETED' ? 'https://cdn.example.com/bulk/result.jsonl' : null,
              partialDataUrl: null,
            },
          },
          extensions: { cost },
        })
      }) as typeof fetch,
    })

    const url = await runBulkQuery(client, '{ products { edges { node { id } } } }', {
      intervalMs: 0,
    })
    expect(url).toBe('https://cdn.example.com/bulk/result.jsonl')
    // 2026-01 made ungrouped output the default; the reassembly needs children after their parent.
    expect(sent[0]).toContain('groupObjects: true')
    // 2026-10: `currentBulkOperation` is deprecated; only our own operation is polled.
    expect(sent.some((q) => q.includes('currentBulkOperation'))).toBe(false)

    const nodes = await reassembleBulkStream<{
      id: string
      handle: string
      variants: { nodes: { title: string }[] }
      media: { nodes: { alt: string }[] }
    }>(
      streamJsonl(url as string, client.fetchImpl),
      (type) =>
        type === 'ProductVariant'
          ? { field: 'variants', asPage: false }
          : type === 'MediaImage'
            ? { field: 'media', asPage: false }
            : null,
      [
        { field: 'variants', asPage: false },
        { field: 'media', asPage: false },
      ],
    )

    expect(nodes.map((n) => n.handle)).toEqual(['aria-headset', 'keycaps'])
    expect(nodes[0]?.variants.nodes.map((v) => v.title)).toEqual(['Black'])
    expect(nodes[0]?.media.nodes.map((m) => m.alt)).toEqual(['Front'])
    // A product with no images still gets an empty (not missing) `media.nodes`.
    expect(nodes[1]?.media.nodes).toEqual([])
    expect(nodes[1]?.variants.nodes.map((v) => v.title)).toEqual(['Red', 'Blue'])
  })

  it('throws BulkUnavailableError when our bulk operation fails on Shopify', async () => {
    let calls = 0
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: 'shpat_test',
      sleep: async () => {},
      fetch: (async () => {
        calls++
        if (calls === 1) {
          return json({
            data: {
              bulkOperationRunQuery: {
                bulkOperation: { id: 'gid://shopify/BulkOperation/9', status: 'CREATED' },
                userErrors: [],
              },
            },
            extensions: { cost },
          })
        }
        return json({
          data: {
            bulkOperation: {
              id: 'gid://shopify/BulkOperation/9',
              status: 'FAILED',
              errorCode: 'INTERNAL_SERVER_ERROR',
              url: null,
              partialDataUrl: null,
            },
          },
          extensions: { cost },
        })
      }) as typeof fetch,
    })
    await expect(
      runBulkQuery(client, '{ products { edges { node { id } } } }', { intervalMs: 0 }),
    ).rejects.toThrow(BulkUnavailableError)
  })

  it('throws BulkUnavailableError when Shopify rejects the bulk query', async () => {
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: 'shpat_test',
      sleep: async () => {},
      fetch: (async () =>
        json({
          data: {
            bulkOperationRunQuery: {
              bulkOperation: null,
              userErrors: [{ field: ['query'], message: 'Query is invalid' }],
            },
          },
          extensions: { cost },
        })) as typeof fetch,
    })
    await expect(runBulkQuery(client, '{ bad }')).rejects.toThrow(BulkUnavailableError)
  })
})

describe('concurrent product writes', () => {
  it('writes several products at once without racing or duplicating on a second run', async () => {
    const storeId = await seedStore()
    const d = deps(storeId, new MemoryStorageProvider())
    const ctx = {
      storeId,
      runId: 'run-1',
      dryRun: false,
      inStore: d.inStore,
      media: {
        async host() {
          return null
        },
        async urlOf() {
          return null
        },
      },
      report: {
        of: () => ({ total: 0, processed: 0, created: 0, updated: 0, skipped: 0, failed: 0 }),
        addTotal: () => {},
        count: () => {},
        sample: () => {},
        issue: () => {},
        async flush() {},
      },
      log: () => {},
      secret: d.settingsSecret,
      // biome-ignore lint/suspicious/noExplicitAny: minimal ImportContext stub for this test
    } as any

    const products: NProduct[] = Array.from({ length: 6 }, (_, i) => ({
      sourceId: `gid://shopify/Product/${i}`,
      handle: `product-${i}`,
      title: `Product ${i}`,
      bodyHtml: null,
      vendor: null,
      productType: null,
      tags: [],
      status: 'active',
      seoTitle: null,
      seoDescription: null,
      optionNames: [],
      variants: [
        {
          sourceId: `gid://shopify/ProductVariant/${i}`,
          optionValues: [],
          sku: `SKU-${i}`,
          barcode: null,
          pricePaise: 10000,
          mrpPaise: null,
          costPaise: null,
          taxable: true,
          trackInventory: true,
          weightGrams: null,
          onHand: 5,
          hsCode: null,
          imageSrc: null,
        },
      ],
      images: [],
    }))

    await mapLimit(products, 3, (p) => writeProduct(ctx, p))
    await mapLimit(products, 3, (p) => writeProduct(ctx, p))

    const rows = await owner.select().from(product).where(eq(product.storeId, storeId))
    expect(rows).toHaveLength(6)
    expect(new Set(rows.map((r) => r.handle)).size).toBe(6)
    const variants = await withStore(app, storeId, (tx) => tx.select().from(variant))
    expect(variants).toHaveLength(6)
  })
})
