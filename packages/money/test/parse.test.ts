import { describe, expect, it } from 'vitest'
import { formatPercent, formatSignedMoney, parseRupees } from '../src/index'

describe('parseRupees', () => {
  it('turns typed rupees into whole paise', () => {
    expect(parseRupees('499')).toBe(49_900)
    expect(parseRupees(' 12.5 ')).toBe(1_250)
    expect(parseRupees('.75')).toBe(75)
    expect(parseRupees('0')).toBe(0)
  })

  it('rounds to the nearest paisa, without float drift', () => {
    expect(parseRupees('1.005')).toBe(101)
    expect(parseRupees('19.999')).toBe(2_000)
    expect(parseRupees('0.004')).toBe(0)
  })

  it('is null for empty, junk or negative input', () => {
    for (const bad of ['', '  ', 'abc', '12abc', '-5', '1e3', '1,000', '₹10', 'NaN', 'Infinity']) {
      expect(parseRupees(bad), bad).toBeNull()
    }
  })
})

describe('formatSignedMoney', () => {
  it('prefixes + or a true minus sign', () => {
    expect(formatSignedMoney(4_900)).toBe('+₹49')
    expect(formatSignedMoney(-9_998)).toBe('−₹99.98')
    expect(formatSignedMoney(0)).toBe('+₹0')
  })
})

describe('formatPercent', () => {
  it('formats a ratio as a percentage', () => {
    expect(formatPercent(0.256)).toBe('26%')
    expect(formatPercent(0.256, { maximumFractionDigits: 1 })).toBe('25.6%')
    expect(formatPercent(0.5, { locale: 'hi-IN' })).toBe('50%')
  })
})
