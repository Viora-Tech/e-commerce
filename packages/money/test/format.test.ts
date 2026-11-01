import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatNumber,
  formatPresentment,
  fromMinor,
  isCurrency,
  moneyFormatOf,
  toMinor,
} from '../src/index'

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

describe('Hindi (hi-IN)', () => {
  const hi = { locale: 'hi-IN' }

  it('keeps Indian lakh/crore digit grouping with Latin digits', () => {
    expect(formatMoney(1_23_45_678_50, 'INR', hi)).toBe('₹1,23,45,678.50')
    expect(formatNumber(12_34_567, hi)).toBe('12,34,567')
  })

  it('spells compact units out in the Indian system', () => {
    expect(formatMoney(950_00, 'INR', { ...hi, compact: true })).toBe('₹950')
    expect(formatMoney(12_345_00, 'INR', { ...hi, compact: true })).toBe('₹12.3 हज़ार')
    expect(formatMoney(1_23_456_00, 'INR', { ...hi, compact: true })).toBe('₹1.2 लाख')
    expect(formatMoney(1_23_45_678_00, 'INR', { ...hi, compact: true })).toBe('₹1.2 करोड़')
    expect(formatNumber(2_50_000, { ...hi, compact: true })).toBe('2.5 लाख')
  })

  it('stays in crore instead of switching to arab', () => {
    expect(formatMoney(1_23_45_67_890_00, 'INR', { ...hi, compact: true })).toBe('₹123.5 करोड़')
  })

  it('moves to the next unit when rounding reaches it', () => {
    expect(formatMoney(99_990_00, 'INR', { ...hi, compact: true })).toBe('₹1 लाख')
  })

  it('puts the minus sign before the symbol', () => {
    expect(formatMoney(-2_50_000_00, 'INR', { ...hi, compact: true })).toBe('-₹2.5 लाख')
  })
})

describe('market currencies', () => {
  // Intl puts a no-break space between a code and the amount.
  const plain = (s: string) => s.replace(/ /g, ' ')

  it('formats each in its own decimals', () => {
    expect(formatMoney(899, 'USD')).toBe('$8.99')
    expect(plain(formatMoney(2350, 'AED'))).toBe('AED 23.50')
    expect(plain(formatMoney(3670, 'KWD'))).toBe('KWD 3.670')
    expect(formatMoney(1791, 'JPY')).toBe('¥1,791')
  })

  it('rounds totals to whole units by each currency’s own minor unit', () => {
    expect(formatMoney(276_370_18, 'INR', { whole: true })).toBe('₹2,76,370')
    expect(formatMoney(899, 'USD', { whole: true })).toBe('$9')
    expect(plain(formatMoney(3670, 'KWD', { whole: true }))).toBe('KWD 4')
    expect(formatMoney(1791, 'JPY', { whole: true })).toBe('¥1,791')
  })

  it('knows which codes it formats', () => {
    expect(isCurrency('AED')).toBe(true)
    expect(isCurrency('XYZ')).toBe(false)
    expect(isCurrency('toString')).toBe(false)
  })
})

describe('moneyFormatOf', () => {
  it('reads a Shopify-style format off each currency', () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a Shopify money format, not a template.
    expect(moneyFormatOf('USD')).toBe('${{amount}}')
    expect(moneyFormatOf('AED')).toBe('AED {{amount}}')
    expect(moneyFormatOf('JPY')).toBe('¥{{amount_no_decimals}}')
    expect(moneyFormatOf('INR')).toBe('₹{{amount}}')
  })
})

describe('formatPresentment', () => {
  it('formats paise in the market currency, rupees without one', () => {
    const usd = { currency: 'USD', rate: 0.012, adjustmentBp: 0, rounding: 'none' } as const
    expect(formatPresentment(64_900, usd)).toBe('$7.79')
    expect(formatPresentment(64_900, null)).toBe('₹649')
  })
})
