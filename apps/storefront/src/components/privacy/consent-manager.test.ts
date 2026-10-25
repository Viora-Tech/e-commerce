import { cookieBannerSettings } from '@commerce/blocks'
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
  default: (p: {
    ga4: string | null
    gtm: string | null
    metaPixel: string | null
    pixels?: readonly string[] | undefined
  }) =>
    createElement('i', {
      'data-testid': 'tags',
      'data-ga4': p.ga4 ?? '',
      'data-gtm': p.gtm ?? '',
      'data-pixel': p.metaPixel ?? '',
      'data-pixels': (p.pixels ?? []).join(','),
    }),
}))
vi.mock('@/components/analytics/pixel-events', () => ({
  default: () => createElement('i', { 'data-testid': 'pixel-events' }),
}))
vi.mock('@/components/support/chatwoot-widget', () => ({
  default: (p: { identity: { identifier: string } | null }) =>
    createElement('i', { 'data-testid': 'chatwoot', 'data-user': p.identity?.identifier ?? '' }),
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

describe('the Chatwoot chat', () => {
  const widget = { baseUrl: 'https://cw.shop.in', websiteToken: 'webtok12345' }
  const withChat = (cookie: string | null, consent: 'necessary' | 'analytics' | 'marketing') =>
    renderToStaticMarkup(
      createElement(ConsentManager, {
        tracking,
        bannerMessage: '',
        bannerVersion: 1,
        initial: decodeConsent(cookie),
        chatwoot: {
          widget: { ...widget, consent },
          identity: {
            identifier: 'cust-1',
            identifierHash: 'hash',
            name: 'Asha',
            email: null,
            phone: null,
            attributes: {},
          },
        },
      }),
    )

  it('loads for everyone when the store treats chat as necessary, with the shopper', () => {
    expect(withChat(null, 'necessary')).toContain('data-testid="chatwoot" data-user="cust-1"')
    const no = encodeConsent({ analytics: false, marketing: false }, 1, AT)
    expect(withChat(no, 'necessary')).toContain('data-testid="chatwoot"')
  })

  it('waits for the category the store picked', () => {
    expect(withChat(null, 'marketing')).not.toContain('data-testid="chatwoot"')
    const analytics = encodeConsent({ analytics: true, marketing: false }, 1, AT)
    expect(withChat(analytics, 'marketing')).not.toContain('data-testid="chatwoot"')
    expect(withChat(analytics, 'analytics')).toContain('data-testid="chatwoot"')
  })
})

describe('the theme CookieBanner section', () => {
  const appearance = cookieBannerSettings({ position: 'right', acceptLabel: 'Yes please' })
  const themed = (cookie: string | null) =>
    renderToStaticMarkup(
      createElement(ConsentManager, {
        tracking,
        bannerMessage: '',
        bannerVersion: 1,
        initial: decodeConsent(cookie),
        appearance,
      }),
    )

  it('asks in the section look, with the same gating, and only once', () => {
    const html = themed(null)
    expect(html).toContain('cookie-banner--right')
    expect(html).toContain('Yes please')
    expect(html.match(/aria-label="Cookie consent"/g)).toHaveLength(1)
    expect(html).not.toContain('data-testid="beacon"')
    expect(html).toContain('data-ga4="" data-gtm="" data-pixel=""')
  })

  it('stays away once the shopper has answered', () => {
    const html = themed(encodeConsent({ analytics: true, marketing: false }, 1, AT))
    expect(html).not.toContain('aria-label="Cookie consent"')
    expect(html).toContain('data-testid="beacon"')
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

describe('the Pixels app', () => {
  const pixels = [{ id: '9876543210', events: ['PageView' as const], browserPurchase: true }]
  const renderWith = (cookie: string | null) =>
    renderToStaticMarkup(
      createElement(ConsentManager, {
        tracking,
        bannerMessage: '',
        bannerVersion: 1,
        initial: decodeConsent(cookie),
        pixels,
      }),
    )

  it('loads its pixels and events only after a yes to marketing, and drops the old pixel', () => {
    const analyticsOnly = renderWith(encodeConsent({ analytics: true, marketing: false }, 1, AT))
    expect(analyticsOnly).toContain('data-pixel="" data-pixels=""')
    expect(analyticsOnly).not.toContain('data-testid="pixel-events"')
    const yes = renderWith(encodeConsent({ analytics: false, marketing: true }, 1, AT))
    expect(yes).toContain('data-pixel="" data-pixels="9876543210"')
    expect(yes).toContain('data-testid="pixel-events"')
  })
})
