import { createHash } from 'node:crypto'
import { encodeConsent } from '@commerce/core/consent'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * Manual advanced matching is consent-gated on the server too: without the Pixels app or without a
 * yes to marketing on the current banner, `/api/px/me` answers nothing, and with a yes it answers
 * only SHA-256 hex values.
 */
const state = {
  consentCookie: undefined as string | undefined,
  installed: true,
  bannerVersion: 1,
  facts: { email: ' Asha@Example.com ', phone: '98765 43210', name: 'Asha Rao', externalId: 'c1' },
}

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ 'x-store-id': 'store-1' }),
  cookies: async () => ({
    get: (name: string) =>
      name === 'wc_consent' && state.consentCookie ? { value: state.consentCookie } : undefined,
  }),
}))
vi.mock('@/lib/request-log', () => ({ withEvlog: (fn: unknown) => fn }))
vi.mock('@/lib/rate-limit', () => ({
  clientIp: () => '203.0.113.9',
  rateLimited: async () => ({ ok: true }),
}))
vi.mock('@/lib/store-context', () => ({
  inStore: async (_id: string, fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@/lib/customer-session', () => ({ currentCustomer: async () => null }))
vi.mock('@/lib/cart-cookie', () => ({ readCartId: async () => null }))
vi.mock('@commerce/core/pixels/server', async () => {
  const pure = await import('@commerce/core/pixels')
  const sha = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex')
  return {
    browserMatchData: pure.browserMatchData,
    hashMatchValues: (f: Parameters<typeof pure.normaliseCustomerFacts>[0]) =>
      Object.fromEntries(
        Object.entries(pure.normaliseCustomerFacts(f)).map(([k, v]) => [k, sha(v)]),
      ),
    collectorStore: async () => ({
      installed: state.installed,
      bannerVersion: state.bannerVersion,
    }),
    shopperMatchFacts: vi.fn(async () => state.facts),
  }
})

const { GET } = await import('./route')
const server = await import('@commerce/core/pixels/server')
const call = () => GET(new Request('https://w.in/api/px/me')) as Promise<Response>
const AT = new Date('2026-11-14T10:00:00Z')

beforeEach(() => {
  state.consentCookie = undefined
  state.installed = true
  state.bannerVersion = 1
  vi.mocked(server.shopperMatchFacts).mockClear()
})

describe('/api/px/me', () => {
  it('answers nothing before the shopper chooses, and reads no customer data', async () => {
    const res = await call()
    expect(res.status).toBe(204)
    expect(server.shopperMatchFacts).not.toHaveBeenCalled()
  })

  it('answers nothing after a no to marketing, or a yes to an older banner', async () => {
    state.consentCookie = encodeConsent({ analytics: true, marketing: false }, 1, AT)
    expect((await call()).status).toBe(204)
    state.consentCookie = encodeConsent({ analytics: true, marketing: true }, 1, AT)
    state.bannerVersion = 2
    expect((await call()).status).toBe(204)
    expect(server.shopperMatchFacts).not.toHaveBeenCalled()
  })

  it('answers nothing without the Pixels app', async () => {
    state.consentCookie = encodeConsent({ analytics: false, marketing: true }, 1, AT)
    state.installed = false
    expect((await call()).status).toBe(204)
  })

  it('after a yes: hashed values only, never the plain email or phone', async () => {
    state.consentCookie = encodeConsent({ analytics: false, marketing: true }, 1, AT)
    const res = await call()
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toContain('no-store')
    const text = await res.text()
    expect(text).not.toMatch(/asha|example|9876543210/i)
    const { match } = JSON.parse(text) as { match: Record<string, string> }
    expect(Object.keys(match).sort()).toEqual(['country', 'em', 'external_id', 'fn', 'ln', 'ph'])
    for (const v of Object.values(match)) expect(v).toMatch(/^[0-9a-f]{64}$/)
    expect(match.em).toBe(createHash('sha256').update('asha@example.com').digest('hex'))
    expect(match.ph).toBe(createHash('sha256').update('919876543210').digest('hex'))
  })
})
