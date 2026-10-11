/** SOURCE OF TRUTH: short link rules tests — WHAT: slug, UTM target and bot filter cases / WHY: admin form, API and storefront redirect share these rules */
import { describe, expect, it } from 'vitest'
import { attributionFromVisit } from './attribution'
import {
  isBotUserAgent,
  linkSlug,
  SHORT_LINK_SLUG,
  shortLinkTarget,
  storeDestination,
  tagSummary,
} from './short-links'

const CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36'

describe('short link slugs', () => {
  it('suggests a slug from a name and only accepts lower-case words with hyphens', () => {
    expect(linkSlug('Diwali sale: WhatsApp!')).toBe('diwali-sale-whatsapp')
    expect(SHORT_LINK_SLUG.test('diwali-wa')).toBe(true)
    expect(SHORT_LINK_SLUG.test('-diwali')).toBe(false)
    expect(SHORT_LINK_SLUG.test('Diwali')).toBe(false)
  })
})

describe('storeDestination', () => {
  const hosts = ['waimers.in', 'localhost:3100']
  it('keeps a path, or the path of a full URL on the store', () => {
    expect(storeDestination('/collections/glasspads?sort=new', hosts)).toBe(
      '/collections/glasspads?sort=new',
    )
    expect(storeDestination('https://www.waimers.in/products/aqua', hosts)).toBe('/products/aqua')
    expect(storeDestination('waimers.in/pages/about', hosts)).toBe('/pages/about')
    expect(storeDestination('http://localhost:3100/cart', hosts)).toBe('/cart')
  })

  it('refuses another site and protocol-relative paths', () => {
    expect(storeDestination('https://evil.example/x', hosts)).toBeNull()
    expect(storeDestination('//evil.example/x', hosts)).toBeNull()
    expect(storeDestination('', hosts)).toBeNull()
  })
})

describe('shortLinkTarget', () => {
  it('adds the UTM tags but keeps one already in the destination', () => {
    const url = shortLinkTarget(
      '/collections/glasspads?utm_campaign=kept',
      { utmSource: 'whatsapp', utmMedium: ' message ', utmCampaign: 'diwali', utmTerm: '' },
      'https://waimers.in',
    )
    expect(url.origin).toBe('https://waimers.in')
    expect(url.pathname).toBe('/collections/glasspads')
    expect(url.searchParams.get('utm_source')).toBe('whatsapp')
    expect(url.searchParams.get('utm_medium')).toBe('message')
    expect(url.searchParams.get('utm_campaign')).toBe('kept')
    expect(url.searchParams.has('utm_term')).toBe(false)
  })

  it('never leaves the store', () => {
    expect(shortLinkTarget('//evil.example/x', {}, 'https://waimers.in').href).toBe(
      'https://waimers.in/',
    )
  })

  it('summarises the tags for the table', () => {
    expect(tagSummary({ utmSource: 'whatsapp', utmCampaign: 'diwali' })).toBe(
      'utm_source=whatsapp · utm_campaign=diwali',
    )
  })
})

describe('isBotUserAgent', () => {
  it('lets a phone browser through', () => {
    expect(isBotUserAgent(CHROME)).toBe(false)
    expect(isBotUserAgent(`${CHROME} Instagram 300.0`)).toBe(false)
  })

  it('stops crawlers, link previews, scripts and empty agents', () => {
    for (const ua of [
      'WhatsApp/2.23.20.0 A',
      'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
      'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
      'TelegramBot (like TwitterBot)',
      'Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)',
      'Mozilla/5.0 (Macintosh) SkypeUriPreview Preview/0.5',
      'curl/8.4.0',
      'python-requests/2.31',
      '',
      null,
    ]) {
      expect(isBotUserAgent(ua)).toBe(true)
    }
  })
})

describe('attribution through a short link', () => {
  it('carries the link and is never a direct visit', () => {
    const tagged = attributionFromVisit({
      landingUrl: 'https://waimers.in/?utm_source=whatsapp&utm_medium=message',
      linkId: 'link-1',
    })
    expect(tagged).toMatchObject({ channel: 'whatsapp', linkId: 'link-1' })
    const untagged = attributionFromVisit({ landingUrl: 'https://waimers.in/', linkId: 'link-1' })
    expect(untagged.channel).toBe('referral')
  })
})
