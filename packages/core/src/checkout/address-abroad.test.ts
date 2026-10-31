/** SOURCE OF TRUTH: checkout addresses abroad tests — WHAT: address and phone checks for an international order / WHY: guard the international checkout rules */
import { describe, expect, it } from 'vitest'
import {
  abroadAddressErrors,
  abroadPhone,
  abroadRegion,
  checkoutCountries,
  defaultCheckoutCountry,
  isAbroad,
  postalCodeProblem,
  taxRegimeFor,
} from './address-abroad'

const messages = {
  postcode: 'missing',
  postcodeInvalid: 'invalid',
  region: 'region',
  regionInvalid: 'regionInvalid',
}

describe('checkout addresses abroad', () => {
  it('treats a missing or Indian country as home', () => {
    expect(isAbroad(undefined)).toBe(false)
    expect(isAbroad('in')).toBe(false)
    expect(isAbroad('au')).toBe(true)
  })

  it('offers India, then the countries the zones name, or the world for Rest of world', () => {
    expect(checkoutCountries([['US', 'ca'], ['IN']])).toEqual(['IN', 'CA', 'US'])
    expect(checkoutCountries([['*']]).length).toBeGreaterThan(200)
    expect(defaultCheckoutCountry('AE', ['IN', 'US'])).toBe('IN')
    expect(defaultCheckoutCountry('us', ['IN', 'US'])).toBe('US')
  })

  it('checks postcodes loosely per country', () => {
    expect(postalCodeProblem('US', '94105')).toBeNull()
    expect(postalCodeProblem('US', '9410')).toBe('invalid')
    expect(postalCodeProblem('GB', 'sw1a 1aa')).toBeNull()
    expect(postalCodeProblem('AE', '')).toBeNull()
    expect(postalCodeProblem('BR', '')).toBe('missing')
  })

  it('stores a listed region as its code and a typed one as typed', () => {
    expect(abroadRegion('US', ' california ')).toEqual({ code: 'CA', name: 'California' })
    expect(abroadRegion('CA', 'Québec')).toEqual({ code: 'QC', name: 'Quebec' })
    expect(abroadRegion('AU', 'nsw')).toEqual({ code: 'NSW', name: 'New South Wales' })
    expect(abroadRegion('AE', 'Dubai')).toEqual({ code: 'Dubai', name: 'Dubai' })
    expect(abroadRegion('AE', '  ')).toBeNull()
  })

  it('asks for a region where addresses need one, and a listed one where there is a list', () => {
    expect(
      abroadAddressErrors({ countryCode: 'US', stateCode: '', pincode: '10001' }, messages),
    ).toEqual({ stateCode: 'region' })
    expect(
      abroadAddressErrors({ countryCode: 'US', stateCode: 'Narnia', pincode: '10001' }, messages),
    ).toEqual({ stateCode: 'regionInvalid' })
    expect(
      abroadAddressErrors({ countryCode: 'US', stateCode: 'NY', pincode: '10001' }, messages),
    ).toEqual({})
    expect(
      abroadAddressErrors({ countryCode: 'IN', stateCode: '', pincode: '' }, messages),
    ).toEqual({})
  })

  it('reads a phone abroad in the destination country', () => {
    expect(abroadPhone('0412 345 678', 'AU')).toBe('+61412345678')
    expect(abroadPhone('+91 98765 43210', 'AU')).toBe('+919876543210')
    expect(abroadPhone('abc', 'AU')).toBeNull()
  })

  it('zero-rates exports under a LUT unless the store pays IGST', () => {
    expect(taxRegimeFor('IN', 'lut')).toBe('domestic_gst')
    expect(taxRegimeFor('US', null)).toBe('export_lut')
    expect(taxRegimeFor('US', 'igst')).toBe('export_igst')
  })
})
