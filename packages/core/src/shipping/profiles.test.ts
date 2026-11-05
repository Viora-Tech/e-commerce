/** SOURCE OF TRUTH: shipping profile rule tests — WHAT: quotes across profiles, free shipping and value splits / WHY: guard the rule in profiles.ts */
import { describe, expect, it } from 'vitest'
import {
  primaryRateId,
  profilesFreeShippingThreshold,
  quoteProfiles,
  type ShippingProfileInput,
  splitValue,
} from './profiles'
import type { ShippingZoneInput, ShippingZoneRateInput } from './rates'

const rate = (
  id: string,
  name: string,
  pricePaise: number,
  over: Partial<ShippingZoneRateInput> = {},
) => ({
  id,
  name,
  condition: 'none' as const,
  minValue: null,
  maxValue: null,
  pricePaise,
  freeAbovePaise: null,
  codSurchargePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
  position: 0,
  ...over,
})

const allIndia = (id: string, rates: ShippingZoneRateInput[]): ShippingZoneInput => ({
  id,
  name: 'All India',
  stateCodes: [],
  pincodeRules: [],
  position: 0,
  rates,
})

/** Waimers on Shopify: General ships free; Skates pay Delhivery ₹99 or Bluedart ₹139. */
const general: ShippingProfileInput = {
  id: 'general',
  name: 'General',
  isDefault: true,
  position: 0,
  zones: [allIndia('z-general', [rate('free', 'Standard', 0)])],
}
const skates: ShippingProfileInput = {
  id: 'skates',
  name: 'Skates',
  isDefault: false,
  position: 1,
  zones: [
    allIndia('z-skates', [
      rate('delhivery', 'Delhivery', 9900, { minTransitDays: 3, maxTransitDays: 5 }),
      rate('bluedart', 'Bluedart', 13_900, { codSurchargePaise: 5000, maxTransitDays: 3 }),
    ]),
  ],
}

const to = { stateCode: 'KA', pincode: '560001' }
const part = (profileId: string, valuePaise: number, weightGrams = 0) => ({
  profileId,
  measure: { valuePaise, weightGrams },
})

describe('quoteProfiles', () => {
  it('prices a cart of one profile exactly as its zones do', () => {
    const quote = quoteProfiles([general, skates], [part('skates', 500_000)], to)
    expect(quote).toMatchObject({
      kind: 'rates',
      options: [
        { rateId: 'delhivery', pricePaise: 9900 },
        { rateId: 'bluedart', pricePaise: 13_900 },
      ],
    })
    if (quote.kind === 'rates') expect(quote.options[0]?.parts).toBeUndefined()
  })

  it('sums one rate per profile for a mixed cart, General first, cheapest option first', () => {
    const quote = quoteProfiles(
      [skates, general],
      [part('skates', 500_000), part('general', 100_000)],
      to,
    )
    if (quote.kind !== 'rates') throw new Error(quote.kind)
    expect(quote.options.map((o) => [o.rateId, o.name, o.pricePaise])).toEqual([
      ['free+delhivery', 'Standard + Delhivery', 9900],
      ['free+bluedart', 'Standard + Bluedart', 13_900],
    ])
    const [cheap, fast] = quote.options
    expect(cheap?.parts?.map((p) => [p.profileName, p.name, p.pricePaise])).toEqual([
      ['General', 'Standard', 0],
      ['Skates', 'Delhivery', 9900],
    ])
    // The slowest parcel and the highest COD fee of the parts.
    expect(cheap).toMatchObject({ minTransitDays: 3, maxTransitDays: 5, codSurchargePaise: null })
    expect(fast).toMatchObject({ codSurchargePaise: 5000, maxTransitDays: 3 })
    expect(primaryRateId(fast?.rateId ?? '')).toBe('free')
  })

  it('matches rates by name across profiles and falls back to each one’s cheapest', () => {
    const both: ShippingProfileInput = {
      ...general,
      zones: [
        allIndia('z-general', [rate('g-std', 'Standard', 4900), rate('g-exp', 'Express', 9900)]),
      ],
    }
    const heavy: ShippingProfileInput = {
      ...skates,
      zones: [
        allIndia('z-skates', [rate('s-std', 'Standard', 9900), rate('s-exp', 'Express', 19_900)]),
      ],
    }
    const quote = quoteProfiles([both, heavy], [part('general', 1), part('skates', 1)], to)
    if (quote.kind !== 'rates') throw new Error(quote.kind)
    expect(quote.options.map((o) => [o.rateId, o.name, o.pricePaise])).toEqual([
      ['g-std+s-std', 'Standard', 9900],
      ['g-exp+s-exp', 'Express', 19_900],
    ])
  })

  it('cannot ship a cart when one of its profiles has no rate for the address', () => {
    const empty: ShippingProfileInput = { ...skates, zones: [] }
    expect(quoteProfiles([general, empty], [part('general', 1), part('skates', 1)], to)).toEqual({
      kind: 'no_rates',
    })
    expect(quoteProfiles([general, empty], [part('skates', 1)], to)).toEqual({ kind: 'no_rates' })
  })

  it('ships free only when no profile has zones, as before rates existed', () => {
    const bare = [
      { ...general, zones: [] },
      { ...skates, zones: [] },
    ]
    expect(quoteProfiles(bare, [part('skates', 1)], to)).toEqual({ kind: 'not_configured' })
  })

  it('treats a product of an unknown profile as General', () => {
    const quote = quoteProfiles([general], [part('gone', 1)], to)
    expect(quote).toMatchObject({ kind: 'rates', options: [{ rateId: 'free' }] })
  })
})

describe('profilesFreeShippingThreshold', () => {
  const freeAbove = {
    ...general,
    zones: [allIndia('z', [rate('std', 'Standard', 4900, { freeAbovePaise: 99_900 })])],
  }
  it('promises the cart line only what every profile in the cart promises', () => {
    expect(profilesFreeShippingThreshold([freeAbove, skates], [])).toBe(99_900)
    expect(profilesFreeShippingThreshold([freeAbove, skates], ['general'])).toBe(99_900)
    expect(profilesFreeShippingThreshold([freeAbove, skates], ['general', 'skates'])).toBeNull()
  })
})

describe('splitValue', () => {
  it('shares the discounted value by subtotal and always adds up', () => {
    expect(splitValue(90_000, [60_000, 40_000])).toEqual([54_000, 36_000])
    expect(splitValue(100, [1, 1, 1])).toEqual([33, 33, 34])
    expect(splitValue(500, [0, 0])).toEqual([500, 0])
  })
})
