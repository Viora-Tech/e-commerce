import { describe, expect, it, vi } from 'vitest'
import { createStoreResolver, hostnameFromHeader, originFromHost } from './store-resolver'

describe('hostnameFromHeader', () => {
  it('lowercases and strips the port', () => {
    expect(hostnameFromHeader('Waimers.IN:3000')).toBe('waimers.in')
    expect(hostnameFromHeader('localhost:3000')).toBe('localhost')
    expect(hostnameFromHeader('waimers.in')).toBe('waimers.in')
  })

  it('returns null for a missing or empty header', () => {
    expect(hostnameFromHeader(null)).toBeNull()
    expect(hostnameFromHeader('')).toBeNull()
    expect(hostnameFromHeader(':3000')).toBeNull()
  })

  it('refuses a Host that is more than host[:port]', () => {
    expect(hostnameFromHeader('waimers.in:1@evil.com')).toBeNull()
    expect(hostnameFromHeader('waimers.in@evil.com')).toBeNull()
    expect(hostnameFromHeader('waimers.in/evil')).toBeNull()
    expect(hostnameFromHeader('waimers.in:abc')).toBeNull()
    expect(hostnameFromHeader('waimers.in evil.com')).toBeNull()
  })
})

describe('originFromHost', () => {
  it('builds the origin from a plain host', () => {
    expect(originFromHost('Shop.in', null, false)).toEqual({
      origin: 'https://shop.in',
      hostname: 'shop.in',
    })
    expect(originFromHost('shop.localhost:3100', null, true)?.origin).toBe(
      'http://shop.localhost:3100',
    )
    expect(originFromHost('shop.in', 'https', true)?.origin).toBe('https://shop.in')
  })

  it('never lets a crafted Host move the origin to another site', () => {
    expect(originFromHost('shop.in:1@evil.com', 'https', false)).toBeNull()
    expect(originFromHost(null, 'https', false)).toBeNull()
  })
})

describe('createStoreResolver', () => {
  it('looks up once per hostname within the TTL', async () => {
    const lookup = vi.fn(async (h: string) => (h === 'a.test' ? 'store-a' : null))
    let now = 1_000
    const resolve = createStoreResolver({ lookup, ttlMs: 60_000, now: () => now })

    expect(await resolve('a.test')).toBe('store-a')
    expect(await resolve('a.test')).toBe('store-a')
    expect(lookup).toHaveBeenCalledTimes(1)

    now += 60_001
    expect(await resolve('a.test')).toBe('store-a')
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it('caches unknown hostnames too, so a bad host cannot hammer the database', async () => {
    const lookup = vi.fn(async () => null)
    const resolve = createStoreResolver({ lookup, ttlMs: 60_000, now: () => 0 })
    expect(await resolve('nope.test')).toBeNull()
    expect(await resolve('nope.test')).toBeNull()
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('does not cache a failed lookup', async () => {
    const lookup = vi
      .fn<(h: string) => Promise<string | null>>()
      .mockRejectedValueOnce(new Error('db down'))
      .mockResolvedValueOnce('store-a')
    const resolve = createStoreResolver({ lookup, ttlMs: 60_000, now: () => 0 })
    await expect(resolve('a.test')).rejects.toThrow('db down')
    expect(await resolve('a.test')).toBe('store-a')
    expect(lookup).toHaveBeenCalledTimes(2)
  })
})

describe('createStoreResolver bounds', () => {
  it('keeps at most maxEntries keys, dropping the least recently used', async () => {
    const lookup = vi.fn(async (h: string) => (h === 'shop.test' ? 'store-a' : null))
    const resolve = createStoreResolver({ lookup, maxEntries: 100, now: () => 0 })
    await resolve('shop.test')
    // A bot's random hosts: misses, each cached, never more than the cap.
    for (let i = 0; i < 1_000; i++) {
      await resolve(`bot-${i}.test`)
      // The real shop keeps being asked for, so it stays.
      if (i % 10 === 0) await resolve('shop.test')
    }
    expect(resolve.size).toBeLessThanOrEqual(100)
    lookup.mockClear()
    expect(await resolve('shop.test')).toBe('store-a')
    expect(lookup).not.toHaveBeenCalled()
    // The oldest misses were evicted, so they are looked up again.
    await resolve('bot-0.test')
    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('drops an expired answer when it is read', async () => {
    let now = 0
    const resolve = createStoreResolver({ lookup: async () => null, ttlMs: 10, now: () => now })
    await resolve('nope.test')
    expect(resolve.size).toBe(1)
    now = 11
    await resolve('other.test')
    await resolve('nope.test')
    expect(resolve.size).toBe(2)
  })

  it('forgetStore drops that store and every miss, keeping other stores', async () => {
    const owners: Record<string, string> = { 'a.test': 'store-a', 'b.test': 'store-b' }
    const lookup = vi.fn(async (h: string) => owners[h] ?? null)
    const resolve = createStoreResolver({ lookup, now: () => 0, storeOf: (_key, value) => value })
    await resolve('a.test')
    await resolve('b.test')
    await resolve('new.test')
    lookup.mockClear()
    // The merchant connects a domain: the cached miss must not hide it.
    owners['new.test'] = 'store-a'
    resolve.forgetStore('store-a')
    expect(await resolve('new.test')).toBe('store-a')
    await resolve('a.test')
    await resolve('b.test')
    expect(lookup.mock.calls.map(([h]) => h)).toEqual(['new.test', 'a.test'])
  })

  it('clear drops everything', async () => {
    const lookup = vi.fn(async () => 'store-a')
    const resolve = createStoreResolver({ lookup, now: () => 0 })
    await resolve('a.test')
    resolve.clear()
    await resolve('a.test')
    expect(lookup).toHaveBeenCalledTimes(2)
  })
})
