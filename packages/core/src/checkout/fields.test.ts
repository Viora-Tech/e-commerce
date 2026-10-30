import { describe, expect, it } from 'vitest'
import {
  addressFieldErrors,
  CheckoutFieldsSchema,
  joinedName,
  keptBusinessName,
  splitFullName,
} from './fields'

const fields = (over: Parameters<typeof CheckoutFieldsSchema.parse>[0] = {}) =>
  CheckoutFieldsSchema.parse(over)

describe('checkout form fields (#154)', () => {
  it('defaults to one full name, line 2 optional and no company name', () => {
    expect(fields()).toEqual({ name: 'full', company: 'hidden', line2: 'optional' })
  })

  it('asks for a full name, or a first and a last name', () => {
    expect(addressFieldErrors(fields(), { name: ' ' })).toEqual({ name: 'Enter your full name' })
    expect(addressFieldErrors(fields(), { name: 'Asha Verma' })).toEqual({})
    expect(addressFieldErrors(fields({ name: 'split' }), { name: '', lastName: '' })).toEqual({
      name: 'Enter your first name',
      lastName: 'Enter your last name',
    })
    expect(
      addressFieldErrors(fields({ name: 'split' }), { name: 'Asha', lastName: 'Verma' }),
    ).toEqual({})
  })

  it('requires line 2 and the company name only when the store says so', () => {
    const input = { name: 'Asha', line2: '', businessName: '' }
    expect(addressFieldErrors(fields({ company: 'optional' }), input)).toEqual({})
    expect(
      Object.keys(addressFieldErrors(fields({ company: 'required', line2: 'required' }), input)),
    ).toEqual(['line2', 'businessName'])
  })

  it('joins and splits names', () => {
    expect(joinedName({ name: 'split' }, { name: ' Asha ', lastName: 'Verma' })).toBe('Asha Verma')
    expect(joinedName({ name: 'full' }, { name: 'Asha Verma', lastName: 'x' })).toBe('Asha Verma')
    expect(splitFullName('Asha Rani Verma')).toEqual({ first: 'Asha Rani', last: 'Verma' })
    expect(splitFullName('Asha')).toEqual({ first: 'Asha', last: '' })
    expect(splitFullName('  ')).toEqual({ first: '', last: '' })
  })

  it('keeps a company name with a GSTIN, or whenever the field is shown', () => {
    expect(keptBusinessName({ company: 'hidden' }, { businessName: 'Acme', hasGstin: false })).toBe(
      null,
    )
    expect(keptBusinessName({ company: 'hidden' }, { businessName: 'Acme', hasGstin: true })).toBe(
      'Acme',
    )
    expect(keptBusinessName({ company: 'optional' }, { businessName: ' ', hasGstin: false })).toBe(
      null,
    )
  })
})
