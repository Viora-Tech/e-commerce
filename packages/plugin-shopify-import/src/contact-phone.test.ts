import { describe, expect, it } from 'vitest'
import { mapCustomer } from './api-customers'
import { contactPhoneOf } from './write-customers'

const gCustomer = (phone: string | null, addressPhone: string | null) => ({
  id: 'gid://shopify/Customer/1',
  email: 'ragavanrejish@gmail.com',
  phone,
  firstName: 'Rejish',
  lastName: 'Ragavan',
  tags: [],
  note: null,
  createdAt: null,
  emailMarketingConsent: null,
  smsMarketingConsent: null,
  defaultAddress: {
    firstName: 'Rejish',
    lastName: 'Ragavan',
    company: null,
    address1: 'VIT, Katpadi',
    address2: null,
    city: 'Vellore',
    province: 'Tamil Nadu',
    provinceCode: 'TN',
    countryCodeV2: 'IN',
    zip: '632014',
    phone: addressPhone,
  },
})

describe('contact phone on a Shopify customer import (issue #810)', () => {
  it('uses the customer phone first', () => {
    expect(contactPhoneOf(mapCustomer(gCustomer('+919800000001', '+917904115879')))).toBe(
      '+919800000001',
    )
  })

  it('falls back to the default address phone, without using it to match', () => {
    const mapped = mapCustomer(gCustomer(null, '+917904115879'))
    expect(contactPhoneOf(mapped)).toBe('+917904115879')
    // Matching stays on Shopify's customer phone, so a shared address number merges no one.
    expect(mapped.phone).toBeNull()
  })

  it('has none when Shopify has none', () => {
    expect(contactPhoneOf(mapCustomer(gCustomer(null, null)))).toBeNull()
  })
})
