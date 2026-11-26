import { NextRequest } from 'next/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// Two stores and no database: `shop.example` (www primary, apex redirects) has no portal host
// connected; `live.example` has `affiliate.live.example` connected as one of its domains.
const SHOP = '00000000-0000-4000-8000-000000000001'
const LIVE = '00000000-0000-4000-8000-000000000002'
const HOSTS: Record<string, { storeId: string; primaryHostname: string; redirect: boolean }> = {
  'www.shop.example': { storeId: SHOP, primaryHostname: 'www.shop.example', redirect: false },
  'shop.example': { storeId: SHOP, primaryHostname: 'www.shop.example', redirect: true },
  'www.live.example': { storeId: LIVE, primaryHostname: 'www.live.example', redirect: false },
  'affiliate.live.example': {
    storeId: LIVE,
    primaryHostname: 'www.live.example',
    redirect: false,
  },
  // A store whose own address happens to start with `affiliate.`: never taken for a portal.
  'affiliate.brand.example': {
    storeId: '00000000-0000-4000-8000-000000000003',
    primaryHostname: 'affiliate.brand.example',
    redirect: false,
  },
  'brand.example': { storeId: SHOP, primaryHostname: 'www.shop.example', redirect: true },
}
vi.mock('@commerce/db', async (original) => ({
  ...(await original<typeof import('@commerce/db')>()),
  resolveHost: async (_db: unknown, hostname: string) => HOSTS[hostname] ?? null,
}))
vi.mock('./db', () => ({ db: () => ({}) }))

type Proxy = typeof import('../proxy').proxy
let proxy: Proxy

beforeAll(async () => {
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('DATABASE_URL', 'postgres://x:x@127.0.0.1:1/none')
  vi.stubEnv('DATABASE_URL_OWNER', 'postgres://x:x@127.0.0.1:1/none')
  vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1')
  vi.stubEnv('ACCOUNTS_URL', 'https://accounts.waimers.store')
  vi.stubEnv('SETTINGS_SECRET', 'test-only-production-secret-0123456789')
  ;({ proxy } = await import('../proxy'))
}, 60_000)

const get = (host: string, path: string, init: { method?: string } = {}) =>
  proxy(
    new NextRequest(`https://${host}${path}`, { headers: { host }, method: init.method ?? 'GET' }),
  )

/** Where a rewrite went, and a request header the proxy set for the page. */
const rewrite = (res: Response) =>
  new URL(res.headers.get('x-middleware-rewrite') ?? 'x:/').pathname
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`)

describe('proxy: the affiliate portal host (affiliate.<domain>)', () => {
  it('serves every path of the portal for the store of the domain under it', async () => {
    const home = await get('affiliate.shop.example', '/')
    expect(rewrite(home)).toBe(`/-f/${SHOP}`)
    expect(forwarded(home, 'x-store-id')).toBe(SHOP)
    expect(forwarded(home, 'x-portal-base')).toBe('')
    const payouts = await get('affiliate.shop.example', '/payouts')
    expect(rewrite(payouts)).toBe(`/-f/${SHOP}/payouts`)
  })

  it('finds the store from the apex too (affiliate.brand → brand.example)', async () => {
    const res = await get('affiliate.live.example', '/commissions')
    expect(rewrite(res)).toBe(`/-f/${LIVE}/commissions`)
  })

  it('is isolated: nothing may frame it', async () => {
    const res = await get('affiliate.shop.example', '/')
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(res.headers.get('x-frame-options')).toBe('DENY')
  })

  it('refuses internal segments and the store-domain hand-off', async () => {
    expect((await get('affiliate.shop.example', `/-s/${SHOP}`)).status).toBe(404)
    expect((await get('affiliate.shop.example', `/-f/${SHOP}`)).status).toBe(404)
    expect((await get('affiliate.shop.example', '/continue')).status).toBe(404)
  })

  it('passes the API through with the store, for product search', async () => {
    const res = await get('affiliate.shop.example', '/api/search/suggest?q=mat')
    expect(res.headers.get('x-middleware-rewrite')).toBeNull()
    expect(forwarded(res, 'x-store-id')).toBe(SHOP)
  })

  it('never takes a store whose own address starts with affiliate. for a portal', async () => {
    // An API call stops before the page's own lookups: it shows whose store the host is.
    const res = await get('affiliate.brand.example', '/api/search/suggest')
    expect(forwarded(res, 'x-store-id')).toBe('00000000-0000-4000-8000-000000000003')
    expect(forwarded(res, 'x-portal-base')).toBeNull()
  })

  it('answers no store for an affiliate. host over an unknown domain', async () => {
    expect((await get('affiliate.nobody.example', '/')).status).toBe(404)
  })
})

describe('proxy: /affiliate on the store domain', () => {
  it('serves the portal outside the theme while no portal host is connected', async () => {
    const res = await get('www.shop.example', '/affiliate/payouts')
    expect(rewrite(res)).toBe(`/-f/${SHOP}/payouts`)
    expect(forwarded(res, 'x-portal-base')).toBe('/affiliate')
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(rewrite(await get('www.shop.example', '/affiliate'))).toBe(`/-f/${SHOP}`)
  })

  it('sends page loads to the portal host once it is live, keeping the path and query', async () => {
    const res = await get('www.live.example', '/affiliate/commissions?status=paid')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe(
      'https://affiliate.live.example/commissions?status=paid',
    )
    const home = await get('www.live.example', '/affiliate')
    expect(home.headers.get('location')).toBe('https://affiliate.live.example/')
  })

  it('keeps the sign-in hand-off and form posts on the store domain', async () => {
    const handoff = await get('www.live.example', '/affiliate/continue')
    expect(rewrite(handoff)).toBe(`/-f/${LIVE}/continue`)
    const post = await get('www.live.example', '/affiliate/signup', { method: 'POST' })
    expect(rewrite(post)).toBe(`/-f/${LIVE}/signup`)
  })

  it('never reaches the portal segment by its internal path', async () => {
    expect((await get('www.shop.example', `/-f/${SHOP}`)).status).toBe(404)
  })
})
