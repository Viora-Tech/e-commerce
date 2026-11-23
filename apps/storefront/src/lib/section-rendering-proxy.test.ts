import { signThemePreviewToken } from '@commerce/core'
import { NextRequest } from 'next/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { SECTION_PATH_HEADER } from './routing'

// One known store, no markets, redirects or lock, and no database.
const STORE = '00000000-0000-4000-8000-000000000001'
vi.mock('@commerce/db', async (original) => ({
  ...(await original<typeof import('@commerce/db')>()),
  resolveHost: async (_db: unknown, hostname: string) =>
    hostname === 'shop.example'
      ? { storeId: STORE, primaryHostname: 'shop.example', redirect: false }
      : null,
  storeMarkets: async () => [],
}))
vi.mock('./db', () => ({ db: () => ({}) }))
vi.mock('./redirects', () => ({ redirectFor: async () => null }))
vi.mock('./storefront-gate', async (original) => ({
  ...(await original<typeof import('./storefront-gate')>()),
  storefrontLock: async () => ({
    enabled: false,
    password: '',
    search: true,
    ai: true,
    plainHtml: false,
    honoProduct: false,
    productFeed: false,
  }),
}))

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

const get = (path: string, headers: Record<string, string> = {}) =>
  proxy(
    new NextRequest(`https://shop.example${path}`, {
      headers: { host: 'shop.example', ...headers },
    }),
  )

/** What the route handler will see as a forwarded request header. */
const forwarded = (res: Response, name: string) => res.headers.get(`x-middleware-request-${name}`)

describe('proxy: section rendering on a page URL', () => {
  // 22 Nov: the route reads the URL the visitor asked for, so a `?path=` the rewrite added never
  // reached it and the section rendered on the home page (count 0). The path goes in a header.
  it('rewrites to the section route and forwards the page path and its filters', async () => {
    const res = await get('/collections/all?filter.v.availability=1&section_id=guide-results', {
      [SECTION_PATH_HEADER]: '/pages/spoofed',
    })
    const rewrite = new URL(res.headers.get('x-middleware-rewrite') ?? '')
    expect(rewrite.pathname).toBe(`/-s/${STORE}/theme-actions/section`)
    expect(rewrite.searchParams.get('section_id')).toBe('guide-results')
    expect(forwarded(res, SECTION_PATH_HEADER)).toBe('/collections/all')
    expect(forwarded(res, 'x-listing')).toBe('filter.v.availability=1')
  }, 60_000)

  it('leaves the page itself, and the shim route, as they were', async () => {
    const page = await get('/collections/all?filter.v.availability=1')
    expect(new URL(page.headers.get('x-middleware-rewrite') ?? '').pathname).toBe(
      `/-s/${STORE}/collections/all`,
    )
    expect(forwarded(page, SECTION_PATH_HEADER)).toBeNull()
    const shim = await get('/theme-actions/section?path=/collections/all&section_id=guide-results')
    expect(new URL(shim.headers.get('x-middleware-rewrite') ?? '').pathname).toBe(
      `/-s/${STORE}/theme-actions/section`,
    )
    expect(forwarded(shim, SECTION_PATH_HEADER)).toBeNull()
  }, 60_000)
})

describe('proxy: a previewed page in a frame asks for a section', () => {
  // 23 Nov: Customize's Theme scripts frame (and the Themes page preview) has no preview cookie,
  // so the theme's section fetch rendered the live theme. The shim now sends the token along.
  const THEME = '01a1ad79-1023-7366-85dd-d8da62b44369'
  const VERSION = '11111111-2222-4333-8444-555555555555'
  const token = () =>
    signThemePreviewToken({
      secret: 'test-only-production-secret-0123456789',
      storeId: STORE,
      themeId: THEME,
    })

  it("renders the previewed theme and version for the shim's fetch, and sets no cookie", async () => {
    const t = token()
    const q = new URLSearchParams({
      path: '/collections/all',
      'filter.v.availability': '1',
      section_id: 'guide-results',
      'theme-preview': t,
      'theme-version': VERSION,
    })
    const res = await get(`/theme-actions/section?${q}`, { 'sec-fetch-dest': 'empty' })
    expect(new URL(res.headers.get('x-middleware-rewrite') ?? '').pathname).toBe(
      `/-s/${STORE}/theme-actions/section`,
    )
    expect(forwarded(res, 'x-theme-preview')).toBe(t)
    expect(forwarded(res, 'x-theme-version')).toBe(VERSION)
    expect(res.headers.get('set-cookie')).toBeNull()
  }, 60_000)

  it('renders the live theme without it', async () => {
    const res = await get('/theme-actions/section?path=/&section_id=guide-results', {
      'sec-fetch-dest': 'empty',
    })
    expect(forwarded(res, 'x-theme-preview')).toBeNull()
  }, 60_000)
})
