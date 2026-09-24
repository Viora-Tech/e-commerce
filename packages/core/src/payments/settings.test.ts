import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from '../secrets'
import {
  builtInPaymentRegistry,
  decryptPaymentSettings,
  encryptPaymentSettings,
  maskPaymentSettings,
  parsePaymentSettings,
  resolvePaymentProviders,
} from './settings'

const secret = 'test-settings-secret'

describe('secrets', () => {
  it('round-trips and never repeats ciphertext', () => {
    const a = encryptSecret('rzp_secret_123', secret)
    const b = encryptSecret('rzp_secret_123', secret)
    expect(a).not.toBe(b)
    expect(decryptSecret(a, secret)).toBe('rzp_secret_123')
    expect(() => decryptSecret(a, 'wrong')).toThrow()
  })
})

describe('payment settings', () => {
  const settings = parsePaymentSettings({
    enabled: ['cod', 'razorpay'],
    providers: { razorpay: { keyId: 'rzp_test_x', keySecret: 's3cret', webhookSecret: 'wh' } },
  })

  it('encrypts only secret-looking fields and masks them for the UI', () => {
    const enc = encryptPaymentSettings(settings, secret)
    expect(enc.providers.razorpay?.keyId).toBe('rzp_test_x')
    expect(enc.providers.razorpay?.keySecret).toMatch(/^v1\./)
    expect(enc.providers.razorpay?.webhookSecret).toMatch(/^v1\./)
    expect(decryptPaymentSettings(enc, secret)).toEqual(settings)
    expect(maskPaymentSettings(settings).providers.razorpay?.keySecret).toBe('••••cret')
    // Encrypting twice must not double-encrypt.
    expect(encryptPaymentSettings(enc, secret)).toEqual(enc)
  })

  it('resolves built-ins without config and reports unknown providers', () => {
    const r = resolvePaymentProviders(builtInPaymentRegistry(), settings, secret)
    expect(r.providers.map((p) => p.id)).toEqual(['cod'])
    expect(r.errors).toEqual(['razorpay: unknown payment provider: razorpay'])
  })

  it('resolves the manual method only when it has UPI or bank details', () => {
    const bad = parsePaymentSettings({
      enabled: ['manual'],
      providers: { manual: { upiId: 'x@y' } },
    })
    expect(resolvePaymentProviders(builtInPaymentRegistry(), bad, secret).errors).toHaveLength(1)
    const good = parsePaymentSettings({
      enabled: ['manual'],
      providers: { manual: { upiId: 'waimers@hdfcbank', payeeName: 'Waimers' } },
    })
    const r = resolvePaymentProviders(builtInPaymentRegistry(), good, secret)
    expect(r.providers.map((p) => p.id)).toEqual(['manual'])
  })

  it('falls back to COD only when settings are missing', () => {
    expect(parsePaymentSettings(null)).toEqual({
      enabled: ['cod'],
      providers: {},
      adjustments: {},
      expireUnpaidAfterMinutes: 30,
      manualCancelAfterHours: 0,
    })
  })

  it('leaves auto-cancel of unpaid transfer orders off unless the store turns it on', () => {
    expect(parsePaymentSettings({ enabled: ['manual'] }).manualCancelAfterHours).toBe(0)
    expect(parsePaymentSettings({ manualCancelAfterHours: 48 }).manualCancelAfterHours).toBe(48)
  })

  it('expires unpaid online orders after 30 minutes unless the store says otherwise', () => {
    expect(parsePaymentSettings({ enabled: ['cod'] }).expireUnpaidAfterMinutes).toBe(30)
    expect(parsePaymentSettings({ expireUnpaidAfterMinutes: 0 }).expireUnpaidAfterMinutes).toBe(0)
    expect(parsePaymentSettings({ expireUnpaidAfterMinutes: -5 }).expireUnpaidAfterMinutes).toBe(30)
  })
})
