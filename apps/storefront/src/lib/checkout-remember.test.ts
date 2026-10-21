import { describe, expect, it } from 'vitest'
import {
  hasContact,
  parseRemembered,
  REMEMBER_MS,
  type RememberedDetails,
  serialiseRemembered,
} from './checkout-remember'

const details: RememberedDetails = {
  name: 'Asha Verma',
  email: 'asha@example.com',
  phone: '9876543210',
  line1: '14 Rajpath Colony',
  line2: '',
  city: 'Jaipur',
  stateCode: 'RJ',
  pincode: '302001',
}

describe('remembered guest details', () => {
  it('round-trips while fresh', () => {
    expect(parseRemembered(serialiseRemembered(details, 1_000), 2_000)).toEqual(details)
  })

  it('keeps only contact and address fields', () => {
    const raw = serialiseRemembered(
      { ...details, gstin: '29ABCDE1234F1Z5' } as RememberedDetails,
      0,
    )
    expect(JSON.parse(raw)).not.toHaveProperty('gstin')
  })

  it('drops details older than 90 days', () => {
    expect(parseRemembered(serialiseRemembered(details, 0), REMEMBER_MS + 1)).toBeNull()
  })

  it('rejects malformed or missing data', () => {
    expect(parseRemembered(null, 0)).toBeNull()
    expect(parseRemembered('{not json', 0)).toBeNull()
    expect(parseRemembered(JSON.stringify({ ...details }), 0)).toBeNull()
    expect(parseRemembered(JSON.stringify({ ...details, city: 7, savedAt: 0 }), 0)).toBeNull()
  })

  it('is worth keeping only with an email or phone', () => {
    expect(hasContact(details)).toBe(true)
    expect(hasContact({ ...details, email: ' ', phone: '' })).toBe(false)
  })
})
