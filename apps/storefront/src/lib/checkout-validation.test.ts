import { describe, expect, it } from 'vitest'
import { checkoutFieldErrors, cleanPincode, fieldOrder } from './checkout-validation'

const valid = {
  email: 'asha@example.com',
  phone: '+91 98765 43210',
  pincode: '110 001',
  name: 'Asha Verma',
  line1: '14 Janpath Road',
  city: 'New Delhi',
  stateCode: 'DL',
  gstin: '',
}
const rules = { emailRequired: true, gstin: false }

describe('checkoutFieldErrors', () => {
  it('passes a complete Indian address', () => {
    expect(checkoutFieldErrors(valid, rules)).toEqual({})
  })

  it('says what each empty field needs', () => {
    const errors = checkoutFieldErrors(
      { ...valid, email: '', phone: '', pincode: '', name: ' ', line1: '', city: '' },
      rules,
    )
    expect(Object.keys(errors).sort()).toEqual([
      'city',
      'email',
      'line1',
      'name',
      'phone',
      'pincode',
    ])
  })

  it('lets email be empty when the store made it optional, but still checks a typed one', () => {
    expect(
      checkoutFieldErrors({ ...valid, email: '' }, { ...rules, emailRequired: false }),
    ).toEqual({})
    expect(
      checkoutFieldErrors({ ...valid, email: 'asha@' }, { ...rules, emailRequired: false }).email,
    ).toBeDefined()
  })

  it('refuses a state the PIN code cannot be in, as placeOrder does', () => {
    expect(checkoutFieldErrors({ ...valid, stateCode: 'MH' }, rules).stateCode).toContain('110001')
  })

  it('checks a GSTIN only when the shopper opened the business fields', () => {
    const typo = { ...valid, gstin: '06AAACW1234A1Z4' }
    expect(checkoutFieldErrors(typo, rules).gstin).toBeUndefined()
    expect(checkoutFieldErrors(typo, { ...rules, gstin: true }).gstin).toBeDefined()
  })

  it('reads PIN codes typed with spaces or dashes', () => {
    expect(cleanPincode('110-001')).toBe('110001')
  })

  it('orders fields the way the form shows them', () => {
    expect(fieldOrder(true).slice(0, 3)).toEqual(['phone', 'email', 'pincode'])
    expect(fieldOrder(false).at(-2)).toBe('pincode')
  })
})
