/** SOURCE OF TRUTH: concurrency lease tests — WHAT: the in-process store's cap, release and lease expiry, and the Redis store's script arguments and token handling / WHY: a slot must free itself if its holder dies, and release must only drop its own lease. */
import { describe, expect, it, vi } from 'vitest'
import {
  concurrencyKey,
  createMemoryConcurrencyStore,
  createRedisConcurrencyStore,
} from './concurrency'

describe('createMemoryConcurrencyStore', () => {
  it('holds at most `limit` leases per key, and keys are independent', async () => {
    const store = createMemoryConcurrencyStore()
    const a = await store.acquire('k', 2, 1000, 0)
    const b = await store.acquire('k', 2, 1000, 0)
    expect(a && b).toBeTruthy()
    expect(await store.acquire('k', 2, 1000, 0)).toBeNull()
    expect(await store.acquire('other', 2, 1000, 0)).toBeTruthy()
    await store.release('k', a as string)
    expect(await store.acquire('k', 2, 1000, 0)).toBeTruthy()
  })

  it('frees a lease nobody released once it expires', async () => {
    const store = createMemoryConcurrencyStore()
    expect(await store.acquire('k', 1, 1000, 0)).toBeTruthy()
    expect(await store.acquire('k', 1, 1000, 999)).toBeNull()
    expect(await store.acquire('k', 1, 1000, 1000)).toBeTruthy()
  })

  it('ignores an unknown or repeated release', async () => {
    const store = createMemoryConcurrencyStore()
    const t = (await store.acquire('k', 1, 1000, 0)) as string
    await store.release('k', 'nope')
    expect(await store.acquire('k', 1, 1000, 0)).toBeNull()
    await store.release('k', t)
    await store.release('k', t)
    expect(await store.acquire('k', 1, 1000, 0)).toBeTruthy()
  })
})

describe('createRedisConcurrencyStore', () => {
  function fakeRedis(reply: number) {
    return {
      eval: vi.fn(async (..._args: unknown[]) => reply),
      zrem: vi.fn(async (..._args: unknown[]) => 1),
    }
  }

  it('asks the script for a slot expiring after the lease, and returns its token', async () => {
    const redis = fakeRedis(1)
    const store = createRedisConcurrencyStore(redis)
    const key = concurrencyKey('automations-http', 's1')
    const token = await store.acquire(key, 5, 60_000, 1_000)
    expect(token).toMatch(/^1000-/)
    const [script, ...args] = redis.eval.mock.calls[0] as unknown[]
    expect(script).toContain('ZREMRANGEBYSCORE')
    expect(args).toEqual([1, 'concurrency:automations-http:s1', 1_000, 5, 61_000, token, 60_000])
    await store.release(key, token as string)
    expect(redis.zrem).toHaveBeenCalledWith(key, token)
  })

  it('returns null when every slot is held', async () => {
    const store = createRedisConcurrencyStore(fakeRedis(0))
    expect(await store.acquire('k', 5, 60_000, 0)).toBeNull()
  })
})
