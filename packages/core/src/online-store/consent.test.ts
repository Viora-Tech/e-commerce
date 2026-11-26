import { describe, expect, it } from 'vitest'
import { parseCustomerPrivacySettings } from '../privacy/client'
import {
  bannerAsks,
  CONSENT_REQUIRED_COUNTRIES,
  consentRegion,
  consentRequiredIn,
  decodeConsent,
  effectiveConsent,
  encodeConsent,
  IMPLIED_CONSENT,
} from './consent'

const AT = new Date('2026-11-26T10:00:00Z')
const stored = (analytics: boolean, marketing: boolean, version = 1) =>
  decodeConsent(encodeConsent({ analytics, marketing }, version, AT))

describe("consent regions (Shopify's regions requiring consent)", () => {
  it('asks the EU, the EEA, the UK and Switzerland, and nobody else', () => {
    for (const c of ['DE', 'FR', 'IE', 'NO', 'IS', 'LI', 'GB', 'CH', 'de']) {
      expect(consentRequiredIn(c)).toBe(true)
    }
    for (const c of ['IN', 'US', 'AE', 'SG', 'AU', 'XX', 'T1', '', null, undefined]) {
      expect(consentRequiredIn(c)).toBe(false)
    }
    expect(CONSENT_REQUIRED_COUNTRIES).toHaveLength(32)
  })

  it('treats a visitor as open or asked by the store setting and country', () => {
    expect(consentRegion('consent_required', 'IN')).toBe('open')
    expect(consentRegion('consent_required', null)).toBe('open')
    expect(consentRegion('consent_required', 'DE')).toBe('ask')
    expect(consentRegion('everyone', 'IN')).toBe('ask')
  })

  it('allows everything where it does not ask, unless a no was saved (any banner version)', () => {
    expect(effectiveConsent(null, 1, 'open')).toEqual(IMPLIED_CONSENT)
    expect(effectiveConsent(stored(false, false, 1), 4, 'open')).toEqual({
      analytics: false,
      marketing: false,
    })
    expect(effectiveConsent(stored(true, false), 1, 'open')).toEqual({
      analytics: true,
      marketing: false,
    })
    expect(bannerAsks(null, 1, 'open')).toBe(false)
  })

  it('keeps the opt-in rules where it asks, and allows nothing while pending', () => {
    expect(effectiveConsent(null, 1, 'ask')).toBeNull()
    expect(effectiveConsent(stored(true, true, 1), 2, 'ask')).toBeNull()
    expect(effectiveConsent(stored(true, true, 2), 2, 'ask')).toEqual(IMPLIED_CONSENT)
    expect(bannerAsks(null, 1, 'ask')).toBe(true)
    expect(effectiveConsent(null, 1, 'pending')).toBeNull()
    expect(bannerAsks(null, 1, 'pending')).toBe(false)
  })

  it('defaults every store, old and new, to asking only where consent is required', () => {
    expect(parseCustomerPrivacySettings({}).bannerRegions).toBe('consent_required')
    expect(
      parseCustomerPrivacySettings({ customerPrivacy: { bannerVersion: 3 } }).bannerRegions,
    ).toBe('consent_required')
    expect(
      parseCustomerPrivacySettings({ customerPrivacy: { bannerRegions: 'everyone' } })
        .bannerRegions,
    ).toBe('everyone')
  })
})
