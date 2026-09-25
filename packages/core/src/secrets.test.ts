/** SOURCE OF TRUTH: secrets at rest tests — AES-256-GCM round-trips and key rotation */
import { describe, expect, it } from 'vitest'
import {
  decryptSecret,
  encryptSecret,
  isEncrypted,
  isLegacyEncrypted,
  keyId,
  parsePreviousSecrets,
} from './secrets'

const secret = 'test-only-settings-secret-value'

describe('encryptSecret / decryptSecret (v2)', () => {
  it('round-trips', () => {
    const enc = encryptSecret('sk_live_abc123', secret)
    expect(enc.startsWith('v2.')).toBe(true)
    expect(decryptSecret(enc, secret)).toBe('sk_live_abc123')
  })

  it('stamps the current key id so the right key is picked without brute force', () => {
    const enc = encryptSecret('hello', secret)
    expect(enc.split('.')[1]).toBe(keyId(secret))
  })

  it('two encryptions of the same plaintext differ (random iv)', () => {
    expect(encryptSecret('same', secret)).not.toBe(encryptSecret('same', secret))
  })

  it('fails to decrypt under a key not in the ring', () => {
    const enc = encryptSecret('hello', secret)
    expect(() => decryptSecret(enc, 'a-different-secret-value-here')).toThrow()
  })
})

describe('rotation keyring', () => {
  it('decrypts a v2 blob written under a previous key once it is passed as previousSecrets', () => {
    const oldSecret = 'old-settings-secret-value'
    const enc = encryptSecret('token-123', oldSecret)
    expect(() => decryptSecret(enc, secret)).toThrow()
    expect(decryptSecret(enc, secret, [oldSecret])).toBe('token-123')
  })

  it('decrypts v1 (legacy, no key id) blobs by trying every key in the ring', () => {
    // v1 has no key id, so simulate it directly against the same AES-GCM primitives v2 uses.
    const legacy = encryptSecret('legacy-value', secret).replace(/^v2\.[0-9a-f]{8}\./, 'v1.')
    expect(isLegacyEncrypted(legacy)).toBe(true)
    expect(decryptSecret(legacy, secret)).toBe('legacy-value')
  })

  it('parsePreviousSecrets splits, trims and drops blanks', () => {
    expect(parsePreviousSecrets(' a , b ,,c')).toEqual(['a', 'b', 'c'])
    expect(parsePreviousSecrets(undefined)).toEqual([])
    expect(parsePreviousSecrets('')).toEqual([])
  })
})

describe('isEncrypted', () => {
  it('recognises v1 and v2 blobs, not plaintext', () => {
    expect(isEncrypted(encryptSecret('x', secret))).toBe(true)
    expect(isEncrypted('plain-value')).toBe(false)
    expect(isEncrypted(null)).toBe(false)
    expect(isEncrypted(undefined)).toBe(false)
  })
})
