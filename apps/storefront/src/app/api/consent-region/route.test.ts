import { beforeEach, describe, expect, it, vi } from 'vitest'

/*
 * A page a shared cache may keep is drawn without the visitor's region; the browser asks here.
 * Shopify's model: only the EU, the EEA, the UK and Switzerland are asked, unless the store
 * asks everyone. An `open` visitor also gets the anonymous visitor id here.
 */
const state = {
  country: '',
  regions: 'consent_required' as 'consent_required' | 'everyone',
  cookies: {} as Record<string, string>,
}

vi.mock('next/headers', () => ({
  headers: async () =>
    new Headers({
      'x-store-id': 'store-1',
      ...(state.country ? { 'cf-ipcountry': state.country } : {}),
    }),
  cookies: async () => ({
    get: (name: string) => (state.cookies[name] ? { value: state.cookies[name] } : undefined),
  }),
}))
vi.mock('@/lib/request-log', () => ({ withEvlog: (fn: unknown) => fn }))
vi.mock('@/lib/storefront-gate', () => ({
  storefrontLock: async () => ({ bannerRegions: state.regions, bannerVersion: 1 }),
}))

const { GET } = await import('./route')
const call = () =>
  GET(
    new Request('https://w.in/api/consent-region', { headers: { 'x-store-id': 'store-1' } }),
  ) as Promise<Response>

beforeEach(() => {
  state.country = ''
  state.regions = 'consent_required'
  state.cookies = {}
})

describe('/api/consent-region', () => {
  it('is open for India (and an unknown country), with a visitor id, never cached', async () => {
    state.country = 'IN'
    const res = await call()
    expect(await res.json()).toEqual({ region: 'open' })
    expect(res.headers.get('cache-control')).toContain('no-store')
    expect(res.headers.get('set-cookie')).toContain('wc_vid=')
    state.country = ''
    expect(await (await call()).json()).toEqual({ region: 'open' })
  })

  it('asks Germany and the UK, and sets nothing', async () => {
    for (const country of ['DE', 'GB']) {
      state.country = country
      const res = await call()
      expect(await res.json()).toEqual({ region: 'ask' })
      expect(res.headers.get('set-cookie')).toBeNull()
    }
  })

  it('asks everyone when the store chose to, and keeps a saved no', async () => {
    state.regions = 'everyone'
    state.country = 'IN'
    expect(await (await call()).json()).toEqual({ region: 'ask' })
    state.regions = 'consent_required'
    state.cookies = { wc_consent: 'a0m0.v1.t1790000000' }
    const res = await call()
    expect(await res.json()).toEqual({ region: 'open' })
    expect(res.headers.get('set-cookie')).toBeNull()
  })
})
