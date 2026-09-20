import { PaymentRegistry } from '@commerce/payments'
import { describe, expect, it } from 'vitest'
import { decryptSecret, encryptSecret } from '../secrets'
import {
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

  it('resolves COD without config and reports misconfigured providers', () => {
    const registry = new PaymentRegistry()
    const r = resolvePaymentProviders(registry, settings, secret)
    expect(r.providers.map((p) => p.id)).toEqual(['cod'])
    expect(r.errors).toEqual(['razorpay: unknown payment provider: razorpay'])
  })

  it('falls back to COD only when settings are missing', () => {
    expect(parsePaymentSettings(null)).toEqual({ enabled: ['cod'], providers: {} })
  })
})
