import { createElement, type ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { forwardNonce, newNonce, scriptCsp, storefrontFrameAncestors } from './csp'

// next/script injects on the client; render it as a plain tag so the nonce is visible.
vi.mock('next/script', () => ({
  default: (p: { id?: string; src?: string; nonce?: string; children?: ReactNode }) =>
    createElement('script', { id: p.id, src: p.src, nonce: p.nonce }, p.children),
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/' }))

describe('storefront script CSP', () => {
  it('mints a fresh, unguessable nonce every time', () => {
    const a = newNonce()
    const b = newNonce()
    expect(a).not.toBe(b)
    expect(Buffer.from(a, 'base64')).toHaveLength(16)
  })

  it('enforces a nonce + strict-dynamic policy in production', () => {
    const csp = scriptCsp({ nonce: 'abc', dev: false, frameAncestors: "frame-ancestors 'self'" })
    expect(csp.name).toBe('Content-Security-Policy')
    expect(csp.value).toContain("script-src 'self' 'nonce-abc' 'strict-dynamic'")
    expect(csp.value).toContain("object-src 'none'")
    expect(csp.value).toContain("base-uri 'self'")
    expect(csp.value).not.toContain('unsafe-eval')
  })

  it('leaves fetches unrestricted, so browser error reports reach GlitchTip', () => {
    for (const dev of [false, true]) {
      const csp = scriptCsp({ nonce: 'abc', dev, frameAncestors: "frame-ancestors 'self'" })
      expect(csp.value).not.toMatch(/connect-src|default-src/)
    }
  })

  it('only reports in development, with eval for React dev tooling', () => {
    const csp = scriptCsp({ nonce: 'abc', dev: true, frameAncestors: "frame-ancestors 'self'" })
    expect(csp.name).toBe('Content-Security-Policy-Report-Only')
    expect(csp.value).toContain("'unsafe-eval'")
    // Report-only cannot carry frame-ancestors; next.config.ts enforces it there.
    expect(csp.value).not.toContain('frame-ancestors')
  })

  it('keeps frame-ancestors exactly as before (self plus the admin for the theme editor)', () => {
    expect(storefrontFrameAncestors('https://admin.waimers.in/x')).toBe(
      "frame-ancestors 'self' https://admin.waimers.in",
    )
    expect(storefrontFrameAncestors(undefined)).toBe("frame-ancestors 'self'")
    const prod = scriptCsp({
      nonce: 'n',
      dev: false,
      frameAncestors: storefrontFrameAncestors('https://admin.waimers.in'),
    })
    expect(prod.value.endsWith("frame-ancestors 'self' https://admin.waimers.in")).toBe(true)
  })

  it('forwards only our nonce and policy on the request', () => {
    const headers = new Headers({
      'content-security-policy': "script-src 'nonce-attacker'",
      'x-nonce': 'attacker',
    })
    const csp = scriptCsp({ nonce: 'ours', dev: true, frameAncestors: '' })
    forwardNonce(headers, 'ours', csp)
    expect(headers.get('x-nonce')).toBe('ours')
    expect(headers.get('content-security-policy')).toBeNull()
    expect(headers.get('content-security-policy-report-only')).toContain("'nonce-ours'")
  })

  it('puts the nonce on every tracking tag loader', async () => {
    const { default: TrackingTags } = await import('@/components/analytics/tracking-tags')
    const html = renderToStaticMarkup(
      createElement(TrackingTags, {
        ga4: 'G-ABC123',
        gtm: 'GTM-ABC123',
        metaPixel: '1234567890',
        nonce: 'n0nce',
      }),
    )
    const scripts = html.match(/<script[^>]*>/g) ?? []
    expect(scripts).toHaveLength(4)
    for (const tag of scripts) expect(tag).toContain('nonce="n0nce"')
  })

  it('loads gtag.js once for GA4 and Google Ads, configuring both', async () => {
    const { default: TrackingTags } = await import('@/components/analytics/tracking-tags')
    const both = renderToStaticMarkup(
      createElement(TrackingTags, {
        ga4: 'G-ABC123',
        gtm: null,
        metaPixel: null,
        googleAds: 'AW-123456789',
        nonce: 'n0nce',
      }),
    )
    expect(both.match(/gtag\/js\?id=/g)).toHaveLength(1)
    expect(both).toContain("gtag('config','G-ABC123');gtag('config','AW-123456789');")
    const adsOnly = renderToStaticMarkup(
      createElement(TrackingTags, {
        ga4: null,
        gtm: null,
        metaPixel: null,
        googleAds: 'AW-123456789',
        nonce: 'n0nce',
      }),
    )
    expect(adsOnly).toContain('gtag/js?id=AW-123456789')
  })

  it('hands the nonce on to gtm.js, so Tag Manager can give it to Custom HTML tags', async () => {
    const { default: TrackingTags } = await import('@/components/analytics/tracking-tags')
    const html = renderToStaticMarkup(
      createElement(TrackingTags, {
        ga4: null,
        gtm: 'GTM-ABC123',
        metaPixel: null,
        nonce: 'n0nce',
      }),
    )
    // Google's nonce-aware snippet: copy the loader's nonce onto the gtm.js element it creates.
    expect(html).toContain("j.setAttribute('nonce',n.nonce||n.getAttribute('nonce'))")
  })
})
