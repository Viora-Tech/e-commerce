import { NextRequest } from 'next/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { proxy } from '../proxy'
import { ADMIN_FRAME_ANCESTORS, newNonce, PAGE_CACHE_CONTROL, scriptCsp } from './csp'

const nonceOf = (value: string | null) => value?.match(/'nonce-([^']+)'/)?.[1] ?? null

describe('admin script CSP', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('mints a fresh nonce every time', () => {
    expect(newNonce()).not.toBe(newNonce())
  })

  it('enforces nonce + strict-dynamic in production and keeps frame-ancestors', () => {
    const csp = scriptCsp({ nonce: 'abc', dev: false })
    expect(csp.name).toBe('Content-Security-Policy')
    expect(csp.value).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'")
    expect(csp.value).not.toContain('unsafe-eval')
    expect(ADMIN_FRAME_ANCESTORS).toBe("frame-ancestors 'self'")
    expect(csp.value).toContain(ADMIN_FRAME_ANCESTORS)
  })

  it('leaves fetches unrestricted, so browser error reports reach GlitchTip', () => {
    for (const dev of [false, true]) {
      expect(scriptCsp({ nonce: 'abc', dev }).value).not.toMatch(/connect-src|default-src/)
    }
  })

  it('only reports in development', () => {
    const csp = scriptCsp({ nonce: 'abc', dev: true })
    expect(csp.name).toBe('Content-Security-Policy-Report-Only')
    expect(csp.value).toContain("'unsafe-eval'")
  })

  it('proxy: every page response gets the header with its own nonce, forwarded as x-nonce', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const first = proxy(new NextRequest('https://admin.waimers.in/orders'))
    const second = proxy(new NextRequest('https://admin.waimers.in/orders'))
    const a = first.headers.get('content-security-policy')
    const b = second.headers.get('content-security-policy')
    expect(a).toContain("'strict-dynamic'")
    expect(nonceOf(a)).toBeTruthy()
    expect(nonceOf(a)).not.toBe(nonceOf(b))
    // NextResponse.next({ request: { headers } }) carries overridden request headers this way.
    expect(first.headers.get('x-middleware-request-x-nonce')).toBe(nonceOf(a))
  })

  it('proxy: pages say no-transform, so Cloudflare does not rewrite emails (React #418)', () => {
    vi.stubEnv('NODE_ENV', 'production')
    const res = proxy(new NextRequest('https://admin.waimers.in/customers'))
    expect(res.headers.get('cache-control')).toBe(PAGE_CACHE_CONTROL)
    expect(PAGE_CACHE_CONTROL.split(', ')).toEqual(
      expect.arrayContaining(['no-transform', 'no-store', 'private']),
    )
  })

  it('proxy: development answers report-only', () => {
    vi.stubEnv('NODE_ENV', 'development')
    const res = proxy(new NextRequest('http://localhost:3200/'))
    expect(res.headers.get('content-security-policy')).toBeNull()
    expect(res.headers.get('content-security-policy-report-only')).toContain("'nonce-")
  })
})
