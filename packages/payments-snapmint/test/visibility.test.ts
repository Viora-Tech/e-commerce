import { describe, expect, it } from 'vitest'
import { buildSnapmintVisibility, readSnapmintVisibility } from '../src/visibility'

const shipping = {
  name: 'Asha Rani Verma',
  line1: 'Flat 4',
  line2: 'MG Road',
  city: 'Pune',
  state: 'MH',
  stateName: 'Maharashtra',
  postalCode: '411 001',
  country: 'IN',
}

describe('buildSnapmintVisibility', () => {
  it('maps the shopper, keeps a middle name with the first, and sends rupees', () => {
    const r = buildSnapmintVisibility({
      amountPaise: 123450,
      customer: { name: 'Asha Rani Verma', phone: '+91 98765 43210', ip: '203.0.113.7' },
      shipping,
    })
    expect(r).toEqual({
      ip: '203.0.113.7',
      body: {
        mobile: '9876543210',
        firstName: 'Asha Rani',
        lastName: 'Verma',
        orderValue: 1234.5,
        payload: {},
        shippingAddress: {
          addressLine1: 'Flat 4',
          addressLine2: 'MG Road',
          zip: 411001,
          city: 'Pune',
          state: 'Maharashtra',
        },
        billingAddress: {
          addressLine1: 'Flat 4',
          addressLine2: 'MG Road',
          zip: 411001,
          city: 'Pune',
          state: 'Maharashtra',
        },
      },
    })
  })

  it('leaves out addresses and the IP it does not have', () => {
    const r = buildSnapmintVisibility({
      amountPaise: 5_00_000_00,
      customer: { name: 'Asha', phone: '9876543210', ip: 'unknown' },
    })
    expect(r?.ip).toBeNull()
    expect(r?.body).toEqual({
      mobile: '9876543210',
      firstName: 'Asha',
      lastName: '',
      orderValue: 10000,
      payload: {},
    })
  })

  it('is null without a 10-digit Indian mobile', () => {
    expect(buildSnapmintVisibility({ amountPaise: 100, customer: { phone: '12345' } })).toBeNull()
  })
})

describe('readSnapmintVisibility', () => {
  it('reads a bare boolean or a known key, at the top or under data', () => {
    expect(readSnapmintVisibility(true)).toBe(true)
    expect(readSnapmintVisibility(false)).toBe(false)
    expect(readSnapmintVisibility('false')).toBe(false)
    expect(readSnapmintVisibility({ visible: false })).toBe(false)
    expect(readSnapmintVisibility({ eligible: 'true' })).toBe(true)
    expect(readSnapmintVisibility({ isEligible: false })).toBe(false)
    expect(readSnapmintVisibility({ status: 'success', data: { is_eligible: false } })).toBe(false)
    expect(readSnapmintVisibility({ data: false })).toBe(false)
  })

  it('is null for anything else', () => {
    expect(readSnapmintVisibility(null)).toBeNull()
    expect(readSnapmintVisibility({})).toBeNull()
    expect(readSnapmintVisibility([true])).toBeNull()
    expect(readSnapmintVisibility({ data: { data: { visible: true } } })).toBeNull()
    expect(readSnapmintVisibility({ visible: 'maybe' })).toBeNull()
  })
})
