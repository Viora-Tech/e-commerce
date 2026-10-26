import { NextRequest } from 'next/server'
import { beforeAll, describe, expect, it, vi } from 'vitest'

// One known store and no database: the token swap answers before anything else is looked up.
vi.mock('@commerce/db', async (original) => ({
  ...(await original<typeof import('@commerce/db')>()),
  resolveHost: async (_db: unknown, hostname: string) =>
    hostname === 'shop.example'
      ? {
          storeId: '00000000-0000-4000-8000-000000000001',
          primaryHostname: 'shop.example',
          redirect: false,
        }
      : null,
}))
vi.mock('./db', () => ({ db: () => ({}) }))

const TOKEN =
  '0b9f3c1e-7d2a-4f6b-9a8e-1c2d3e4f5a6b.2077000000000.Ab3_x-Yz09Ab3_x-Yz09Ab3_x-Yz09Ab3_x'

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

const get = (path: string) =>
  proxy(new NextRequest(`https://shop.example${path}`, { headers: { host: 'shop.example' } }))

describe('proxy: order token out of the URL', () => {
  it.each([
    ['/checkout/thank-you/1042', '/checkout/thank-you/1042'],
    ['/checkout/pay/1042', '/checkout/pay/1042'],
  ])(
    'redirects %s?t=… to the same page without the token, which waits in a cookie',
    async (page, cookiePath) => {
      const res = await get(`${page}?t=${TOKEN}&balance=busy`)
      expect(res.status).toBe(302)
      const location = new URL(res.headers.get('location') ?? '')
      expect(location.pathname).toBe(page)
      expect(location.searchParams.has('t')).toBe(false)
      expect(location.searchParams.get('balance')).toBe('busy')
      expect(res.headers.get('location')).not.toContain(TOKEN)
      expect(res.headers.get('cache-control')).toBe('no-store')
      // The redirect carries no page, so no pixel or tag ever runs with the token in the URL.
      expect(await res.text()).toBe('')
      const cookie = res.headers.get('set-cookie') ?? ''
      expect(cookie).toContain(`wc_ov=${TOKEN}`)
      expect(cookie).toContain(`Path=${cookiePath}`)
      expect(cookie).toMatch(/HttpOnly/i)
      expect(cookie).toMatch(/Secure/i)
      expect(cookie).toMatch(/SameSite=lax/i)
      expect(cookie).toContain('Max-Age=1800')
    },
  )
})
