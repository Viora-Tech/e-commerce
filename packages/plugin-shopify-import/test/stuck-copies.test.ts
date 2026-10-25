/**
 * A copy that hangs must never hang the import (production, 2026-10-05: one stuck
 * download per slot and the products step waited forever with `progress` `{}`).
 * Each copy times out into an issue and the run goes on; a run where nothing moves
 * at all is stopped by its watchdog instead of being kept alive by its heartbeat.
 */
import { media, product, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { executeRun, type RunDeps } from '../src/run'
import { importIssue, importRun } from '../src/schema'
import { createCsvRun, startRun } from '../src/service'
import { app, deps, fixture, json, MemoryStorageProvider, owner, PNG, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** Sends the first few bytes of a PNG, then nothing, ever. */
function stalledPng(): Response {
  let sent = false
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (sent) return new Promise(() => {})
      sent = true
      controller.enqueue(PNG.subarray(0, 8))
    },
  })
  return new Response(body, { headers: { 'content-type': 'image/png' } })
}

/** Images from the products fixture; the ones `stuck` names never finish downloading. */
function images(stuck: (url: string) => boolean): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input)
    if (url.endsWith('/graphql.json')) return json({ data: {} })
    if (stuck(url)) return stalledPng()
    return new Response(PNG, { headers: { 'content-type': 'image/png' } })
  }) as typeof fetch
}

/** A products CSV run, previewed and started the way the admin does; returns its id. */
async function importProducts(storeId: string, storage: MemoryStorageProvider, d: RunDeps) {
  const run = await withStore(app, storeId, (tx) =>
    createCsvRun(tx, storeId, storage, {
      resource: 'products',
      fileName: 'products.csv',
      csv: fixture('products.csv'),
      createdBy: 'owner@example.com',
    }),
  )
  await executeRun(d, run.id) // the preview downloads nothing
  await withStore(app, storeId, (tx) => startRun(tx, run.id))
  return run.id
}

const rowOf = async (id: string) =>
  (await owner.select().from(importRun).where(eq(importRun.id, id)))[0]

describe('copies that hang', () => {
  it('a download that never finishes becomes an issue and the import completes', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const d = deps(storeId, storage, {
      fetch: images((url) => url.includes('viper-side')),
      sleep: async () => {},
      copy: { idleTimeoutMs: 50, retries: 1 },
    })
    const runId = await importProducts(storeId, storage, d)
    await executeRun(d, runId)

    const run = await rowOf(runId)
    expect(run?.status).toBe('completed')
    expect(run?.progress.products).toMatchObject({ created: 2, failed: 0, copied: 4, notCopied: 1 })
    expect(await owner.select().from(product)).toHaveLength(2)
    expect(await owner.select().from(media)).toHaveLength(4)
    const issues = await owner.select().from(importIssue).where(eq(importIssue.runId, runId))
    const missed = issues.filter((i) => i.message.includes('viper-side'))
    expect(missed).toHaveLength(1)
    expect(missed[0]?.message).toMatch(
      /not copied: timed out: no data for 0\.05 s \(tried 2 times\)/,
    )
    // Carries the product's key, so "Retry the ones that were missed" picks it up.
    expect(missed[0]?.sourceId).toBe('handle:viper-mouse')
  })

  it('a run where nothing moves is stopped by its watchdog, not kept alive by the heartbeat', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const d = deps(storeId, storage, {
      fetch: images(() => true),
      sleep: async () => {},
      // Copies that would wait (almost) forever on their own.
      copy: { timeoutMs: 1e9, idleTimeoutMs: 1e9 },
      stuckMs: 300,
      heartbeatMs: 50,
    })
    const runId = await importProducts(storeId, storage, d)
    const started = Date.now()
    await executeRun(d, runId)
    expect(Date.now() - started).toBeLessThan(10_000)

    const run = await rowOf(runId)
    expect(run?.status).toBe('failed')
    expect(run?.error).toMatch(/stopped moving/)
    expect(run?.finishedAt).not.toBeNull()
  })
})
