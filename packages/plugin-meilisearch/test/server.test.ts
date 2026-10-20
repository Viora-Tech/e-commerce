import { encryptSecret } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { describe, expect, it } from 'vitest'
import { COOL_OFF_MS, meilisearchEngine, syncProducts } from '../src/server'
import { MEILISEARCH_ID } from '../src/settings'

const SECRET = 'test-only-settings-secret-0123456789abcdef'
const STORE = '0b0f6c1e-1d2a-4b8e-9c3f-5a6b7c8d9e0f'
const env = { secret: SECRET, trustedOrigins: ['http://meili.test'] }

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * Just enough of a store transaction: `store.apps` for the select/update chains, product rows
 * for `execute`. Records what was written back to `store.apps`.
 */
function fakeTx(apps: Record<string, unknown>, products: Record<string, unknown>[] = []) {
  const state = { apps, executed: 0 }
  const rows = () => Promise.resolve([{ apps: state.apps }])
  const where = () => Object.assign(rows(), { for: rows })
  const tx = {
    select: () => ({ from: () => ({ where }) }),
    update: () => ({
      set: (v: { apps: Record<string, unknown> }) => ({
        where: async () => {
          state.apps = v.apps
        },
      }),
    }),
    execute: async () => {
      state.executed += 1
      return products
    },
  }
  return { tx: tx as unknown as StoreTx, state }
}

const entry = (settings: Record<string, unknown>, installed = [MEILISEARCH_ID]) => ({
  installed,
  settings: {
    [MEILISEARCH_ID]: {
      host: 'http://meili.test',
      adminKey: encryptSecret('admin-key', SECRET),
      searchKey: encryptSecret('search-key', SECRET),
      ...settings,
    },
  },
})

const signal = new AbortController().signal

describe('meilisearchEngine', () => {
  it('asks Meilisearch with the search-only key once the store is indexed', async () => {
    const calls: { url: string; auth: string }[] = []
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      calls.push({
        url: String(input),
        auth: (init?.headers as Record<string, string> | undefined)?.authorization ?? '',
      })
      return json({ hits: [{ id: 'p2' }, { id: 'p1' }] })
    }) as typeof globalThis.fetch
    const engine = meilisearchEngine(env, { fetch })
    const { tx } = fakeTx(entry({ lastSyncAt: '2026-10-20T00:00:00.000Z' }))
    expect(await engine({ tx, storeId: STORE, query: 'tshrit', limit: 10, signal })).toEqual([
      'p2',
      'p1',
    ])
    expect(calls[0]?.url).toBe(`http://meili.test/indexes/products_${STORE}/search`)
    expect(calls[0]?.auth).toBe('Bearer search-key')
  })

  it('stays out of the way until installed, connected and indexed', async () => {
    const fetch = (async () => json({ hits: [] })) as typeof globalThis.fetch
    const engine = meilisearchEngine(env, { fetch })
    const never = fakeTx(entry({}))
    expect(await engine({ tx: never.tx, storeId: STORE, query: 'q', limit: 5, signal })).toBeNull()
    const removed = fakeTx(entry({ lastSyncAt: '2026-10-20T00:00:00.000Z' }, []))
    expect(
      await engine({ tx: removed.tx, storeId: STORE, query: 'q', limit: 5, signal }),
    ).toBeNull()
  })

  it('cools off after a failure so the SQL search answers at once', async () => {
    let calls = 0
    let now = 1_000_000
    const fetch = (async () => {
      calls += 1
      throw new TypeError('connect ECONNREFUSED')
    }) as typeof globalThis.fetch
    const engine = meilisearchEngine(env, { fetch, now: () => now })
    const { tx } = fakeTx(entry({ lastSyncAt: '2026-10-20T00:00:00.000Z' }))
    const ask = () => engine({ tx, storeId: STORE, query: 'q', limit: 5, signal })
    await expect(ask()).rejects.toMatchObject({ code: 'unreachable' })
    expect(await ask()).toBeNull()
    expect(calls).toBe(1)
    now += COOL_OFF_MS + 1
    await expect(ask()).rejects.toMatchObject({ code: 'unreachable' })
    expect(calls).toBe(2)
  })
})

describe('syncProducts', () => {
  const product = {
    id: 'p1',
    handle: 'tee',
    title: 'Tee',
    vendor: null,
    product_type: null,
    tags: [],
    description: null,
    created_at: '2026-10-01T00:00:00Z',
    skus: null,
    option_values: null,
    collections: null,
    min_price: 100,
    max_price: 100,
    available: true,
    image: null,
  }

  it('upserts products still searchable and deletes the rest', async () => {
    const sent: { path: string; body: unknown }[] = []
    const fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      sent.push({ path: new URL(String(input)).pathname, body: JSON.parse(String(init?.body)) })
      return json({ taskUid: sent.length }, 202)
    }) as typeof globalThis.fetch
    const { tx, state } = fakeTx(entry({ lastSyncAt: '2026-10-19T00:00:00.000Z' }), [product])
    const result = await syncProducts({
      storeId: STORE,
      inStore: (fn) => fn(tx),
      env,
      productIds: ['p1', 'gone'],
      fetch,
    })
    expect(result).toEqual({ upserted: 1, deleted: 1 })
    expect(sent.map((s) => s.path)).toEqual([
      `/indexes/products_${STORE}/documents`,
      `/indexes/products_${STORE}/documents/delete-batch`,
    ])
    expect(sent[1]?.body).toEqual(['gone'])
    const saved = (state.apps.settings as Record<string, { lastSyncAt: string }>)[MEILISEARCH_ID]
    expect(saved?.lastSyncAt).not.toBe('2026-10-19T00:00:00.000Z')
  })

  it('waits for the first full reindex', async () => {
    const fetch = (async () => json({ taskUid: 1 })) as typeof globalThis.fetch
    const { tx, state } = fakeTx(entry({}), [product])
    expect(
      await syncProducts({
        storeId: STORE,
        inStore: (fn) => fn(tx),
        env,
        productIds: ['p1'],
        fetch,
      }),
    ).toBeNull()
    expect(state.executed).toBe(0)
  })

  it('records the failure and rethrows so the job retries', async () => {
    const fetch = (async () => json({ message: 'down' }, 503)) as typeof globalThis.fetch
    const { tx, state } = fakeTx(entry({ lastSyncAt: '2026-10-19T00:00:00.000Z' }), [product])
    await expect(
      syncProducts({ storeId: STORE, inStore: (fn) => fn(tx), env, productIds: ['p1'], fetch }),
    ).rejects.toMatchObject({ code: 'unreachable' })
    const saved = (state.apps.settings as Record<string, { lastError: string }>)[MEILISEARCH_ID]
    expect(saved?.lastError).toContain('Could not reach Meilisearch')
  })
})
