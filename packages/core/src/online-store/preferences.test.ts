import { describe, expect, it } from 'vitest'
import { checkStorefrontPassword, signStorefrontAccess, verifyStorefrontAccess } from './access'
import {
  allowedTags,
  decodeConsent,
  defaultPreferences,
  encodeConsent,
  parsePreferences,
  StorePreferencesSchema,
} from './preferences'

describe('store preferences', () => {
  it('defaults everything and survives junk', () => {
    expect(parsePreferences(null)).toEqual(defaultPreferences)
    expect(parsePreferences({ seo: 'x' })).toEqual(defaultPreferences)
    expect(defaultPreferences.password.enabled).toBe(false)
    expect(defaultPreferences.privacy.bannerEnabled).toBe(true)
  })

  it('normalises and validates tracking ids', () => {
    const p = StorePreferencesSchema.parse({
      tracking: { ga4: ' g-abc123xyz ', gtm: 'gtm-5x7k9q', metaPixel: '1234567890123' },
    })
    expect(p.tracking).toEqual({
      ga4: 'G-ABC123XYZ',
      gtm: 'GTM-5X7K9Q',
      metaPixel: '1234567890123',
    })
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

  it('holds tags until consent when the banner is on, and loads them when it is off', () => {
    const prefs = StorePreferencesSchema.parse({
      tracking: { ga4: 'G-ABC1234', metaPixel: '1234567890' },
    })
    expect(allowedTags(prefs, null)).toEqual({ ga4: null, gtm: null, metaPixel: null })
    expect(allowedTags(prefs, { analytics: true, marketing: false })).toEqual({
      ga4: 'G-ABC1234',
      gtm: null,
      metaPixel: null,
    })
    const noBanner = { ...prefs, privacy: { ...prefs.privacy, bannerEnabled: false } }
    expect(allowedTags(noBanner, null).metaPixel).toBe('1234567890')
  })

  it('round-trips the consent cookie', () => {
    const c = { analytics: true, marketing: false }
    expect(decodeConsent(encodeConsent(c))).toEqual(c)
    expect(decodeConsent('garbage')).toBeNull()
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
