/** SOURCE OF TRUTH: phone normalisation tests — WHAT: what normalisePhone and isValidPhone accept and return / WHY: Indian numbers without +91 must keep working while other countries are accepted */
import { describe, expect, it } from 'vitest'
import { StoreGeneralSchema } from '../settings/general'
import { isValidPhone, lenientPhone, normalisePhone } from './phone'

describe('normalisePhone', () => {
  it('reads a ten digit Indian number as +91', () => {
    expect(normalisePhone('9876543210')).toBe('+919876543210')
  })

  it('keeps +91 numbers, ignoring spaces and dashes', () => {
    expect(normalisePhone('+91 98765-43210')).toBe('+919876543210')
    expect(normalisePhone(' +919876543210 ')).toBe('+919876543210')
  })

  it('reads a leading 0 and a bare 91 prefix', () => {
    expect(normalisePhone('09876543210')).toBe('+919876543210')
    expect(normalisePhone('919876543210')).toBe('+919876543210')
  })

  it('accepts other countries when written in full', () => {
    expect(normalisePhone('+1 415 555 2671')).toBe('+14155552671')
    expect(normalisePhone('+44 20 7946 0958')).toBe('+442079460958')
  })

  it('uses the default country for a bare national number', () => {
    expect(normalisePhone('(415) 555-2671', 'US')).toBe('+14155552671')
  })

  it('rejects numbers that are too short, too long or not numbers', () => {
    expect(normalisePhone('98765')).toBeNull()
    expect(normalisePhone('98765432101234567890')).toBeNull()
    expect(normalisePhone('abc')).toBeNull()
    expect(normalisePhone('')).toBeNull()
    expect(normalisePhone(null)).toBeNull()
    expect(normalisePhone(undefined)).toBeNull()
  })
})

describe('isValidPhone', () => {
  it('mirrors normalisePhone', () => {
    expect(isValidPhone('98765 43210')).toBe(true)
    expect(isValidPhone('+91 12345')).toBe(false)
    expect(isValidPhone('')).toBe(false)
  })
})

describe('lenientPhone', () => {
  it('saves a valid number as E.164 and keeps other text as typed', () => {
    const schema = lenientPhone(20)
    expect(schema.parse(' 98765 43210 ')).toBe('+919876543210')
    expect(schema.parse('ext 12')).toBe('ext 12')
    expect(() => schema.parse('1'.repeat(21))).toThrow()
  })
})

describe('StoreGeneralSchema contactPhone', () => {
  const parse = (contactPhone: string | undefined) =>
    StoreGeneralSchema.safeParse({ name: 'Shop', contactPhone })

  it('normalises to E.164, allows empty, rejects junk', () => {
    expect(parse('+91 98765 43210').data?.contactPhone).toBe('+919876543210')
    expect(parse('').data?.contactPhone).toBe('')
    expect(parse(undefined).data?.contactPhone).toBe('')
    expect(parse('12345').success).toBe(false)
  })
})
