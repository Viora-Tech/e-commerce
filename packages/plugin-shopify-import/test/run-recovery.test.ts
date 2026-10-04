/**
 * A run whose worker died must not stay `running` (or `queued`) forever: the
 * importer's `jobFailed` handler ends it, a run silent for too long is failed
 * on the next read, and Try again queues a fresh job instead of colliding with
 * the failed one BullMQ still holds.
 */
import { type AppJobQueue, enqueueAppJob, isFinalJobFailure } from '@commerce/core'
import { type StoreTx, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { AppHookContext } from '@commerce/plugins'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { shopifyImportPlugin } from '../src/plugin'
import { importRun } from '../src/schema'
import { createApiRun, failRun, getRun, runJobKey, startRun } from '../src/service'
import { app, MemoryStorageProvider, owner, SECRET, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function newRun(slug = 'shop') {
  const storeId = await seedStore(slug)
  const run = await withStore(app, storeId, (tx) =>
    createApiRun(tx, storeId, { resources: ['customers'], createdBy: null }),
  )
  return { storeId, run }
}

/** What the merchant reads on a run whose worker died (`INTERRUPTED_ERROR` in service.ts). */
const INTERRUPTED = expect.stringContaining('stopped unexpectedly')

const setStatus = (id: string, status: 'running' | 'completed', updatedAt = new Date()) =>
  owner.update(importRun).set({ status, updatedAt }).where(eq(importRun.id, id))

const rowOf = async (id: string) =>
  (await owner.select().from(importRun).where(eq(importRun.id, id)))[0]

function appCtx(storeId: string) {
  return {
    storeId,
    inStore: <T>(fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn),
    storage: async () => new MemoryStorageProvider(),
    settingsSecret: SECRET,
    storefrontUrl: null,
    log: () => {},
    notify: async () => ({ sent: 0, errors: [] }),
  } as unknown as AppHookContext
}

describe('a run whose job died', () => {
  it('is marked failed with a plain reason when the job fails for good', async () => {
    const { storeId, run } = await newRun()
    await setStatus(run.id, 'running')
    const onFailed = shopifyImportPlugin.jobFailed?.run
    expect(onFailed).toBeDefined()
    await onFailed?.(appCtx(storeId), { runId: run.id }, 'job stalled more than allowable limit')
    const row = await rowOf(run.id)
    expect(row).toMatchObject({ status: 'failed', error: INTERRUPTED })
    expect(row?.finishedAt).not.toBeNull()
  })

  it('leaves a finished run alone', async () => {
    const { storeId, run } = await newRun()
    await setStatus(run.id, 'completed')
    await shopifyImportPlugin.jobFailed?.run?.(appCtx(storeId), { runId: run.id }, 'late failure')
    expect((await rowOf(run.id))?.status).toBe('completed')
  })

  it('is failed on the next read once it has been silent too long, so Try again works', async () => {
    const { storeId, run } = await newRun()
    await setStatus(run.id, 'running', new Date(Date.now() - 11 * 60 * 1000))
    const read = await withStore(app, storeId, (tx) => getRun(tx, run.id))
    expect(read).toMatchObject({ status: 'failed', error: INTERRUPTED })
    // A run still showing signs of life is left running.
    const fresh = await newRun('other-shop')
    await setStatus(fresh.run.id, 'running')
    const live = await withStore(app, fresh.storeId, (tx) => getRun(tx, fresh.run.id))
    expect(live?.status).toBe('running')
  })

  it('counts a stalled-out job and a spent last attempt as final, an early retry not', () => {
    const stalled = new Error('job stalled more than allowable limit')
    expect(isFinalJobFailure({ attemptsMade: 1, opts: { attempts: 3 } }, stalled)).toBe(true)
    expect(isFinalJobFailure({ attemptsMade: 3, opts: { attempts: 3 } }, new Error('x'))).toBe(true)
    expect(isFinalJobFailure({ attemptsMade: 1, opts: { attempts: 3 } }, new Error('x'))).toBe(
      false,
    )
  })
})

describe('queueing a run again', () => {
  it('Try again gets a new job id; a double click is refused before the queue', async () => {
    const { storeId, run } = await newRun()
    // Like BullMQ: an add whose id is already held (even by a failed job) is ignored.
    const held = new Set<string>()
    const accepted: string[] = []
    const queue: AppJobQueue = {
      async add(_name, _data, opts) {
        const id = opts?.jobId ?? ''
        if (held.has(id)) return
        held.add(id)
        accepted.push(id)
      },
    }
    const enqueue = (row: { id: string; updatedAt: Date }) =>
      enqueueAppJob(
        queue,
        { storeId, pluginId: 'shopify-import', name: 'run', data: { runId: row.id } },
        runJobKey(row),
      )

    await enqueue(run) // the preview
    await withStore(app, storeId, (tx) => failRun(tx, run.id, 'worker died'))
    const retried = await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await enqueue(retried) // Try again
    expect(accepted).toHaveLength(2)
    expect(new Set(accepted).size).toBe(2)

    await expect(withStore(app, storeId, (tx) => startRun(tx, run.id))).rejects.toThrow(
      /already running/,
    )
    expect(accepted).toHaveLength(2)
  })
})
