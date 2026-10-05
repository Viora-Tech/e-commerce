/**
 * Stop import (issue #274): a waiting import is cancelled and its job taken off the
 * queue; a running one stops between batches with its copies aborted; one whose
 * worker never answers is marked stopped after a minute, and its job does nothing
 * if it ever wakes. What was imported stays, and Run again works after a stop.
 * A fake Admin API only.
 */
import { removeAppJob } from '@commerce/core'
import { product, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { SHOPIFY_IMPORT_ID } from '../src/client'
import { connect } from '../src/connection'
import { executeRun } from '../src/run'
import { importRun } from '../src/schema'
import { createApiRun, getRun, listRuns, requestStop, runJobKey, startRun } from '../src/service'
import { fakeShopify, productNode } from './fixtures/fake-shopify'
import { app, deps, fakeFetch, MemoryStorageProvider, owner, SECRET, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const runOf = async (id: string) =>
  (await owner.select().from(importRun).where(eq(importRun.id, id)))[0]

describe('Stop import', () => {
  it('a waiting import is cancelled at once and its job taken off the queue', async () => {
    const storeId = await seedStore()
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources: ['products'], createdBy: null }),
    )
    const { run: stopped, jobKey } = await withStore(app, storeId, (tx) =>
      requestStop(tx, run.id, 'Asha'),
    )
    expect(stopped).toMatchObject({ status: 'cancelled', stoppedBy: 'Asha' })
    expect(stopped.finishedAt).not.toBeNull()
    expect(jobKey).toBe(runJobKey(run))

    const removed: string[] = []
    const queue = {
      add: async () => {},
      remove: async (id: string) => {
        removed.push(id)
        return 1
      },
    }
    expect(await removeAppJob(queue, { storeId, pluginId: SHOPIFY_IMPORT_ID }, jobKey ?? '')).toBe(
      true,
    )
    // The id `enqueueAppJob` gave the job: store, app, key (its ':' made '-').
    expect(removed).toEqual([
      `${storeId}:${SHOPIFY_IMPORT_ID}:${runJobKey(run).replace(/:/g, '-')}`,
    ])

    // A job that slipped through anyway does nothing.
    await executeRun(deps(storeId, new MemoryStorageProvider()), run.id)
    expect(await runOf(run.id)).toMatchObject({ status: 'cancelled', progress: {} })
    // A finished or stopped import cannot be stopped again.
    await expect(withStore(app, storeId, (tx) => requestStop(tx, run.id, 'Asha'))).rejects.toThrow(
      /not running/,
    )
  })

  it('a running import stops between batches and its copies are aborted', async () => {
    const fake = fakeShopify({ customers: 0, orders: 0, products: 60 })
    fake.data.products = Array.from({ length: 60 }, (_, i) =>
      productNode(i + 1, {
        media: {
          nodes: [
            {
              id: `gid://shopify/MediaImage/${i + 1}`,
              alt: null,
              image: { url: `https://cdn.shopify.com/slow/${i + 1}.png`, altText: null },
            },
          ],
        },
      }),
    )
    let aborted = 0
    let started = 0
    const inner = fakeFetch(fake.graphql)
    const fetchImpl = fake.wrap((async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input).startsWith('https://cdn.shopify.com/slow/')) {
        started++
        // A copy that never finishes on its own: only the stop ends it.
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            aborted++
            reject(init.signal?.reason)
          })
        })
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
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources: ['products'], createdBy: null }),
    )
    const d = deps(storeId, new MemoryStorageProvider(), {
      fetch: fetchImpl,
      sleep: async () => {},
      stopPollMs: 20,
    })
    // Preview (copies nothing), then the real import.
    await executeRun(d, run.id)
    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    const running = executeRun(d, run.id)
    // Wait until the first batch's copies are in flight.
    for (let i = 0; i < 200 && started === 0; i++) await new Promise((r) => setTimeout(r, 10))
    expect(started).toBeGreaterThan(0)
    expect((await runOf(run.id))?.status).toBe('running')

    const { run: asked } = await withStore(app, storeId, (tx) => requestStop(tx, run.id, 'Asha'))
    expect(asked.status).toBe('running')
    expect(asked.stopRequestedAt).not.toBeNull()
    await running
    const done = await runOf(run.id)
    expect(done).toMatchObject({ status: 'cancelled', stoppedBy: 'Asha', error: null })
    expect(done?.finishedAt).not.toBeNull()
    expect(aborted).toBeGreaterThan(0)
    // Let the batch that was copying unwind; nothing after it is written.
    await new Promise((r) => setTimeout(r, 300))
    expect((await owner.select().from(product)).length).toBeLessThanOrEqual(25)
    expect((await runOf(run.id))?.status).toBe('cancelled')

    // Run again works after a stop.
    const again = await withStore(app, storeId, (tx) => startRun(tx, run.id))
    expect(again).toMatchObject({ status: 'queued', stopRequestedAt: null, stoppedBy: null })
  })

  it('a hung worker: marked stopped after a minute, and its job does nothing if it wakes', async () => {
    const storeId = await seedStore()
    const [run] = await owner
      .insert(importRun)
      .values({
        storeId,
        mode: 'api',
        resources: ['products'],
        dryRun: false,
        status: 'running',
        startedAt: new Date(),
        // The worker keeps touching the row, but never acknowledges the stop.
        updatedAt: new Date(),
        // Asked more than a minute ago (STOP_GRACE_MS in service.ts).
        stopRequestedAt: new Date(Date.now() - 61_000),
        stoppedBy: 'Asha',
      })
      .returning()
    const id = run?.id as string
    const read = await withStore(app, storeId, (tx) => getRun(tx, id))
    expect(read).toMatchObject({ status: 'cancelled', stoppedBy: 'Asha' })
    const list = await withStore(app, storeId, (tx) => listRuns(tx, { page: 1, perPage: 10 }))
    expect(list.items[0]).toMatchObject({ status: 'cancelled', stoppedBy: 'Asha' })

    await executeRun(deps(storeId, new MemoryStorageProvider()), id)
    expect(await runOf(id)).toMatchObject({ status: 'cancelled', progress: {} })

    // A stop asked only a moment ago is left to the worker.
    const [fresh] = await owner
      .insert(importRun)
      .values({
        storeId,
        mode: 'api',
        resources: ['products'],
        dryRun: false,
        status: 'running',
        stopRequestedAt: new Date(),
      })
      .returning()
    expect(await withStore(app, storeId, (tx) => getRun(tx, fresh?.id as string))).toMatchObject({
      status: 'running',
    })
  })
})
