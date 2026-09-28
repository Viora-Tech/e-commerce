import { decodeConsent, encodeConsent } from '@commerce/core/preferences'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { analyticsAllowed } from '@/lib/consent-cookie'

/*
 * The gate itself, rendered on the server with the two things it guards
 * replaced by markers: if a marker is in the HTML, the real beacon or tag
 * would have been mounted and loaded.
 */
vi.mock('@/components/analytics/visit-beacon', () => ({
  default: () => createElement('i', { 'data-testid': 'beacon' }),
}))
vi.mock('@/components/analytics/tracking-tags', () => ({
  default: (p: { ga4: string | null; gtm: string | null; metaPixel: string | null }) =>
    createElement('i', {
      'data-testid': 'tags',
      'data-ga4': p.ga4 ?? '',
      'data-gtm': p.gtm ?? '',
      'data-pixel': p.metaPixel ?? '',
    }),
}))
vi.mock('@/lib/privacy-actions', () => ({ recordConsentAction: vi.fn(async () => ({ ok: true })) }))

const { default: ConsentManager } = await import('./consent-manager')

const tracking = { ga4: 'G-ABC1234', gtm: 'GTM-5X7K9Q', metaPixel: '1234567890' }
const AT = new Date('2026-09-27T10:00:00Z')

function render(cookie: string | null, bannerVersion = 1) {
  return renderToStaticMarkup(
    createElement(ConsentManager, {
      tracking,
      bannerMessage: '',
      bannerVersion,
      initial: decodeConsent(cookie),
    }),
  )
}

describe('consent gating on the storefront', () => {
  it('loads no beacon, analytics tag or pixel before the shopper chooses, and shows the banner', () => {
    const html = render(null)
    expect(html).not.toContain('data-testid="beacon"')
    expect(html).toContain('data-ga4="" data-gtm="" data-pixel=""')
    expect(html).toContain('aria-label="Cookie consent"')
  })

  it('keeps everything off after "Necessary only"', () => {
    const html = render(encodeConsent({ analytics: false, marketing: false }, 1, AT))
    expect(html).not.toContain('data-testid="beacon"')
    expect(html).toContain('data-ga4="" data-gtm="" data-pixel=""')
    expect(html).not.toContain('aria-label="Cookie consent"')
  })

  it('loads the beacon and analytics tags, not the pixel, after analytics only', () => {
    const html = render(encodeConsent({ analytics: true, marketing: false }, 1, AT))
    expect(html).toContain('data-testid="beacon"')
    expect(html).toContain('data-ga4="G-ABC1234" data-gtm="GTM-5X7K9Q" data-pixel=""')
  })

  it('loads the pixel after marketing only, without the beacon', () => {
    const html = render(encodeConsent({ analytics: false, marketing: true }, 1, AT))
    expect(html).not.toContain('data-testid="beacon"')
    expect(html).toContain('data-ga4="" data-gtm="" data-pixel="1234567890"')
  })

  it('asks again, with everything off, when the store bumped the banner version', () => {
    const html = render(encodeConsent({ analytics: true, marketing: true }, 1, AT), 2)
    expect(html).not.toContain('data-testid="beacon"')
    expect(html).toContain('data-ga4="" data-gtm="" data-pixel=""')
    expect(html).toContain('aria-label="Cookie consent"')
    // A cookie from before banner versions existed also counts as no answer.
    expect(render('a1m1')).toContain('aria-label="Cookie consent"')
  })
})

describe('server-side analytics check (proxy visitor id, beacon route)', () => {
  it('needs a yes to analytics in the cookie', () => {
    expect(analyticsAllowed(undefined)).toBe(false)
    expect(analyticsAllowed('garbage')).toBe(false)
    expect(analyticsAllowed(encodeConsent({ analytics: false, marketing: true }, 1, AT))).toBe(
      false,
    )
    expect(analyticsAllowed(encodeConsent({ analytics: true, marketing: false }, 1, AT))).toBe(true)
  })
})
