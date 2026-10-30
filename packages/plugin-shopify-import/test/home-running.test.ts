/**
 * The importer's home page while an import runs: the history lists running,
 * preview and finished runs alike, and "What's left" says a run is in flight
 * without asking a throttled Shopify for live counts.
 */
import { type StoreTx, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { connect } from '../src/connection'
import { importRun } from '../src/schema'
import { listRuns } from '../src/service'
import { ShopifyClient } from '../src/shopify-client'
import { activeRun, cachedCounts, remainingStatus, shopifyCounts } from '../src/status'
import { fakeShopify } from './fixtures/fake-shopify'
import { app, fakeFetch, json, owner, SECRET, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000)

/** An old CSV import, a finished preview, and a real import running now. */
async function seedRuns(storeId: string) {
  return withStore(app, storeId, async (tx: StoreTx) => {
    await tx.insert(importRun).values({
      storeId,
      mode: 'csv',
      resources: ['products'],
      dryRun: false,
      status: 'completed',
      fileName: 'products.csv',
      createdAt: minutesAgo(600),
      finishedAt: minutesAgo(599),
    })
    await tx.insert(importRun).values({
      storeId,
      mode: 'api',
      resources: ['customers'],
      dryRun: true,
      status: 'completed',
      createdAt: minutesAgo(30),
      finishedAt: minutesAgo(29),
    })
    const [running] = await tx
      .insert(importRun)
      .values({
        storeId,
        mode: 'api',
        resources: ['products', 'customers'],
        dryRun: false,
        status: 'running',
        createdAt: minutesAgo(5),
        startedAt: minutesAgo(4),
      })
      .returning()
    return running?.id as string
  })
}

describe('importer home during a run', () => {
  it('lists running, preview and finished runs, newest first', async () => {
    const storeId = await seedStore()
    const runningId = await seedRuns(storeId)
    const list = await withStore(app, storeId, (tx) => listRuns(tx, { page: 1, perPage: 10 }))
    expect(list.total).toBe(3)
    expect(list.items.map((r) => [r.mode, r.dryRun, r.status])).toEqual([
      ['api', false, 'running'],
      ['api', true, 'completed'],
      ['csv', false, 'completed'],
    ])
    expect(list.items[0]?.id).toBe(runningId)
  })

  it('reports the run in flight, and none once it has ended', async () => {
    const storeId = await seedStore()
    const runningId = await seedRuns(storeId)
    const running = await withStore(app, storeId, (tx) => activeRun(tx))
    expect(running).toMatchObject({ runId: runningId, preview: false, status: 'running' })
    expect(Date.parse(running?.startedAt ?? '')).toBeLessThan(Date.now() - 3 * 60_000)

    await owner.update(importRun).set({ status: 'completed', finishedAt: new Date() })
    expect(await withStore(app, storeId, (tx) => activeRun(tx))).toBeNull()
  })

  it('does not ask Shopify for counts while a run is in flight', async () => {
    const storeId = await seedStore()
    const fake = fakeShopify({ customers: 0, orders: 0, products: 0 })
    let calls = 0
    const fetchImpl = fake.wrap(
      fakeFetch((query, variables) => {
        calls++
        return fake.graphql(query, variables)
      }),
    )
    await withStore(app, storeId, (tx) =>
      connect(
        tx,
        storeId,
        { shopDomain: 'waimers.myshopify.com', accessToken: 'shpat_0123456789abcdef' },
        SECRET,
        fetchImpl,
      ),
    )
    const runningId = await seedRuns(storeId)
    calls = 0
    const status = await withStore(app, storeId, (tx) =>
      remainingStatus(tx, storeId, SECRET, { fetch: fetchImpl }),
    )
    expect(calls).toBe(0)
    expect(status.running?.runId).toBe(runningId)
    // The finished CSV import still counts as the last import.
    expect(status.lastImportAt).not.toBeNull()
  })

  it('marks a run whose worker went silent as failed instead of "in progress" forever', async () => {
    const storeId = await seedStore()
    await seedRuns(storeId)
    await owner.update(importRun).set({ updatedAt: minutesAgo(60) })
    const status = await withStore(app, storeId, (tx) => remainingStatus(tx, storeId, SECRET))
    expect(status.running).toBeNull()
  })
})

describe('shopifyCounts time budget', () => {
  it('stops counting once over budget and does not cache the partial result', async () => {
    let calls = 0
    let clock = 0
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: 'shpat_x',
      sleep: async () => {},
      fetch: fakeFetch((query) => {
        calls++
        // Each count takes "5 seconds" (a throttled Shopify).
        clock += 5_000
        const field = /\{\s*(\w+)\(/.exec(query)?.[1] ?? ''
        return json({ data: { [field]: { count: 1 } } })
      }),
    })
    const opts = { budgetMs: 8_000, clock: () => clock }
    const counts = await shopifyCounts('budget-store', client, 1_000, opts)
    expect(calls).toBe(2)
    expect(Object.keys(counts)).toHaveLength(2)
    expect(cachedCounts('budget-store', 1_000)).toEqual({})
    // Not cached, so the next load asks again.
    clock = 0
    await shopifyCounts('budget-store', client, 2_000, opts)
    expect(calls).toBe(4)
  })
})
