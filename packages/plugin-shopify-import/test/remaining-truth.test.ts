/**
 * Issue #272: "What's left to import" must tell the truth. Shopify's number unknown
 * plus nothing (or less) here is never Done; Files and Product images count what
 * Shopify has from the preview's kept copy or the last full import, and what is
 * here from stored files and linked images; imports from before issue keys
 * (migration 0087, `source_id` NULL) still show as not copied; and the Copy button
 * (an "Import remaining" of that type) copies only what is missing, matching by
 * Shopify id and source URL so nothing is downloaded twice. A fake Admin API only.
 */
import { media, product, productMedia, type StoreTx, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { type ImportResource, type ImportStatus, SNAPSHOT_FORMAT } from '../src/client'
import { connect } from '../src/connection'
import { createMediaHost } from '../src/media'
import { executeRun } from '../src/run'
import { saveMappings } from '../src/runtime'
import { importIssue, importMapping, importRun } from '../src/schema'
import { createApiRun, createRemainingRun, startRun } from '../src/service'
import { importStatus } from '../src/status'
import { fakeShopify, productNode } from './fixtures/fake-shopify'
import {
  app,
  deps,
  type FetchLog,
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

const LOCAL = '00000000-0000-4000-8000-000000000001'
const row = (status: ImportStatus, r: ImportResource) =>
  status.resources.find((x) => x.resource === r)
const statusOf = (storeId: string) => withStore(app, storeId, (tx) => importStatus(tx, {}))
const progress = (
  p: Partial<{ total: number; created: number; skipped: number; failed: number }>,
) => ({
  total: 0,
  processed: p.total ?? 0,
  created: 0,
  updated: 0,
  skipped: 0,
  failed: 0,
  ...p,
})

describe("what's left to import tells the truth", () => {
  it('an import from before issue keys: files and images read not copied, never Done', async () => {
    const storeId = await seedStore()
    await withStore(app, storeId, async (tx: StoreTx) => {
      // The preview was started, so its row became the import: only the import's totals are left.
      const [run] = await tx
        .insert(importRun)
        .values({
          storeId,
          mode: 'api',
          resources: ['products', 'collections', 'files'],
          dryRun: false,
          status: 'completed',
          finishedAt: new Date(),
          progress: {
            products: progress({ total: 3, created: 3 }),
            collections: progress({ total: 2, created: 2 }),
            files: {
              ...progress({ total: 6, skipped: 1, failed: 5 }),
              left: [{ reason: 'file_type', count: 1, detail: 'PDF' }],
            },
          },
        })
        .returning({ id: importRun.id })
      const runId = run?.id as string
      // Recorded before migration 0087: no record key, no kind.
      await tx.insert(importIssue).values([
        ...Array.from({ length: 5 }, (_, i) => ({
          storeId,
          runId,
          resource: 'files',
          ref: `big-${i}.png`,
          message: 'Not copied: file is larger than 10 MB',
        })),
        ...Array.from({ length: 4 }, (_, i) => ({
          storeId,
          runId,
          resource: 'products',
          ref: 'product-1',
          message: `Image https://cdn.shopify.com/p1-${i}.png was not copied: file is larger than 10 MB`,
        })),
      ])
      await saveMappings(
        tx,
        storeId,
        'products',
        [1, 2, 3].map((n) => ({ sourceId: `gid://shopify/Product/${n}`, localId: LOCAL })),
      )
      await saveMappings(
        tx,
        storeId,
        'collections',
        [1, 2].map((n) => ({ sourceId: `gid://shopify/Collection/${n}`, localId: LOCAL })),
      )
    })

    const status = await statusOf(storeId)
    expect(row(status, 'files')).toMatchObject({
      inShopify: 6,
      countedFrom: 'import',
      imported: 0,
      missing: 5,
      state: 'not_copied',
    })
    expect(row(status, 'products')).toMatchObject({ inShopify: 3, imported: 3, state: 'done' })
    // No count of images on that import: what is here plus what it could not copy, at least.
    expect(status.images).toMatchObject({ expected: 4, here: 0, missing: 4, state: 'not_copied' })
    expect(status.remaining).toEqual(['products', 'files'])
  })

  it("Shopify's number unknown and nothing here: Not checked yet, never Done", async () => {
    const storeId = await seedStore()
    await owner.insert(importRun).values({
      storeId,
      mode: 'api',
      resources: ['files'],
      dryRun: false,
      status: 'completed',
      finishedAt: new Date(),
    })
    const status = await statusOf(storeId)
    expect(row(status, 'files')).toMatchObject({ inShopify: null, imported: 0, state: 'unknown' })
    expect(status.images).toMatchObject({ expected: null, state: 'unknown' })
    expect(status.remaining).toEqual([])
  })

  it("counts from the preview's kept copy when the latest run only imported what was missing", async () => {
    const storeId = await seedStore()
    await owner.insert(importRun).values({
      storeId,
      mode: 'api',
      resources: ['files'],
      dryRun: false,
      onlyMissing: true,
      status: 'completed',
      finishedAt: new Date(),
      progress: { files: progress({ total: 2, created: 2 }) },
      snapshot: {
        takenAt: new Date().toISOString(),
        format: SNAPSHOT_FORMAT,
        streams: { files: { key: 'stores/x/private/imports/y/snapshot/files.jsonl.gz', count: 9 } },
      },
    })
    const status = await statusOf(storeId)
    expect(row(status, 'files')).toMatchObject({
      inShopify: 9,
      countedFrom: 'preview',
      imported: 0,
      missing: 9,
      state: 'not_copied',
    })
  })
})

const cost = {
  requestedQueryCost: 10,
  throttleStatus: { maximumAvailable: 20000, currentlyAvailable: 19000, restoreRate: 1000 },
}

const fileNode = (n: number) => ({
  __typename: 'MediaImage',
  id: `gid://shopify/MediaImage/${n}`,
  alt: null,
  fileStatus: 'READY',
  mimeType: 'image/png',
  image: { url: `https://cdn.shopify.com/files/f${n}.png?v=1` },
  originalSource: { fileSize: 100 },
})

const imageNode = (p: number, i: number) => ({
  id: `gid://shopify/MediaImage/${p * 100 + i}`,
  alt: null,
  image: { url: `https://cdn.shopify.com/products/p${p}-${i}.png?v=1`, altText: null },
})

/**
 * A store with 2 products of 2 images each and 3 files. While `broken.on`, every
 * CDN download answers 404 (what a too-large file used to be: not copied).
 */
async function storeWithShopify() {
  const fake = fakeShopify({ customers: 0, orders: 0, products: 2 })
  fake.data.products = [1, 2].map((p) =>
    productNode(p, { media: { nodes: [imageNode(p, 1), imageNode(p, 2)] } }),
  )
  const files = [1, 2, 3].map(fileNode)
  const graphql = (query: string, variables: Record<string, unknown>) =>
    query.includes('query Files(')
      ? json({
          data: { files: { pageInfo: { hasNextPage: false, endCursor: null }, nodes: files } },
          extensions: { cost },
        })
      : fake.graphql(query, variables)
  const log: FetchLog = []
  const broken = { on: true }
  const inner = fakeFetch(graphql, log)
  const fetchImpl = fake.wrap((async (input: string | URL | Request, init?: RequestInit) => {
    if (broken.on && String(input).startsWith('https://cdn.shopify.com/')) {
      return new Response('too large', { status: 404 })
    }
    return inner(input, init)
  }) as typeof fetch)
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
  const storage = new MemoryStorageProvider()
  const d = deps(storeId, storage, {
    fetch: fetchImpl,
    sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 10))),
  })
  const downloads = () => log.filter((l) => l.url.startsWith('https://cdn.shopify.com/')).length
  /** Preview, then import it, the way the admin does; then forget issue keys (an older import). */
  const firstImport = async (resources: ImportResource[]) => {
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources, createdBy: null }),
    )
    await executeRun(d, run.id)
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)
    await owner.update(importIssue).set({ sourceId: null, kind: null })
    return run.id
  }
  const copy = async (resources: ImportResource[]) => {
    const run = await withStore(app, storeId, (tx) =>
      createRemainingRun(tx, storeId, { resources, createdBy: null }),
    )
    await executeRun(d, run.id)
    const [done] = await owner.select().from(importRun).where(eq(importRun.id, run.id))
    expect(done?.status).toBe('completed')
  }
  return { storeId, broken, downloads, firstImport, copy, storage }
}

describe('the Copy buttons copy only what is missing', () => {
  it('Copy images: copies the 4 product images the import missed, then nothing again', async () => {
    const s = await storeWithShopify()
    await s.firstImport(['products'])
    expect(await owner.select().from(product)).toHaveLength(2)
    expect(await owner.select().from(productMedia)).toHaveLength(0)

    let status = await statusOf(s.storeId)
    // The import counted the images its products carry, so Shopify's number is known.
    expect(status.images).toMatchObject({
      expected: 4,
      here: 0,
      missing: 4,
      countedFrom: 'import',
      state: 'not_copied',
    })
    expect(status.remaining).toContain('products')

    s.broken.on = false
    const before = s.downloads()
    await s.copy(['products'])
    expect(s.downloads() - before).toBe(4)
    expect(await owner.select().from(productMedia)).toHaveLength(4)
    expect(await owner.select().from(media)).toHaveLength(4)
    expect(await owner.select().from(product)).toHaveLength(2)
    status = await statusOf(s.storeId)
    expect(status.images).toMatchObject({ expected: 4, here: 4, missing: 0, state: 'done' })
    expect(status.remaining).not.toContain('products')

    // Pressed again: everything is here, so nothing is read twice or duplicated.
    const again = s.downloads()
    await s.copy(['products'])
    expect(s.downloads()).toBe(again)
    expect(await owner.select().from(productMedia)).toHaveLength(4)
    expect(await owner.select().from(media)).toHaveLength(4)
  })

  it('Copy files: copies the files not here, reusing one already stored from the same URL', async () => {
    const s = await storeWithShopify()
    await s.firstImport(['files'])
    let status = await statusOf(s.storeId)
    // Something was missed, so the import kept the preview's copy (for a retry): counted from it.
    expect(row(status, 'files')).toMatchObject({
      inShopify: 3,
      countedFrom: 'preview',
      imported: 0,
      missing: 3,
      state: 'not_copied',
    })

    s.broken.on = false
    // The same picture already came over with something else (by its source URL).
    const host = createMediaHost({
      storeId: s.storeId,
      inStore: (fn) => withStore(app, s.storeId, fn),
      storage: async () => s.storage,
      fetch: fakeFetch(() => json({})),
      lookup: async () => ['93.184.216.34'],
    })
    await host.host('https://cdn.shopify.com/files/f2.png?v=1', null)

    const before = s.downloads()
    await s.copy(['files'])
    // f1 and f3 downloaded; f2 matched by URL, not downloaded again.
    expect(s.downloads() - before).toBe(2)
    expect(await owner.select().from(media)).toHaveLength(3)
    const mapped = await owner
      .select()
      .from(importMapping)
      .where(eq(importMapping.resource, 'files'))
    expect(mapped).toHaveLength(3)
    status = await statusOf(s.storeId)
    expect(row(status, 'files')).toMatchObject({ imported: 3, missing: 0, state: 'done' })

    const again = s.downloads()
    await s.copy(['files'])
    expect(s.downloads()).toBe(again)
    expect(await owner.select().from(media)).toHaveLength(3)
  })
})
