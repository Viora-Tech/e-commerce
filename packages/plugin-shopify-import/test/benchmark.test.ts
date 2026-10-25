/**
 * Import timing on a mid-sized store: 2,000 customers, 500 orders and 20
 * products behind a fake Admin API whose bulk exports take `BULK_DELAY_MS`
 * each (Shopify takes a while to prepare a real export). Prints how long the
 * preview and the import that follows take. Skipped unless asked for:
 *
 *   SHOPIFY_IMPORT_BENCH=1 TEST_DB_NAMESPACE=shopifysnap bunx vitest run test/benchmark.test.ts
 *
 * Only public entry points are used, so the same file times older code too.
 */
import { customer, order, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../src/connection'
import { executeRun } from '../src/run'
import { importRun } from '../src/schema'
import { createApiRun, startRun } from '../src/service'
import { fakeShopify } from './fixtures/fake-shopify'
import { app, deps, fakeFetch, MemoryStorageProvider, owner, SECRET, seedStore } from './helpers'

const BULK_DELAY_MS = Number(process.env.SHOPIFY_IMPORT_BENCH_DELAY_MS ?? 2000)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe.skipIf(!process.env.SHOPIFY_IMPORT_BENCH)('import benchmark', () => {
  it('times a preview and the import after it', { timeout: 600_000 }, async () => {
    const fake = fakeShopify({ customers: 2000, orders: 500, products: 20 })
    fake.state.bulkDelayMs = BULK_DELAY_MS
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
      sleep: (ms) => new Promise((r) => setTimeout(r, Math.min(ms, 25))),
    })
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, {
        resources: ['products', 'customers', 'orders'],
        createdBy: null,
      }),
    )
    let t = performance.now()
    await executeRun(d, run.id)
    const previewMs = performance.now() - t
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    t = performance.now()
    await executeRun(d, run.id)
    const importMs = performance.now() - t

    const [row] = await owner.select().from(importRun).where(eq(importRun.id, run.id))
    expect(row?.status).toBe('completed')
    expect(await owner.select().from(customer)).toHaveLength(2000)
    expect(await owner.select().from(order)).toHaveLength(500)
    const bulk = fake.calls.filter((c) => c.op.startsWith('bulk:')).length
    process.stderr.write(
      `[bench] bulk delay ${BULK_DELAY_MS} ms/export, preview ${(previewMs / 1000).toFixed(1)} s, import ${(importMs / 1000).toFixed(1)} s, bulk exports ${bulk}\n`,
    )
  })
})
