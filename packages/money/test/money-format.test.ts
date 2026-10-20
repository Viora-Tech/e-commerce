import { describe, expect, it } from 'vitest'
import {
  cleanMoneyFormat,
  formatStoreMoney,
  formatWithMoneyFormat,
  isMoneyFormat,
} from '../src/index'

describe('formatStoreMoney', () => {
  it('falls back to the currency format without a store format', () => {
    expect(formatStoreMoney(649_900, null)).toBe('₹6,499')
    expect(formatStoreMoney(649_900, '')).toBe('₹6,499')
  })

  it("reads like Shopify with the shop's money format", () => {
    expect(formatStoreMoney(649_900, 'Rs. {{amount}}')).toBe('Rs. 6,499.00')
    expect(formatStoreMoney(649_900, '₹{{ amount_no_decimals }}')).toBe('₹6,499')
    expect(formatStoreMoney(1_049_950, 'Rs. {{amount}}')).toBe('Rs. 10,499.50')
  })

  it('ignores a format without an amount placeholder', () => {
    expect(formatStoreMoney(649_900, 'Rs.')).toBe('₹6,499')
  })
})

describe('formatWithMoneyFormat', () => {
  it('handles the separator variants', () => {
    expect(formatWithMoneyFormat(749_950, '{{amount_with_comma_separator}}')).toBe('7.499,50')
    expect(formatWithMoneyFormat(-749_900, '{{amount}}')).toBe('-7,499.00')
  })
})

describe('cleanMoneyFormat', () => {
  it("turns Shopify's HTML format into plain text", () => {
    expect(cleanMoneyFormat('<span class=money>Rs. {{amount}}</span>')).toBe('Rs. {{amount}}')
    expect(cleanMoneyFormat('&#8377;{{amount_no_decimals}}')).toBe('₹{{amount_no_decimals}}')
  })

  it('drops formats that show no amount', () => {
    expect(cleanMoneyFormat('Rs.')).toBeNull()
    expect(cleanMoneyFormat(null)).toBeNull()
    expect(isMoneyFormat('x'.repeat(70) + '{{amount}}')).toBe(false)
  })
})
