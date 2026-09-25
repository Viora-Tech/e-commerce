/** SOURCE OF TRUTH: customer phone encryption tests — round-trips and blind-index behaviour */
import { describe, expect, it } from 'vitest'
import {
  decryptCustomerPhone,
  encryptCustomerPhone,
  normalisePhoneDigits,
  phoneBlindIndex,
} from './phone-crypto'

const secret = 'test-only-settings-secret-value'

describe('normalisePhoneDigits', () => {
  it('strips everything but digits', () => {
    expect(normalisePhoneDigits('+91 98765-43210')).toBe('919876543210')
  })
})

describe('phoneBlindIndex', () => {
  it('is deterministic for equivalent formatting', () => {
    expect(phoneBlindIndex('+91 98765 43210', secret)).toBe(
      phoneBlindIndex('9198765 43210', secret),
    )
  })

  it('differs for different phones', () => {
    expect(phoneBlindIndex('9876543210', secret)).not.toBe(phoneBlindIndex('9876543211', secret))
  })

  it('differs under a different key', () => {
    expect(phoneBlindIndex('9876543210', secret)).not.toBe(
      phoneBlindIndex('9876543210', 'a-different-settings-secret'),
    )
  })
})

describe('encryptCustomerPhone / decryptCustomerPhone', () => {
  it('round-trips', () => {
    const { cipher, index } = encryptCustomerPhone('9876543210', secret)
    expect(cipher).not.toBe('9876543210')
    expect(decryptCustomerPhone(cipher, secret)).toBe('9876543210')
    expect(index).toBe(phoneBlindIndex('9876543210', secret))
  })

  it('decrypts under a previous key during rotation', () => {
    const previous = 'old-settings-secret-value'
    const { cipher } = encryptCustomerPhone('9876543210', previous)
    expect(decryptCustomerPhone(cipher, secret, [previous])).toBe('9876543210')
  })

  it('passes plaintext through unchanged (pre-backfill rows)', () => {
    expect(decryptCustomerPhone('9876543210', secret)).toBe('9876543210')
  })

  it('passes null/undefined through', () => {
    expect(decryptCustomerPhone(null, secret)).toBeNull()
    expect(decryptCustomerPhone(undefined, secret)).toBeNull()
  })

  it('returns null rather than throwing when no key in the ring matches', () => {
    const { cipher } = encryptCustomerPhone('9876543210', 'yet-another-secret')
    expect(decryptCustomerPhone(cipher, secret)).toBeNull()
  })
})
