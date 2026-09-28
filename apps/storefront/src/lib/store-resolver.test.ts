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
