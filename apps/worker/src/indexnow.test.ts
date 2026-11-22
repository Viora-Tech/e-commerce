/** IndexNow sweep: first run only sets the cursor, then one batched POST of changed and deleted paths per store. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = '0123456789abcdef0123456789abcdef'

const state = {
  host: 'www.shop.in' as string | null,
  key: KEY as string | null,
  changed: [] as string[],
  since: [] as Date[],
}

vi.mock('@commerce/db', () => ({
  withStore: async (_db: unknown, _storeId: string, fn: (tx: unknown) => unknown) => fn({}),
  liveStorefrontHosts: async () => ['www.shop.in'],
  resolveHost: async () => ({ storeId: 's1', primaryHostname: 'www.shop.in', redirect: false }),
}))

vi.mock('@commerce/core', async () => {
  const rules = await import('../../../packages/core/src/seo/indexnow')
  return {
    ...rules,
    indexNowTarget: async () => ({ host: state.host, key: state.key }),
    ensureIndexNowKey: async () => KEY,
    indexNowChangedPaths: async (_tx: unknown, since: Date) => {
      state.since.push(since)
      return state.changed
    },
  }
})

vi.mock('@commerce/observability/logging', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}))

const { createIndexNowSweep, noteIndexNowRemoved, runIndexNowStore } = await import('./indexnow')

/** Just enough of ioredis: strings and lists, with `multi()` running each command in turn. */
function fakeRedis() {
  const strings = new Map<string, string>()
  const lists = new Map<string, string[]>()
  const ops = {
    get: async (k: string) => strings.get(k) ?? null,
    set: async (k: string, v: string) => {
      strings.set(k, v)
      return 'OK'
    },
    del: async (k: string) => {
      strings.delete(k)
      lists.delete(k)
      return 1
    },
    rpush: async (k: string, ...v: string[]) => {
      lists.set(k, [...(lists.get(k) ?? []), ...v])
      return lists.get(k)?.length ?? 0
    },
    ltrim: async (k: string, start: number) => {
      lists.set(k, (lists.get(k) ?? []).slice(start))
      return 'OK'
    },
    expire: async () => 1,
    lrange: async (k: string) => [...(lists.get(k) ?? [])],
  }
  type Op = keyof typeof ops
  const redis = {
    ...ops,
    multi: () => {
      const queued: (() => Promise<unknown>)[] = []
      const chain = new Proxy(
        {},
        {
          get: (_t, name: string) => {
            if (name === 'exec')
              return async () => {
                const out: [null, unknown][] = []
                for (const run of queued) out.push([null, await run()])
                return out
              }
            return (...args: unknown[]) => {
              queued.push(() => (ops[name as Op] as (...a: unknown[]) => Promise<unknown>)(...args))
              return chain
            }
          },
        },
      )
      return chain
    },
  }
  return { redis: redis as never, lists }
}

/** A fetch mock typed as fetch, with its calls still readable. */
const asFetch = (m: ReturnType<typeof vi.fn>) => m as unknown as typeof fetch & typeof m
const okFetch = () => asFetch(vi.fn(async () => new Response(null, { status: 200 })))
const db = {} as never

beforeEach(() => {
  state.host = 'www.shop.in'
  state.key = KEY
  state.changed = []
  state.since = []
})

describe('runIndexNowStore', () => {
  it('only sets the cursor on the first run, so a deploy announces nothing', async () => {
    const { redis } = fakeRedis()
    const fetchMock = okFetch()
    const r = await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:00:00Z'), fetchMock)
    expect(r.urls).toBe(0)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('sends changed and deleted paths since the last run in one POST', async () => {
    const { redis } = fakeRedis()
    const fetchMock = okFetch()
    await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:00:00Z'), fetchMock)
    state.changed = ['/products/mouse', '/collections/mice']
    await noteIndexNowRemoved(redis, 's1', ['/products/old-pad', '/products/mouse'])
    const r = await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:05:00Z'), fetchMock)
    expect(state.since[0]?.toISOString()).toBe('2026-11-22T10:00:00.000Z')
    expect(r).toMatchObject({ urls: 3, ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body))).toEqual({
      host: 'www.shop.in',
      key: KEY,
      keyLocation: `https://www.shop.in/${KEY}.txt`,
      urlList: [
        'https://www.shop.in/products/mouse',
        'https://www.shop.in/collections/mice',
        'https://www.shop.in/products/old-pad',
      ],
    })
    // The deleted paths were taken: the next run has nothing to send.
    state.changed = []
    await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:10:00Z'), fetchMock)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('sends nothing for a store that cannot ping (no custom domain, locked, hidden)', async () => {
    const { redis } = fakeRedis()
    const fetchMock = okFetch()
    state.host = null
    state.changed = ['/products/mouse']
    await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:00:00Z'), fetchMock)
    await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:05:00Z'), fetchMock)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('logs a failed POST and does not retry it', async () => {
    const { redis } = fakeRedis()
    const fetchMock = asFetch(vi.fn(async () => new Response('', { status: 429 })))
    await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:00:00Z'), fetchMock)
    state.changed = ['/products/mouse']
    const r = await runIndexNowStore(db, redis, 's1', new Date('2026-11-22T10:05:00Z'), fetchMock)
    expect(r.ok).toBe(false)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('createIndexNowSweep', () => {
  it('runs each live store once and counts what it sent', async () => {
    const { redis } = fakeRedis()
    const fetchMock = okFetch()
    const sweep = createIndexNowSweep(db, redis, fetchMock)
    expect(await sweep.run()).toEqual({ stores: 0, sent: 0 })
    state.changed = ['/pages/about']
    expect(await sweep.run()).toEqual({ stores: 1, sent: 1 })
  })
})
