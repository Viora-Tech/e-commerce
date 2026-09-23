import { describe, expect, it } from 'vitest'
import {
  attributionFromVisit,
  classifyChannel,
  compactAttribution,
  decodeAttribution,
  encodeAttribution,
  hostOf,
  pickAttribution,
} from './attribution'

const now = new Date('2026-09-20T10:00:00Z')

describe('classifyChannel', () => {
  it.each([
    [{ source: 'google', medium: 'cpc' }, 'paid_search'],
    [{ source: 'facebook', medium: 'paid_social' }, 'paid_social'],
    [{ source: 'instagram', medium: 'cpc' }, 'paid_social'],
    [{ source: 'newsletter', medium: 'email' }, 'email'],
    [{ source: 'wa', medium: undefined }, 'whatsapp'],
    [{ source: 'influencer', medium: 'affiliate' }, 'affiliate'],
    [{ source: 'instagram', medium: 'social' }, 'social'],
    [{ source: 'taboola', medium: 'display' }, 'other_paid'],
    [{ source: 'partner-blog', medium: undefined }, 'referral'],
    [{ referrerHost: 'google.co.in' }, 'organic_search'],
    [{ referrerHost: 'l.instagram.com' }, 'social'],
    [{ referrerHost: 'chatgpt.com' }, 'ai_assistant'],
    [{ referrerHost: 'wa.me' }, 'whatsapp'],
    [{ referrerHost: 'mail.google.com' }, 'email'],
    [{ referrerHost: 'someblog.in' }, 'referral'],
    [{ referrerHost: 'instagram.com', clickIds: { fbclid: true } }, 'paid_social'],
    [{ clickIds: { gclid: true } }, 'paid_search'],
    [{}, 'direct'],
  ] as const)('%o is %s', (input, expected) => {
    expect(classifyChannel(input)).toBe(expected)
  })

  it('credits our own tracked links to email or WhatsApp regardless of tags', () => {
    expect(classifyChannel({ marketingMessage: true })).toBe('email')
    expect(classifyChannel({ marketingMessage: true, medium: 'whatsapp' })).toBe('whatsapp')
  })
})

describe('attributionFromVisit', () => {
  it('reads UTM tags and keeps only the landing path and referring host', () => {
    const a = attributionFromVisit({
      landingUrl:
        'https://waimers.in/products/pad?utm_source=instagram&utm_medium=social&utm_campaign=Diwali%20Drop&email=a@b.in',
      referrer: 'https://l.instagram.com/?u=secret',
      storeHost: 'waimers.in',
      now,
    })
    expect(a).toMatchObject({
      channel: 'social',
      source: 'instagram',
      medium: 'social',
      campaign: 'Diwali Drop',
      referrer: 'l.instagram.com',
      landing: '/products/pad',
      at: now.toISOString(),
    })
    expect(JSON.stringify(a)).not.toContain('a@b.in')
  })

  it('ignores the store itself as a referrer', () => {
    const a = attributionFromVisit({
      landingUrl: 'https://waimers.in/cart',
      referrer: 'https://www.waimers.in/products/pad',
      storeHost: 'waimers.in:443',
    })
    expect(a.channel).toBe('direct')
    expect(a.referrer).toBeUndefined()
  })

  it('treats a malformed landing URL as a direct visit', () => {
    expect(attributionFromVisit({ landingUrl: 'not a url' }).channel).toBe('direct')
  })

  it('carries marketing ids from a tracked link', () => {
    const a = attributionFromVisit({
      landingUrl: 'https://waimers.in/?utm_medium=email',
      marketing: { messageId: 'm1', campaignId: 'c1' },
    })
    expect(a).toMatchObject({ channel: 'email', messageId: 'm1', campaignId: 'c1' })
  })
})

describe('pickAttribution', () => {
  const email = attributionFromVisit({
    landingUrl: 'https://s.in/?utm_source=newsletter&utm_medium=email',
    now: new Date('2026-09-10T00:00:00Z'),
  })
  const direct = attributionFromVisit({ landingUrl: 'https://s.in/', now })

  it('keeps the last non-direct touch when the shopper returns directly', () => {
    expect(pickAttribution(direct, email, now)).toBe(email)
  })

  it('lets a new non-direct touch replace the old one', () => {
    const social = { ...direct, channel: 'social' as const }
    expect(pickAttribution(social, email, now)).toBe(social)
  })

  it('drops the old touch once the window has passed', () => {
    expect(pickAttribution(direct, email, new Date('2026-11-01T00:00:00Z'))).toBe(direct)
    expect(pickAttribution(direct, null, now)).toBe(direct)
  })
})

describe('attribution cookie', () => {
  it('round-trips and rejects junk', () => {
    const a = compactAttribution(
      attributionFromVisit({ landingUrl: 'https://s.in/?utm_source=google&utm_medium=cpc', now }),
    )
    expect(decodeAttribution(encodeAttribution(a))).toMatchObject(a)
    expect(decodeAttribution('nope')).toBeNull()
    expect(decodeAttribution(undefined)).toBeNull()
    expect(
      decodeAttribution(
        Buffer.from(JSON.stringify({ channel: 'bogus', at: 'x' })).toString('base64url'),
      ),
    ).toBeNull()
  })

  it('reads hosts only from http(s) URLs', () => {
    expect(hostOf('https://www.Google.com/search')).toBe('google.com')
    expect(hostOf('android-app://com.google')).toBeNull()
    expect(hostOf('')).toBeNull()
  })
})
