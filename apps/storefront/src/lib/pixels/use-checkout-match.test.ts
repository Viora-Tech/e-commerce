import { describe, expect, it } from 'vitest'
import { checkoutMatchFacts } from './use-checkout-match'

const empty = {
  email: '',
  phone: '',
  name: '',
  city: '',
  stateCode: 'HR',
  pincode: '',
  countryCode: 'IN',
}

describe('checkout facts for advanced matching', () => {
  it('nothing before an email or phone is typed (the form defaults are not the shopper)', () => {
    expect(checkoutMatchFacts(empty, null)).toBeNull()
    expect(checkoutMatchFacts({ ...empty, name: 'Asha' }, null)).toBeNull()
  })

  it('the default state is left out until a PIN code is in', () => {
    const typed = { ...empty, email: 'a@b.in', name: 'Asha', lastName: 'Rao' }
    expect(checkoutMatchFacts(typed, 'c1')).toMatchObject({
      email: 'a@b.in',
      name: 'Asha Rao',
      state: null,
      externalId: 'c1',
    })
    expect(checkoutMatchFacts({ ...typed, pincode: '411001', stateCode: 'MH' }, null)?.state).toBe(
      'MH',
    )
  })
})
