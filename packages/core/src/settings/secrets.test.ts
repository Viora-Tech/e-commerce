/** SOURCE OF TRUTH: provider settings secrets tests — flagged-field encryption and masking */
import { describe, expect, it } from 'vitest'
import {
  decryptProviderSettings,
  encryptProviderSettings,
  isMaskedSecret,
  maskProviderSettings,
  type ProviderSettings,
  type SecretFieldLookup,
} from './secrets'

const secret = 'test-only-settings-secret-value'

const fieldsOf: SecretFieldLookup = (id) =>
  id === 'razorpay'
    ? [
        { key: 'keyId', secret: false },
        { key: 'keySecret', secret: true },
      ]
    : undefined

const settings: ProviderSettings = {
  enabled: ['razorpay'],
  providers: { razorpay: { keyId: 'rzp_live_abc', keySecret: 'super-secret-value' } },
}

describe('encryptProviderSettings / decryptProviderSettings', () => {
  it('encrypts only fields flagged secret: true, round-trips the rest untouched', () => {
    const enc = encryptProviderSettings(settings, secret, fieldsOf)
    expect(enc.providers.razorpay?.keyId).toBe('rzp_live_abc')
    expect(enc.providers.razorpay?.keySecret).not.toBe('super-secret-value')
    expect(enc.providers.razorpay?.keySecret?.startsWith('v2.')).toBe(true)

    const dec = decryptProviderSettings(enc, secret)
    expect(dec).toEqual(settings)
  })

  it('falls back to the name regex (secret/token/password) when no field lookup is given', () => {
    const s: ProviderSettings = {
      enabled: ['x'],
      providers: { x: { apiToken: 'raw-token', label: 'unaffected' } },
    }
    const enc = encryptProviderSettings(s, secret)
    expect(enc.providers.x?.apiToken).not.toBe('raw-token')
    expect(enc.providers.x?.label).toBe('unaffected')
  })

  it('does not double-encrypt an already-encrypted value', () => {
    const once = encryptProviderSettings(settings, secret, fieldsOf)
    const twice = encryptProviderSettings(once, secret, fieldsOf)
    expect(twice).toEqual(once)
  })

  it('decrypts under a previous key during rotation', () => {
    const oldSecret = 'old-settings-secret-value'
    const enc = encryptProviderSettings(settings, oldSecret, fieldsOf)
    const dec = decryptProviderSettings(enc, secret, [oldSecret])
    expect(dec).toEqual(settings)
  })
})

describe('maskProviderSettings', () => {
  it('keeps only the last 4 characters of a secret field', () => {
    const masked = maskProviderSettings(settings, fieldsOf)
    expect(masked.providers.razorpay?.keyId).toBe('rzp_live_abc')
    expect(masked.providers.razorpay?.keySecret).toBe('••••alue')
    expect(isMaskedSecret(masked.providers.razorpay?.keySecret)).toBe(true)
  })
})
