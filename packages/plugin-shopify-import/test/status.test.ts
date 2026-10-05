/**
 * "What's left to import" (counts, missing, never imported), "Import remaining"
 * writing only what is missing, problems grouped by cause, and the copy speed-
 * ups: a shared cap on downloads in flight and streamed copies into storage.
 * A fake Admin API only; never calls Shopify.
 */
import { customer, type StoreTx, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ImportResource } from '../src/client'
import { createLimiter } from '../src/concurrency'
import { connect } from '../src/connection'
import { causeOf, issueGroups } from '../src/issue-groups'
import { createMediaHost } from '../src/media'
import { executeRun } from '../src/run'
import { saveMappings } from '../src/runtime'
import { importIssue, importRun } from '../src/schema'
import { createApiRun, createRemainingRun, startRun } from '../src/service'
import { ShopifyClient } from '../src/shopify-client'
import { importStatus, remainingFilter, shopifyCounts } from '../src/status'
import { customerNode, fakeShopify } from './fixtures/fake-shopify'
import {
  app,
  deps,
  fakeFetch,
  json,
  MemoryStorageProvider,
  owner,
  PNG,
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

const P = (n: number) => `gid://shopify/Product/${n}`

/** The start of an mp4 (`ftyp isom`): enough for the media host to store as video. */
const MP4 = new Uint8Array([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 1, 2])

/** A preview, then an import of products, customers and files that left some problems. */
async function seedHistory(storeId: string) {
  await withStore(app, storeId, async (tx: StoreTx) => {
    await tx.insert(importRun).values({
      storeId,
      mode: 'api',
      resources: ['products', 'customers', 'files'],
      dryRun: true,
      status: 'completed',
      progress: {
        products: {
          total: 10,
          processed: 10,
          created: 10,
          updated: 0,
          skipped: 0,
          failed: 0,
          images: 20,
        },
        customers: { total: 5, processed: 5, created: 5, updated: 0, skipped: 0, failed: 0 },
        files: { total: 8, processed: 8, created: 6, updated: 0, skipped: 2, failed: 0 },
      },
      finishedAt: new Date(),
    })
    const [run] = await tx
      .insert(importRun)
      .values({
        storeId,
        mode: 'api',
        resources: ['products', 'customers', 'files'],
        dryRun: false,
        status: 'completed',
        finishedAt: new Date(),
      })
      .returning({ id: importRun.id })
    const runId = run?.id as string
    const issue = (resource: string, sourceId: string, kind: 'record' | 'media' | 'file') => ({
      storeId,
      runId,
      resource,
      sourceId,
      kind,
      message: kind === 'media' ? 'Image https://cdn/x.png was not copied: timeout' : 'failed',
    })
    await tx
      .insert(importIssue)
      .values([
        issue('products', P(3), 'record'),
        issue('products', P(4), 'media'),
        issue('products', P(4), 'media'),
        issue('files', 'gid://shopify/MediaImage/7', 'file'),
      ])
    const local = '00000000-0000-4000-8000-000000000001'
    await saveMappings(
      tx,
      storeId,
      'products',
      [1, 2, 4, 5, 6, 7, 8, 9].map((n) => ({ sourceId: P(n), localId: local })),
    )
    await saveMappings(
      tx,
      storeId,
      'customers',
      [1, 2, 3, 4, 5].map((n) => ({ sourceId: `gid://shopify/Customer/${n}`, localId: local })),
    )
    await saveMappings(
      tx,
      storeId,
      'files',
      [1, 2, 3, 4].map((n) => ({ sourceId: `gid://shopify/MediaImage/${n}`, localId: local })),
    )
  })
}

describe("what's left to import", () => {
  it('counts what Shopify has, what is here and what is missing, per type', async () => {
    const storeId = await seedStore()
    await seedHistory(storeId)
    const status = await withStore(app, storeId, (tx) =>
      importStatus(tx, { products: 10, customers: 5, collections: 3 }),
    )
    const row = (r: ImportResource) => status.resources.find((x) => x.resource === r)
    expect(row('products')).toMatchObject({
      inShopify: 10,
      countedFrom: 'shopify',
      imported: 8,
      missing: 2,
      state: 'missing',
    })
    expect(row('customers')).toMatchObject({ imported: 5, missing: 0, state: 'done' })
    // Files: Shopify has no count, so the preview's; 2 it could never bring over don't count.
    expect(row('files')).toMatchObject({
      inShopify: 8,
      countedFrom: 'preview',
      imported: 4,
      missing: 2,
      state: 'not_copied',
    })
    expect(row('collections')).toMatchObject({ inShopify: 3, missing: 3, state: 'never' })
    expect(row('orders')).toMatchObject({ inShopify: null, state: 'unknown' })
    // "Here" is images really linked to imported products: none in this seed, so all 20 are missing.
    expect(status.images).toMatchObject({
      expected: 20,
      here: 0,
      missing: 20,
      state: 'not_copied',
    })
    expect(status.remaining.sort()).toEqual(['collections', 'files', 'products'])
    expect(status.lastImportAt).not.toBeNull()
  })

  it('"Import remaining" keeps records not here yet or with an open problem', async () => {
    const storeId = await seedStore()
    await seedHistory(storeId)
    const keep = await withStore(app, storeId, (tx) =>
      remainingFilter(tx, ['products', 'files', 'redirects']),
    )
    expect(keep('products', P(3))).toBe(true) // failed last time
    expect(keep('products', P(4))).toBe(true) // its images failed
    expect(keep('products', P(10))).toBe(true) // never imported
    expect(keep('products', P(1))).toBe(false) // here, no problem
    expect(keep('files', 'gid://shopify/MediaImage/2')).toBe(false)
    expect(keep('redirects', 'path:/old')).toBe(true) // no per-record mapping: rewritten in place
  })

  it('asks Shopify for each count once, leaves out the ones it refuses, and caches them', async () => {
    let calls = 0
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: 'shpat_x',
      sleep: async () => {},
      fetch: fakeFetch((query) => {
        calls++
        const field = /\{\s*(\w+)\(/.exec(query)?.[1] ?? ''
        if (field === 'urlRedirectsCount') {
          return json({ errors: [{ message: "Field 'urlRedirectsCount' doesn't exist" }] })
        }
        return json({ data: { [field]: { count: field === 'productsCount' ? 42 : 7 } } })
      }),
    })
    const counts = await shopifyCounts('store-a', client, 1_000)
    expect(counts.products).toBe(42)
    expect(counts.customers).toBe(7)
    expect(counts.redirects).toBeUndefined()
    const first = calls
    expect(first).toBeGreaterThan(0)
    await shopifyCounts('store-a', client, 2_000)
    expect(calls).toBe(first)
  })

  it('an "Import remaining" run writes only the missing records', async () => {
    const fake = fakeShopify({ customers: 5, orders: 0, products: 0 })
    fake.data.customers[2] = customerNode(3, { createdAt: 'not-a-date' })
    const fetchImpl = fake.wrap(fakeFetch(fake.graphql))
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
    const first = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources: ['customers'], createdBy: null }),
    )
    await executeRun(d, first.id)
    await withStore(app, storeId, (tx) => startRun(tx, first.id))
    await executeRun(d, first.id)
    const before = await owner.select().from(customer)
    expect(before).toHaveLength(4)

    // Fixed in Shopify, and a new shopper since.
    const later = new Date(Date.now() + 5000).toISOString()
    fake.data.customers[2] = customerNode(3, { updatedAt: later })
    fake.data.customers.push(customerNode(6, { updatedAt: later }))
    const run = await withStore(app, storeId, (tx) =>
      createRemainingRun(tx, storeId, { resources: ['customers'], createdBy: null }),
    )
    expect(run).toMatchObject({ onlyMissing: true, dryRun: false })
    await executeRun(d, run.id)
    const [done] = await owner.select().from(importRun).where(eq(importRun.id, run.id))
    expect(done?.status).toBe('completed')
    expect(done?.progress.customers).toMatchObject({ total: 2, created: 2, failed: 0 })
    const after = await owner.select().from(customer)
    expect(after).toHaveLength(6)
    for (const c of before) {
      expect(after.find((a) => a.id === c.id)?.updatedAt).toEqual(c.updatedAt)
    }
    // Nothing left: "Import remaining" refuses an empty list.
    await expect(
      withStore(app, storeId, (tx) =>
        createRemainingRun(tx, storeId, { resources: [], createdBy: null }),
      ),
    ).rejects.toThrow(/already here/)
  })
})

describe('problems grouped by cause', () => {
  it('puts thousands of identical problems on one line with its fix', async () => {
    expect(
      causeOf({
        kind: 'media',
        sourceId: 'x',
        message: "Image a.png was not copied: EACCES: permission denied, mkdir '/repo'",
      }),
    ).toBe('storage')
    expect(
      causeOf({ kind: 'media', sourceId: 'x', message: 'Image a.png was not copied: timeout' }),
    ).toBe('image')
    expect(
      causeOf({
        kind: null,
        sourceId: null,
        message: 'Order number 12 already belongs to an order placed in this store; skipped',
      }),
    ).toBe('order_number')
    const storeId = await seedStore()
    const [run] = await owner
      .insert(importRun)
      .values({ storeId, mode: 'api', resources: ['products'], dryRun: false, status: 'completed' })
      .returning({ id: importRun.id })
    const runId = run?.id as string
    await owner.insert(importIssue).values(
      Array.from({ length: 40 }, (_, i) => ({
        storeId,
        runId,
        resource: 'products',
        sourceId: P(i),
        kind: 'media' as const,
        message: `Image https://cdn/${i}.png was not copied: EACCES: permission denied`,
      })),
    )
    await owner.insert(importIssue).values({
      storeId,
      runId,
      resource: 'products',
      sourceId: P(99),
      kind: 'record',
      message: 'boom',
    })
    const groups = await withStore(app, storeId, (tx) => issueGroups(tx, runId))
    expect(groups).toEqual([
      expect.objectContaining({
        cause: 'storage',
        resources: ['products'],
        count: 40,
        fixHref: '/content/files/storage',
      }),
      expect.objectContaining({ cause: 'record', count: 1, retryable: 1, fixHref: null }),
    ])
  })

  it('counts records to retry, not problems: 77 images across 23 products is 23 to retry', async () => {
    const storeId = await seedStore()
    const [run] = await owner
      .insert(importRun)
      .values({ storeId, mode: 'api', resources: ['products'], dryRun: false, status: 'completed' })
      .returning({ id: importRun.id })
    const runId = run?.id as string
    await owner.insert(importIssue).values(
      Array.from({ length: 77 }, (_, i) => ({
        storeId,
        runId,
        resource: 'products',
        sourceId: P(i % 23),
        kind: 'media' as const,
        message: `Image https://cdn/${i}.png was not copied: file is larger than 10 MB`,
      })),
    )
    const groups = await withStore(app, storeId, (tx) => issueGroups(tx, runId))
    expect(groups).toEqual([
      expect.objectContaining({ cause: 'image', count: 77, retryable: 23, retryableProblems: 77 }),
    ])
  })
})

describe('faster copies', () => {
  it('a shared limiter never runs more than its cap at once', async () => {
    const limit = createLimiter(3)
    let inFlight = 0
    let peak = 0
    await Promise.all(
      Array.from({ length: 12 }, () =>
        limit(async () => {
          inFlight++
          peak = Math.max(peak, inFlight)
          await new Promise((r) => setTimeout(r, 5))
          inFlight--
        }),
      ),
    )
    expect(peak).toBe(3)
  })

  it('caps downloads across every caller; images are stored whole, videos streamed', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    let inFlight = 0
    let peak = 0
    const fetchImpl = (async (input: string | URL | Request) => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 10))
      inFlight--
      if (String(input).endsWith('.mp4')) {
        return new Response(MP4, { headers: { 'content-type': 'video/mp4' } })
      }
      return new Response(PNG, {
        headers: { 'content-type': 'image/png', 'content-length': String(PNG.byteLength) },
      })
    }) as typeof fetch
    const host = createMediaHost({
      storeId,
      inStore: (fn) => withStore(app, storeId, fn),
      storage: async () => storage,
      fetch: fetchImpl,
      lookup: async () => ['93.184.216.34'],
      maxInFlight: 2,
    })
    const ids = await Promise.all(
      Array.from({ length: 8 }, (_, i) => host.host(`https://cdn.shopify.com/${i}.png`, null)),
    )
    expect(ids.every(Boolean)).toBe(true)
    expect(peak).toBe(2)
    // Images (50 MB at most): read whole and stored with one put of their exact length.
    expect(storage.streamed).toHaveLength(0)
    const stored = [...storage.objects.values()].map((o) => o.body.byteLength)
    expect(stored.every((n) => n === PNG.byteLength)).toBe(true)
    // A video streams into the bucket, never held whole.
    await host.host('https://cdn.shopify.com/clip.mp4', null)
    expect(storage.streamed).toHaveLength(1)
    expect([...storage.objects.values()].at(-1)?.body.byteLength).toBe(MP4.byteLength)
  })
})
