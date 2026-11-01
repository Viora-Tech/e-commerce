import { describe, expect, it } from 'vitest'
import { phoneForCountry, prefillCheckout } from './checkout-form-state'

describe('phoneForCountry', () => {
  it('gives a saved Indian number its +91 abroad, so it is not read as the new country', () => {
    expect(phoneForCountry('98765 00001', 'AE')).toBe('+919876500001')
  })
  it('drops the +91 back home', () => {
    expect(phoneForCountry('+919876500001', 'IN')).toBe('9876500001')
  })
  it('leaves a number that already carries another code alone', () => {
    expect(phoneForCountry('+971501234567', 'AE')).toBe('+971501234567')
    expect(phoneForCountry('+971501234567', 'IN')).toBe('+971501234567')
  })
})

describe('prefillCheckout', () => {
  it('opens a new address in the given country with the phone in its form', () => {
    const form = prefillCheckout(null, undefined, 'full', 'AE')
    expect(form.countryCode).toBe('AE')
  })
})
