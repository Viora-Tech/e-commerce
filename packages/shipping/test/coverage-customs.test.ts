import { describe, expect, it } from 'vitest'
import {
  customsLines,
  indiaLocalTime,
  isDomesticCountry,
  missingHsCodeMessage,
  normaliseHsCode,
  servesDestination,
  wrapAddressLines,
} from '../src'

describe('servesDestination', () => {
  it('keeps domestic couriers in India and export couriers abroad', () => {
    expect(servesDestination({}, 'IN')).toBe(true)
    expect(servesDestination({}, undefined)).toBe(true)
    expect(servesDestination({}, 'US')).toBe(false)
    expect(servesDestination({ coverage: 'international' }, 'US')).toBe(true)
    expect(servesDestination({ coverage: 'international' }, 'in')).toBe(false)
    expect(servesDestination({ coverage: 'both' }, 'US')).toBe(true)
    expect(isDomesticCountry(' india ')).toBe(true)
  })
})

describe('customsLines', () => {
  it('normalises HS codes and splits the parcel weight over lines without their own', () => {
    const r = customsLines({
      weightGrams: 1000,
      lines: [
        {
          title: 'Mousepad',
          quantity: 2,
          unitPricePaise: 1000,
          hsCode: '3926.90 99',
          unitWeightGrams: 200,
        },
        { title: 'Mat', quantity: 3, unitPricePaise: 500, hsCode: '392690', countryOfOrigin: 'cn' },
      ],
    })
    expect(r).toEqual({
      ok: true,
      lines: [
        expect.objectContaining({
          hsCode: '39269099',
          countryOfOrigin: 'IN',
          unitWeightGrams: 200,
        }),
        expect.objectContaining({ hsCode: '392690', countryOfOrigin: 'CN', unitWeightGrams: 200 }),
      ],
    })
  })

  it('names every line missing a usable HS code', () => {
    const r = customsLines({
      weightGrams: 1000,
      lines: [
        { title: 'A', quantity: 1, unitPricePaise: 1, hsCode: '12' },
        { title: 'B', quantity: 1, unitPricePaise: 1 },
      ],
    })
    expect(r).toEqual({ ok: false, missingHsCode: ['A', 'B'] })
    expect(missingHsCodeMessage('FedEx', ['A', 'B', 'C', 'D'])).toContain('A, B, C and 1 more')
    expect(normaliseHsCode('ABC')).toBeNull()
  })
})

describe('address and time helpers', () => {
  it('wraps street lines at the courier limit without splitting words', () => {
    const lines = wrapAddressLines(
      ['Plot 4, HSIIDC Industrial Estate', 'near the toll plaza'],
      20,
      3,
    )
    expect(lines.every((l) => l.length <= 20)).toBe(true)
    expect(lines.join(' ')).toBe('Plot 4, HSIIDC Industrial Estate, near the toll plaza')
  })

  it('gives India local time', () => {
    expect(indiaLocalTime(new Date('2026-10-20T20:00:00Z'), 30)).toBe('2026-10-21T02:00:00')
  })
})
