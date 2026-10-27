import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'

// No database: every hostname is unknown, so the proxy answers its own 404.
vi.mock('@commerce/db', async (original) => ({
  ...(await original<typeof import('@commerce/db')>()),
  resolveHost: async () => null,
}))
vi.mock('./db', () => ({ db: () => ({}) }))

const nonceOf = (value: string | null) => value?.match(/'nonce-([^']+)'/)?.[1] ?? null

describe('storefront proxy CSP', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('sends the policy with a fresh nonce on every answer, even its own 404', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_URL', 'https://admin.waimers.in')
    // Placeholders for the env loader; nothing connects (resolveHost is mocked above).
    vi.stubEnv('DATABASE_URL', 'postgres://x:x@127.0.0.1:1/none')
    vi.stubEnv('DATABASE_URL_OWNER', 'postgres://x:x@127.0.0.1:1/none')
    vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1')
    vi.stubEnv('ACCOUNTS_URL', 'https://accounts.waimers.store')
    // Production refuses the public development default (security audit 2026-10-06, A-02).
    vi.stubEnv('SETTINGS_SECRET', 'test-only-production-secret-0123456789')
    const { proxy } = await import('../proxy')
    const ask = () =>
      proxy(new NextRequest('https://unknown.example/', { headers: { host: 'unknown.example' } }))
    const [a, b] = await Promise.all([ask(), ask()])
    expect(a.status).toBe(404)
    const policy = a.headers.get('content-security-policy')
    expect(policy).toContain("'strict-dynamic'")
    expect(policy).toContain("frame-ancestors 'self' https://admin.waimers.in")
    expect(nonceOf(policy)).toBeTruthy()
    expect(nonceOf(policy)).not.toBe(nonceOf(b.headers.get('content-security-policy')))
  }, 60_000)

  it('isolates checkout and account: no framing, and the isolation headers (D-01)', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('ADMIN_URL', 'https://admin.waimers.in')
    vi.stubEnv('DATABASE_URL', 'postgres://x:x@127.0.0.1:1/none')
    vi.stubEnv('DATABASE_URL_OWNER', 'postgres://x:x@127.0.0.1:1/none')
    vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1')
    vi.stubEnv('ACCOUNTS_URL', 'https://accounts.waimers.store')
    vi.stubEnv('SETTINGS_SECRET', 'test-only-production-secret-0123456789')
    const { proxy } = await import('../proxy')
    const at = (path: string) =>
      proxy(new NextRequest(`https://shop.example${path}`, { headers: { host: 'shop.example' } }))

    for (const path of ['/checkout', '/account/orders']) {
      const res = await at(path)
      const policy = res.headers.get('content-security-policy')
      expect(policy).toContain("frame-ancestors 'none'")
      expect(policy).not.toContain("'self' https://admin.waimers.in")
      expect(res.headers.get('x-frame-options')).toBe('DENY')
      expect(res.headers.get('cross-origin-opener-policy')).toBe('same-origin-allow-popups')
      expect(res.headers.get('cross-origin-resource-policy')).toBe('same-origin')
    }

    // A normal storefront page is unchanged: still framable by self + the admin editor, no COOP.
    const normal = await at('/products/shoe')
    expect(normal.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'self' https://admin.waimers.in",
    )
    expect(normal.headers.get('x-frame-options')).toBeNull()
    expect(normal.headers.get('cross-origin-opener-policy')).toBeNull()
  }, 60_000)
})
