/** SOURCE OF TRUTH: rules suggested from Shipping rates — WHAT: a custom profile becomes a Fixed
 * (or Free) rule for its products, General an "All products" rule free above its threshold, and
 * a profile a rule already covers is skipped / WHY: owner, 20 Nov 2026 (Waimers' Skates). */
import { describe, expect, it } from 'vitest'
import type { ShippingZoneInput, ShippingZoneRateInput } from '../rates'
import { type SuggestionProfile, ruleSuggestions } from './suggestions'

const rate = (pricePaise: number, freeAbovePaise: number | null = null): ShippingZoneRateInput => ({
  id: `r${pricePaise}`,
  name: 'Rate',
  condition: 'none',
  minValue: null,
  maxValue: null,
  pricePaise,
  freeAbovePaise,
  codSurchargePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
  position: 0,
})
const zone = (rates: ShippingZoneRateInput[]): ShippingZoneInput => ({
  id: 'z',
  name: 'India',
  stateCodes: [],
  pincodeRules: [],
  position: 0,
  rates,
})

const GENERAL: SuggestionProfile = {
  id: 'g',
  name: 'General',
  isDefault: true,
  products: [],
  zones: [zone([rate(4900, 99_900)])],
}
const SKATES: SuggestionProfile = {
  id: 's',
  name: 'Skates',
  isDefault: false,
  products: [
    { id: 'p1', title: 'Skate A' },
    { id: 'p2', title: 'Skate B' },
  ],
  zones: [zone([rate(9900), rate(13900)])],
}

describe('rules suggested from shipping rates', () => {
  it('a custom profile: a Fixed rule at its lowest rate for its products; General last', () => {
    const [skates, general] = ruleSuggestions([GENERAL, SKATES], [])
    expect(skates?.target).toEqual({ kind: 'products', values: ['p1', 'p2'] })
    expect(skates?.price).toEqual({ mode: 'fixed', fixedPaise: 9900, freeAbovePaise: null })
    expect(skates?.highestPaise).toBe(13900)
    expect(general?.target.kind).toBe('all')
    expect(general?.price).toEqual({ mode: 'option', freeAbovePaise: 99_900 })
  })

  it('a free profile suggests Free', () => {
    const free = { ...SKATES, zones: [zone([rate(0)])] }
    expect(ruleSuggestions([free], [])[0]?.price).toEqual({ mode: 'free' })
  })

  it('skips a profile a rule already covers, and one with no products', () => {
    const rules = [
      { name: 'skates', target: { kind: 'collections' as const, values: ['c'] } },
      { name: 'Everything', target: { kind: 'all' as const, values: [] } },
    ]
    expect(ruleSuggestions([GENERAL, SKATES], rules)).toEqual([])
    expect(ruleSuggestions([{ ...SKATES, products: [] }], [])).toEqual([])
  })
})
