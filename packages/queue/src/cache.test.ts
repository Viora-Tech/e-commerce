import { courierSettingsFingerprint } from '@commerce/core/courier-fingerprint'
import { describe, expect, it } from 'vitest'
import { serviceabilityKey } from './cache'

describe('serviceabilityKey', () => {
  const saved = { apiKey: 'enc:v1:aaa', customerCode: 'GL017' }

  it('is the same for the same courier settings', () => {
    expect(serviceabilityKey('s1', 'dtdc', { ...saved }, '560001')).toBe(
      serviceabilityKey('s1', 'dtdc', { ...saved }, '560001'),
    )
  })

  it('misses after the courier settings change (new credentials or account)', () => {
    const before = serviceabilityKey('s1', 'dtdc', saved, '560001')
    expect(serviceabilityKey('s1', 'dtdc', { ...saved, apiKey: 'enc:v1:bbb' }, '560001')).not.toBe(
      before,
    )
    expect(serviceabilityKey('s1', 'dtdc', { ...saved, customerCode: 'GL018' }, '560001')).not.toBe(
      before,
    )
  })

  it('never puts a credential in the key', () => {
    const key = serviceabilityKey('s1', 'dtdc', { apiKey: 'plain-secret' }, '560001')
    expect(key).not.toContain('plain-secret')
    expect(key).toContain(courierSettingsFingerprint({ apiKey: 'plain-secret' }))
    expect(key.endsWith(':560001')).toBe(true)
  })
})
