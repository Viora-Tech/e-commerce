import { describe, expect, it } from 'vitest'
import { formatMoney, fromMinor, toMinor } from '../src/index'

describe('formatMoney', () => {
  it('formats INR with Indian digit grouping', () => {
    expect(formatMoney(123_400_00, 'INR', { showZeroDecimals: true })).toBe('₹1,23,400.00')
  })

  it('formats INR compact', () => {
    expect(formatMoney(123_400_00, 'INR', { compact: true })).toBe('₹1.2L')
  })

  it('formats USD', () => {
    expect(formatMoney(1_234_00, 'USD', { showZeroDecimals: true })).toBe('$1,234.00')
  })

  it('formats EUR', () => {
    expect(formatMoney(1_234_00, 'EUR', { showZeroDecimals: true })).toBe('€1,234.00')
  })

  it('formats zero', () => {
    expect(formatMoney(0, 'INR')).toBe('₹0')
  })

  it('formats negative amounts', () => {
    expect(formatMoney(-1_234_00, 'INR')).toBe('-₹1,234')
  })

  it('drops trailing .00 for whole amounts by default', () => {
    expect(formatMoney(1_234_00, 'INR')).toBe('₹1,234')
  })

  it('keeps decimals for fractional amounts by default', () => {
    expect(formatMoney(1_234_50, 'INR')).toBe('₹1,234.50')
  })

  it('showZeroDecimals forces full precision on whole amounts', () => {
    expect(formatMoney(1_234_00, 'INR', { showZeroDecimals: true })).toBe('₹1,234.00')
  })
})

describe('toMinor / fromMinor', () => {
  it('round-trips', () => {
    expect(toMinor(1234.5, 'INR')).toBe(123450)
    expect(fromMinor(123450, 'INR')).toBe(1234.5)
  })

  it('rounds fractional paise', () => {
    expect(toMinor(1234.505, 'INR')).toBe(123451)
  })
})
