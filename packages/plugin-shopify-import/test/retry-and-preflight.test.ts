/**
 * "Before you import" checks, the storage write test that turns a broken
 * storage into one problem instead of thousands, and "Retry the ones that were
 * missed": only the records (or images) with problems are read and written
 * again. A fake Admin API only; never calls Shopify.
 */
import { customer, media, product, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { StorageProvider } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ImportResource, ScopeCheck } from '../src/client'
import { connect } from '../src/connection'
import { preflightChecks } from '../src/preflight'
import { executeRun } from '../src/run'
import { saveMapping } from '../src/runtime'
import { importIssue, importRun } from '../src/schema'
import { createApiRun, createRetryRun, getRun, startRun } from '../src/service'
import { customerNode, fakeShopify } from './fixtures/fake-shopify'
import {
  app,
  deps,
  type FetchLog,
  fakeFetch,
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

const ALL_SCOPES: ScopeCheck = {
  shopName: 'Waimers',
  granted: [
    'read_products',
    'read_inventory',
    'read_customers',
    'read_orders',
    'read_all_orders',
    'read_content',
    'read_online_store_navigation',
    'read_files',
    'read_metaobject_definitions',
    'read_metaobjects',
    'read_discounts',
    'read_gift_cards',
  ],
  missing: [],
}

describe('before you import', () => {
  const check = async (
    storeId: string,
    resources: ImportResource[],
    over: Partial<Parameters<typeof preflightChecks>[1]> = {},
  ) =>
    withStore(app, storeId, (tx) =>
      preflightChecks(tx, {
        mode: 'api',
        resources,
        storage: { providerId: 'r2', production: true },
        scopes: ALL_SCOPES,
        ...over,
      }),
    )

  it('warns when images would go to the local folder in production', async () => {
    const storeId = await seedStore()
    const local = await check(storeId, ['products'], {
      storage: { providerId: 'local', production: true },
    })
    expect(local.find((c) => c.id === 'storage')).toMatchObject({
      status: 'warn',
      fixHref: '/content/files/storage',
    })
    expect((await check(storeId, ['products'])).find((c) => c.id === 'storage')?.status).toBe('ok')
    const dev = await check(storeId, ['products'], {
      storage: { providerId: 'local', production: false },
    })
    expect(dev.find((c) => c.id === 'storage')?.status).toBe('ok')
    // Nothing chosen copies images: no storage check at all.
    expect((await check(storeId, ['customers'])).some((c) => c.id === 'storage')).toBe(false)
  })

  it('blocks only the resource whose Shopify scope is missing', async () => {
    const storeId = await seedStore()
    const checks = await check(storeId, ['products', 'files', 'orders'], {
      scopes: {
        ...ALL_SCOPES,
        missing: ['read_files', 'read_all_orders'],
      },
    })
    const blocks = checks.filter((c) => c.status === 'block')
    expect(blocks).toEqual([
      expect.objectContaining({ id: 'scope', resource: 'files', detail: 'read_files' }),
    ])
    expect(checks.find((c) => c.id === 'all_orders')?.status).toBe('warn')
    const broken = await check(storeId, ['customers'], { scopes: { error: 'Shopify said 401' } })
    expect(broken).toEqual([expect.objectContaining({ id: 'connection', status: 'block' })])
    expect(broken[0]?.resource).toBeUndefined()
  })

  it('warns about what the chosen resources depend on, until it is here', async () => {
    const storeId = await seedStore()
    const before = await check(storeId, ['orders', 'gift_cards'])
    expect(before.map((c) => `${c.id}:${c.resource}`).sort()).toEqual([
      'needs_customers:gift_cards',
      'needs_products:orders',
    ])
    const productId = await withStore(app, storeId, async (tx) => {
      const [p] = await tx
        .insert(product)
        .values({ storeId, handle: 'tee', title: 'Tee' })
        .returning({ id: product.id })
      await saveMapping(tx, storeId, 'products', 'gid://shopify/Product/1', p?.id as string)
      return p?.id
    })
    expect(productId).toBeDefined()
    const after = await check(storeId, ['orders'])
    expect(after.some((c) => c.id === 'needs_products')).toBe(false)
  })
})

/** A store connected to the fake Admin API; `failing` image URLs answer 500 until removed. */
async function setup(
  sizes: { customers: number; orders: number; products: number },
  storage: StorageProvider = new MemoryStorageProvider(),
) {
  const fake = fakeShopify(sizes)
  const failing = new Set<string>()
  const log: FetchLog = []
  const inner = fake.wrap(fakeFetch(fake.graphql, log))
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) =>
    failing.has(String(input))
      ? new Response('down', { status: 500 })
      : inner(input, init)) as typeof fetch
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
  const clock = { now: new Date() }
  const d = deps(storeId, storage as MemoryStorageProvider, {
    fetch: fetchImpl,
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))),
    now: () => clock.now,
  })
  /** Preview then Import now, the way the run page does it. */
  const importAll = async (resources: ImportResource[]) => {
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources, createdBy: null }),
    )
    await executeRun(d, run.id)
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)
    return run.id
  }
  const retry = async (runId: string) => {
    const next = await withStore(app, storeId, (tx) => createRetryRun(tx, storeId, runId, null))
    await executeRun(d, next.id)
    return next.id
  }
  return { fake, failing, log, storeId, d, clock, importAll, retry }
}

const issuesOf = (runId: string) =>
  owner.select().from(importIssue).where(eq(importIssue.runId, runId))

const runOf = async (runId: string) =>
  (await owner.select().from(importRun).where(eq(importRun.id, runId)))[0]

describe('storage write test', () => {
  it('records one problem and skips every image when storage cannot be written', async () => {
    const memory = new MemoryStorageProvider()
    const broken: StorageProvider = {
      ...memory,
      id: 'local',
      label: 'Local folder',
      presignUpload: (i) => memory.presignUpload(i),
      publicUrl: (k) => memory.publicUrl(k),
      get: (k) => memory.get(k),
      head: (k) => memory.head(k),
      delete: (k) => memory.delete(k),
      verifyCredentials: () => memory.verifyCredentials(),
      put: async () => {
        throw new Error("EACCES: permission denied, mkdir '/repo/apps/admin'")
      },
    }
    const { fake, importAll } = await setup({ customers: 0, orders: 0, products: 3 }, broken)
    fake.data.products.forEach((p, i) => {
      p.media = {
        nodes: [1, 2].map((n) => ({
          id: `gid://shopify/MediaImage/${i}${n}`,
          alt: null,
          image: { url: `https://cdn.shopify.com/p${i}-${n}.png`, altText: null },
        })),
      }
    })
    const runId = await importAll(['products'])
    const run = await runOf(runId)
    expect(run?.status).toBe('completed')
    expect(run?.progress.products).toMatchObject({ created: 3, failed: 0 })
    const issues = await issuesOf(runId)
    expect(issues).toHaveLength(1)
    expect(issues[0]?.message).toMatch(/^Storage isn't writable: EACCES/)
    expect(await owner.select().from(media)).toHaveLength(0)
  })
})

describe('retry only what was missed', () => {
  it('retries only the failed records, from the import copy plus what changed', async () => {
    const { fake, storeId, importAll, retry } = await setup({
      customers: 5,
      orders: 0,
      products: 0,
    })
    fake.data.customers[2] = customerNode(3, { createdAt: 'not-a-date' })
    const first = await importAll(['customers'])
    expect((await runOf(first))?.progress.customers).toMatchObject({ created: 4, failed: 1 })
    const read = await withStore(app, storeId, (tx) => getRun(tx, first))
    expect(read?.retryable).toBe(1)
    const [missed] = await issuesOf(first)
    expect(missed).toMatchObject({ sourceId: 'gid://shopify/Customer/3', kind: 'record' })
    const untouched = await owner.select().from(customer)

    // Fixed in Shopify; the retry reads the import's copy and only "changed since".
    fake.data.customers[2] = customerNode(3, {
      updatedAt: new Date(Date.now() + 5000).toISOString(),
    })
    fake.calls.length = 0
    const second = await retry(first)
    const run = await runOf(second)
    expect(run).toMatchObject({ status: 'completed', retryOf: first, resources: ['customers'] })
    expect(run?.progress.customers).toMatchObject({ total: 1, created: 1, failed: 0 })
    expect(await issuesOf(second)).toEqual([])
    expect(fake.calls.some((c) => c.op.startsWith('bulk:'))).toBe(false)
    expect(fake.calls.filter((c) => c.op === 'Customers').every((c) => c.search)).toBe(true)
    // The other four were not written again.
    const after = await owner.select().from(customer)
    expect(after).toHaveLength(5)
    for (const c of untouched) {
      expect(after.find((a) => a.id === c.id)?.updatedAt).toEqual(c.updatedAt)
    }
    // The first run keeps its report.
    expect(await issuesOf(first)).toHaveLength(1)
  })

  it('asks Shopify for only those ids when the copy is too old', async () => {
    const { fake, clock, importAll, retry } = await setup({
      customers: 5,
      orders: 0,
      products: 0,
    })
    fake.data.customers[3] = customerNode(4, { createdAt: 'not-a-date' })
    const first = await importAll(['customers'])
    fake.data.customers[3] = customerNode(4)
    clock.now = new Date(clock.now.getTime() + 25 * 60 * 60 * 1000)
    fake.calls.length = 0
    const second = await retry(first)
    expect((await runOf(second))?.progress.customers).toMatchObject({ total: 1, created: 1 })
    expect(fake.calls).toEqual([{ op: 'Customers', search: 'id:4' }])
  })

  it('re-copies only the images that failed', async () => {
    const { fake, failing, log, importAll, retry } = await setup({
      customers: 0,
      orders: 0,
      products: 2,
    })
    const url = (n: number) => `https://cdn.shopify.com/tee-${n}.png`
    const tee = fake.data.products[0]
    if (!tee) throw new Error('fixture')
    tee.media = {
      nodes: [1, 2].map((n) => ({
        id: `gid://shopify/MediaImage/${n}`,
        alt: null,
        image: { url: url(n), altText: null },
      })),
    }
    failing.add(url(2))
    const first = await importAll(['products'])
    const issues = await issuesOf(first)
    expect(issues).toEqual([
      expect.objectContaining({ kind: 'media', sourceId: 'gid://shopify/Product/1' }),
    ])
    expect(await owner.select().from(media)).toHaveLength(1)

    failing.clear()
    log.length = 0
    const second = await retry(first)
    expect((await runOf(second))?.progress.products).toMatchObject({ total: 1, updated: 1 })
    expect(await issuesOf(second)).toEqual([])
    const downloads = log.filter((l) => l.url.startsWith('https://cdn.shopify.com/'))
    expect(downloads.map((l) => l.url)).toEqual([url(2)])
    expect(await owner.select().from(media)).toHaveLength(2)
  })
})
