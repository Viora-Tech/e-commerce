import { describe, expect, it } from 'vitest'
import { checkStorefrontPassword, signStorefrontAccess, verifyStorefrontAccess } from './access'
import {
  allowedTags,
  currentConsent,
  decodeConsent,
  defaultPreferences,
  encodeConsent,
  parsePreferences,
  StorePreferencesSchema,
  searchIndexable,
} from './preferences'

describe('store preferences', () => {
  it('defaults everything and survives junk', () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences)
    expect(parsePreferences({ seo: 'x' })).toEqual(defaultPreferences)
    expect(defaultPreferences.password.enabled).toBe(false)
  })

  it('normalises and validates tracking ids', () => {
    const p = StorePreferencesSchema.parse({
      tracking: { ga4: ' g-abc123xyz ', gtm: 'gtm-5x7k9q', metaPixel: '1234567890123' },
    })
    expect(p.tracking).toEqual({
      ga4: 'G-ABC123XYZ',
      gtm: 'GTM-5X7K9Q',
      metaPixel: '1234567890123',
      googleAds: '',
    })
    expect(
      StorePreferencesSchema.parse({ tracking: { googleAds: ' aw-123456789 ' } }).tracking,
    ).toMatchObject({ googleAds: 'AW-123456789' })
    expect(StorePreferencesSchema.safeParse({ tracking: { googleAds: 'G-1234' } }).success).toBe(
      false,
    )
    expect(StorePreferencesSchema.safeParse({ tracking: { ga4: 'UA-1234-1' } }).success).toBe(false)
    expect(StorePreferencesSchema.safeParse({ tracking: { metaPixel: 'abc' } }).success).toBe(false)
  })

  it('needs a real password before protection can be switched on', () => {
    expect(StorePreferencesSchema.safeParse({ password: { enabled: true } }).success).toBe(false)
    expect(
      StorePreferencesSchema.safeParse({ password: { enabled: true, password: 'drop-24' } })
        .success,
    ).toBe(true)
  })

  it('keeps a store out of search when indexing is off or the password page is on', () => {
    expect(defaultPreferences.indexing).toEqual({ searchEngines: true, aiCrawlers: true })
    expect(searchIndexable(defaultPreferences)).toBe(true)
    const off = StorePreferencesSchema.parse({ indexing: { searchEngines: false } })
    expect(searchIndexable(off)).toBe(false)
    expect(off.indexing.aiCrawlers).toBe(true)
    const locked = StorePreferencesSchema.parse({
      password: { enabled: true, password: 'drop-24' },
    })
    expect(searchIndexable(locked)).toBe(false)
  })

  it('keeps the content of a pasted verification meta tag', () => {
    const p = StorePreferencesSchema.parse({
      verification: {
        google: '<meta name="google-site-verification" content="abc_DEF-123456" />',
        meta: ' x9y8z7w6v5 ',
      },
    })
    expect(p.verification).toEqual({
      google: 'abc_DEF-123456',
      bing: '',
      meta: 'x9y8z7w6v5',
      pinterest: '',
    })
    expect(StorePreferencesSchema.safeParse({ verification: { bing: '"><script>' } }).success).toBe(
      false,
    )
  })

  it('holds every tag until the shopper allows its category', () => {
    const prefs = StorePreferencesSchema.parse({
      tracking: {
        ga4: 'G-ABC1234',
        gtm: 'GTM-5X7K9Q',
        metaPixel: '1234567890',
        googleAds: 'AW-123456789',
      },
    })
    const none = { ga4: null, gtm: null, metaPixel: null, googleAds: null }
    expect(allowedTags(prefs, null)).toEqual(none)
    expect(allowedTags(prefs, { analytics: false, marketing: false })).toEqual(none)
    expect(allowedTags(prefs, { analytics: true, marketing: false })).toEqual({
      ...none,
      ga4: 'G-ABC1234',
      gtm: 'GTM-5X7K9Q',
    })
    expect(allowedTags(prefs, { analytics: false, marketing: true })).toEqual({
      ...none,
      metaPixel: '1234567890',
      googleAds: 'AW-123456789',
    })
  })

  it('round-trips the consent cookie with its banner version and time', () => {
    const at = new Date('2026-09-27T10:00:00Z')
    const raw = encodeConsent({ analytics: true, marketing: false }, 3, at)
    expect(raw).toBe('a1m0.v3.t1790503200')
    expect(decodeConsent(raw)).toEqual({
      analytics: true,
      marketing: false,
      version: 3,
      at: 1790503200,
    })
    expect(decodeConsent('a0m1')).toEqual({ analytics: false, marketing: true, version: 0, at: 0 })
    expect(decodeConsent('garbage')).toBeNull()
    expect(decodeConsent('a1m1.v1')).toBeNull()
  })

  it('asks again when the banner version moved on', () => {
    const stored = decodeConsent('a1m1.v1.t1790000000')
    expect(currentConsent(stored, 1)).toEqual({ analytics: true, marketing: true })
    expect(currentConsent(stored, 2)).toBeNull()
    expect(currentConsent(decodeConsent('a1m1'), 1)).toBeNull()
    expect(currentConsent(null, 1)).toBeNull()
  })
})

describe('storefront access pass', () => {
  const secret = 'test-secret'
  const storeId = 'store-1'

  it('accepts the right password and a fresh pass, and signs out when the password changes', () => {
    expect(checkStorefrontPassword('drop-24', ' drop-24 ')).toBe(true)
    expect(checkStorefrontPassword('drop-24', 'drop-25')).toBe(false)
    expect(checkStorefrontPassword('', '')).toBe(false)
    const token = signStorefrontAccess({ secret, storeId, password: 'drop-24' })
    expect(verifyStorefrontAccess({ secret, storeId, password: 'drop-24', token })).toBe(true)
    expect(verifyStorefrontAccess({ secret, storeId, password: 'new-pass', token })).toBe(false)
    expect(verifyStorefrontAccess({ secret, storeId: 'other', password: 'drop-24', token })).toBe(
      false,
    )
    expect(verifyStorefrontAccess({ secret, storeId, password: 'drop-24', token: null })).toBe(
      false,
    )
  })
})
