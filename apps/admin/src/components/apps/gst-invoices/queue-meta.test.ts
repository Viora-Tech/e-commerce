import { describe, expect, it } from 'vitest'
import { headerGstin, numberingYear } from './queue-meta'

describe('headerGstin', () => {
  it("prefers the app's seller GSTIN", () => {
    expect(headerGstin('06AAACV1234F1Z5', '29AAACV1234F1Z1')).toBe('06AAACV1234F1Z5')
  })

  it("falls back to the store's GSTIN when the seller GSTIN is empty", () => {
    expect(headerGstin('', '29AAACV1234F1Z1')).toBe('29AAACV1234F1Z1')
    expect(headerGstin('  ', '29AAACV1234F1Z1')).toBe('29AAACV1234F1Z1')
  })

  it('is null only when both are empty', () => {
    expect(headerGstin('', null)).toBeNull()
    expect(headerGstin(undefined, '')).toBeNull()
  })
})

describe('numberingYear', () => {
  it('names the Indian financial year', () => {
    expect(numberingYear(new Date('2026-11-28T06:00:00Z'))).toBe('2026-27')
    expect(numberingYear(new Date('2027-03-31T12:00:00Z'))).toBe('2026-27')
    expect(numberingYear(new Date('2027-04-01T00:00:00+05:30'))).toBe('2027-28')
  })
})
