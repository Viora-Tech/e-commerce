import { describe, expect, it } from 'vitest'
import { ADDRESS_ROLES, flagsFor, roleOf, splitAddressBook } from './address-roles'
import type { CustomerAddressRow } from './customer-detail-types'

function row(id: string, isDefault = false, isDefaultBilling = false): CustomerAddressRow {
  return {
    id,
    name: id,
    line1: '1 Road',
    line2: null,
    city: 'Jaipur',
    stateCode: 'RJ',
    pincode: '302001',
    phone: '9876543210',
    label: null,
    isDefault,
    isDefaultBilling,
    businessName: null,
    gstin: null,
  }
}

describe('roleOf / flagsFor', () => {
  it('reads each role from the two flags', () => {
    expect(roleOf(row('a', true, true))).toBe('both')
    expect(roleOf(row('a', true))).toBe('shipping')
    expect(roleOf(row('a', false, true))).toBe('billing')
    expect(roleOf(row('a'))).toBeNull()
  })

  it('round-trips every role', () => {
    for (const role of [...ADDRESS_ROLES, null]) expect(roleOf(flagsFor(role))).toBe(role)
  })
})

describe('splitAddressBook', () => {
  it('shows billing as same as shipping when no address is the billing one', () => {
    const book = splitAddressBook([row('s', true), row('o')])
    expect(book.shipping?.id).toBe('s')
    expect(book.billing).toBeNull()
    expect(book.others.map((r) => r.id)).toEqual(['o'])
  })

  it('treats an address used for both as shipping with billing the same', () => {
    const book = splitAddressBook([row('o'), row('s', true, true)])
    expect(book.shipping?.id).toBe('s')
    expect(book.billing).toBeNull()
    expect(book.others.map((r) => r.id)).toEqual(['o'])
  })

  it('pulls out a separate billing address', () => {
    const book = splitAddressBook([row('s', true), row('b', false, true), row('o')])
    expect(book.shipping?.id).toBe('s')
    expect(book.billing?.id).toBe('b')
    expect(book.others.map((r) => r.id)).toEqual(['o'])
  })

  it('handles an empty book', () => {
    expect(splitAddressBook([])).toEqual({ shipping: null, billing: null, others: [] })
  })
})
