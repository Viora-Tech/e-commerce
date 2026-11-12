import { setRequestMemo } from '@commerce/core/request-memo'
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * With no store stamp (caching off, or just after a change) the render cache keeps nothing
 * across requests, but one render still reads each key once. An uncached page used to repeat
 * the live theme lookup 6 times and the theme import record 7 times (roadmap, speed track 3).
 */

// React scopes `cache` to one server render; here one "request" is one map, reset per test.
let request = new Map<unknown, unknown>()
vi.mock('react', () => ({
  cache:
    <A extends unknown[], R>(fn: (...args: A) => R) =>
    (...args: A): R => {
      const key = [fn, ...args].map(String).join('|')
      if (!request.has(fn)) request.set(fn, new Map<string, R>())
      const perFn = request.get(fn) as Map<string, R>
      if (!perFn.has(key)) perFn.set(key, fn(...args))
      return perFn.get(key) as R
    },
}))
vi.mock('@commerce/config', () => ({ loadEnv: () => ({ STOREFRONT_CACHE_MB: 0 }) }))
vi.mock('@commerce/core', () => ({
  listenStorefrontCache: vi.fn(),
  nextScheduledChange: vi.fn(),
}))
vi.mock('@commerce/observability/logging', () => ({ logger: { error: vi.fn() } }))
vi.mock('./cache-warm', () => ({ scheduleWarm: vi.fn(), WARM_QUIET_MS: 0 }))
vi.mock('./market-catalog', () => ({ requestCatalogId: async () => null }))

const transactions = vi.fn()
vi.mock('./store-context', () => ({
  inStore: async <T>(storeId: string, fn: (tx: unknown, storeId: string) => Promise<T>) => {
    transactions(storeId)
    return fn({}, storeId)
  },
}))

const { cachedForStore, peekForStore, rememberForStore, storeRead } = await import('./store-cache')
const { inStore } = await import('./store-context')
const { cache } = await import('react')
setRequestMemo(cache(() => new Map<string, Promise<unknown>>()))

const STORE = '0192f0a1-0000-7000-8000-000000000001'

function newRequest() {
  request = new Map()
}

beforeEach(() => {
  newRequest()
  transactions.mockClear()
})

afterAll(() => setRequestMemo(null))

describe('store cache with no stamp', () => {
  it('opens one transaction for a read the page repeats', async () => {
    const mainTheme = vi.fn(async () => 'theme-1')
    const importRecord = vi.fn(async () => ({ version: 'v1', shopifyHost: null }))
    // What one uncached page asked for before (audit, 11 Nov 2026).
    for (let i = 0; i < 6; i++) await storeRead(STORE, 'main-theme', mainTheme)
    await Promise.all(
      Array.from({ length: 7 }, () =>
        // As `importedTheme` reads it: a cached load that opens its own transaction.
        cachedForStore(STORE, 'theme-import|theme-1', () => inStore(STORE, importRecord)),
      ),
    )
    expect(mainTheme).toHaveBeenCalledTimes(1)
    expect(importRecord).toHaveBeenCalledTimes(1)
    expect(transactions).toHaveBeenCalledTimes(2)
  })

  it('without the request memo (before this change) repeated every read', async () => {
    setRequestMemo(null)
    try {
      const mainTheme = vi.fn(async () => 'theme-1')
      for (let i = 0; i < 6; i++) await storeRead(STORE, 'main-theme', mainTheme)
      expect(transactions).toHaveBeenCalledTimes(6)
    } finally {
      setRequestMemo(cache(() => new Map<string, Promise<unknown>>()))
    }
  })

  it('keeps nothing for the next request', async () => {
    const read = vi.fn(async () => 'theme-1')
    await storeRead(STORE, 'main-theme', read)
    newRequest()
    await storeRead(STORE, 'main-theme', read)
    expect(read).toHaveBeenCalledTimes(2)
    expect(transactions).toHaveBeenCalledTimes(2)
  })

  it('keys by store', async () => {
    const other = '0192f0a1-0000-7000-8000-000000000002'
    const read = vi.fn(async (_tx: unknown) => 'x')
    await storeRead(STORE, 'main-theme', read)
    await storeRead(other, 'main-theme', read)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('tries a failed read again', async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce('theme-1')
    await expect(storeRead(STORE, 'main-theme', read)).rejects.toThrow('down')
    await expect(storeRead(STORE, 'main-theme', read)).resolves.toBe('theme-1')
  })

  it('peeks what this request remembered, and only that', async () => {
    expect(await peekForStore(STORE, 'section|a')).toBeUndefined()
    await rememberForStore(STORE, 'section|a', { html: '<p>' }, { size: 3, ttlMs: 1000 })
    expect(await peekForStore(STORE, 'section|a')).toEqual({ html: '<p>' })
    newRequest()
    expect(await peekForStore(STORE, 'section|a')).toBeUndefined()
  })
})
