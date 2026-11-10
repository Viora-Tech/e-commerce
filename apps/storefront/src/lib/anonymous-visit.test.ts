import { describe, expect, it, vi } from 'vitest'
import {
  ANONYMOUS_SESSION_TTL_SECONDS,
  anonymousVisitorId,
  startsAnonymousSession,
  visitAddress,
} from './anonymous-visit'

const base = {
  secret: 's'.repeat(32),
  day: '2026-11-11',
  storeId: 'store-1',
  ip: '203.0.113.7',
  userAgent: 'Mozilla/5.0',
}

describe('anonymousVisitorId', () => {
  it('is stable within a day and prefixed so it never looks like a cookie id', () => {
    const id = anonymousVisitorId(base)
    expect(id).toMatch(/^anon:[0-9a-f]{32}$/)
    expect(anonymousVisitorId(base)).toBe(id)
  })

  it('changes with the day, so visits cannot be joined across days', () => {
    expect(anonymousVisitorId({ ...base, day: '2026-11-12' })).not.toBe(anonymousVisitorId(base))
  })

  it('differs per store, network and browser', () => {
    const id = anonymousVisitorId(base)
    expect(anonymousVisitorId({ ...base, storeId: 'store-2' })).not.toBe(id)
    expect(anonymousVisitorId({ ...base, ip: '203.0.113.8' })).not.toBe(id)
    expect(anonymousVisitorId({ ...base, userAgent: 'Other' })).not.toBe(id)
  })

  it('does not contain the address', () => {
    expect(anonymousVisitorId(base)).not.toContain('203')
  })
})

describe('visitAddress', () => {
  const headers = (h: Record<string, string>) => ({ get: (n: string) => h[n] ?? null })

  it("reads Cloudflare's header", () => {
    expect(visitAddress(headers({ 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1')
  })

  it('gives up rather than lump every shopper together', () => {
    expect(visitAddress(headers({}))).toBeNull()
    expect(visitAddress(headers({ 'cf-connecting-ip': 'not an ip' }))).toBeNull()
  })
})

describe('startsAnonymousSession', () => {
  const redisWith = (setReply: unknown) => ({
    set: vi.fn(async () => setReply),
    expire: vi.fn(async () => 1),
  })

  it('starts a visit when none is open', async () => {
    const redis = redisWith('OK')
    expect(await startsAnonymousSession(redis, 'k', false)).toBe(true)
    expect(redis.set).toHaveBeenCalledWith('k', '1', 'EX', ANONYMOUS_SESSION_TTL_SECONDS, 'NX')
  })

  it('continues an open visit and keeps it alive for 30 more minutes', async () => {
    const redis = redisWith(null)
    expect(await startsAnonymousSession(redis, 'k', false)).toBe(false)
    expect(redis.expire).toHaveBeenCalledWith('k', ANONYMOUS_SESSION_TTL_SECONDS)
  })

  it('starts a new visit on a tagged landing even inside an open one', async () => {
    expect(await startsAnonymousSession(redisWith(null), 'k', true)).toBe(true)
  })
})
