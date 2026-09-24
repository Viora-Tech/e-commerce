import { describe, expect, it } from 'vitest'
import {
  freeShippingThreshold,
  isPincodePattern,
  pickZone,
  priceRate,
  quoteShipping,
  ShippingRateWriteSchema,
  type ShippingZoneInput,
  type ShippingZoneRateInput,
  ShippingZoneWriteSchema,
  zoneScore,
} from './rates'

const rate = (over: Partial<ShippingZoneRateInput> = {}): ShippingZoneRateInput => ({
  id: over.id ?? 'r1',
  name: 'Standard',
  condition: 'none',
  minValue: null,
  maxValue: null,
  pricePaise: 4900,
  freeAbovePaise: null,
  codSurchargePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
  position: 0,
  ...over,
})

const zone = (over: Partial<ShippingZoneInput> = {}): ShippingZoneInput => ({
  id: over.id ?? 'z1',
  name: 'Zone',
  stateCodes: [],
  pincodeRules: [],
  position: 0,
  rates: [rate()],
  ...over,
})

const cart = (valuePaise: number, weightGrams = 0) => ({ valuePaise, weightGrams })
const blr = { stateCode: 'KA', pincode: '560001' }

describe('rate pricing', () => {
  it('charges a flat rate whatever the cart', () => {
    expect(priceRate(rate(), cart(100))).toBe(4900)
    expect(priceRate(rate(), cart(10_000_000, 50_000))).toBe(4900)
  })

  it('bounds order-value bands with min included and max excluded', () => {
    const band = rate({ condition: 'order_value', minValue: 50_000, maxValue: 100_000 })
    expect(priceRate(band, cart(49_999))).toBeNull()
    expect(priceRate(band, cart(50_000))).toBe(4900)
    expect(priceRate(band, cart(99_999))).toBe(4900)
    expect(priceRate(band, cart(100_000))).toBeNull()
  })

  it('bounds weight bands by grams, not value', () => {
    const light = rate({ condition: 'weight', minValue: 0, maxValue: 500, pricePaise: 4000 })
    const heavy = rate({ condition: 'weight', minValue: 500, maxValue: null, pricePaise: 9000 })
    expect(priceRate(light, cart(10_000_000, 499))).toBe(4000)
    expect(priceRate(light, cart(1, 500))).toBeNull()
    expect(priceRate(heavy, cart(1, 500))).toBe(9000)
    expect(priceRate(heavy, cart(1, 20_000))).toBe(9000)
  })

  it('turns free from the threshold up', () => {
    const r = rate({ freeAbovePaise: 99_900 })
    expect(priceRate(r, cart(99_899))).toBe(4900)
    expect(priceRate(r, cart(99_900))).toBe(0)
  })

  it('offers every rate that fits, cheapest first', () => {
    const z = zone({
      rates: [
        rate({ id: 'express', name: 'Express', pricePaise: 14_900, position: 0 }),
        rate({ id: 'std', name: 'Standard', pricePaise: 4900, position: 1 }),
        rate({ id: 'big', condition: 'order_value', minValue: 500_000, position: 2 }),
      ],
    })
    const q = quoteShipping([z], blr, cart(100_000))
    expect(q.kind === 'rates' && q.options.map((o) => o.rateId)).toEqual(['std', 'express'])
  })

  it('reports no rates when no band fits, and not configured without zones', () => {
    const z = zone({ rates: [rate({ condition: 'weight', minValue: 0, maxValue: 1000 })] })
    expect(quoteShipping([z], blr, cart(1, 5000))).toEqual({ kind: 'no_rates' })
    expect(quoteShipping([], blr, cart(1))).toEqual({ kind: 'not_configured' })
  })
})

describe('zone matching', () => {
  const india = zone({ id: 'india', name: 'Rest of India', position: 0 })
  const south = zone({ id: 'south', stateCodes: ['KA', 'TN'], position: 1 })
  const blrZone = zone({
    id: 'blr',
    pincodeRules: [
      { pattern: '560*', mode: 'include' },
      { pattern: '560100', mode: 'exclude' },
    ],
    position: 2,
  })
  const exact = zone({ id: 'exact', pincodeRules: [{ pattern: '560001', mode: 'include' }] })

  it('prefers a PIN code rule over a state over everywhere', () => {
    expect(pickZone([india, south, blrZone], blr)?.id).toBe('blr')
    expect(pickZone([india, south, blrZone], { stateCode: 'TN', pincode: '600001' })?.id).toBe(
      'south',
    )
    expect(pickZone([india, south, blrZone], { stateCode: 'DL', pincode: '110001' })?.id).toBe(
      'india',
    )
  })

  it('prefers an exact PIN code over a prefix, and a longer prefix over a shorter one', () => {
    expect(pickZone([blrZone, exact], blr)?.id).toBe('exact')
    const wide = zone({ id: 'wide', pincodeRules: [{ pattern: '5*', mode: 'include' }] })
    expect(pickZone([wide, blrZone], blr)?.id).toBe('blr')
  })

  it('lets an exclude rule beat the zone own include and state', () => {
    const to = { stateCode: 'KA', pincode: '560100' }
    expect(zoneScore(blrZone, to)).toBeNull()
    const both = zone({
      stateCodes: ['KA'],
      pincodeRules: [{ pattern: '560100', mode: 'exclude' }],
    })
    expect(zoneScore(both, to)).toBeNull()
    expect(pickZone([india, south, blrZone], to)?.id).toBe('south')
  })

  it('treats a zone with only excludes as everywhere else', () => {
    const notNe = zone({ pincodeRules: [{ pattern: '79*', mode: 'exclude' }] })
    expect(zoneScore(notNe, { stateCode: 'DL', pincode: '110001' })).toBe(0)
    expect(zoneScore(notNe, { stateCode: 'AR', pincode: '791001' })).toBeNull()
  })

  it('covers nothing when a zone lists states and the address is elsewhere', () => {
    expect(pickZone([south], { stateCode: 'DL', pincode: '110001' })).toBeNull()
    expect(quoteShipping([south], { stateCode: 'DL', pincode: '110001' }, cart(1))).toEqual({
      kind: 'no_rates',
    })
  })

  it('breaks ties by position', () => {
    const a = zone({ id: 'a', stateCodes: ['KA'], position: 1 })
    const b = zone({ id: 'b', stateCodes: ['KA'], position: 0 })
    expect(pickZone([a, b], blr)?.id).toBe('b')
  })
})

describe('free shipping threshold', () => {
  it('is the highest zone threshold when every zone has one', () => {
    const a = zone({ rates: [rate({ freeAbovePaise: 99_900 })] })
    const b = zone({
      rates: [rate({ freeAbovePaise: 149_900 }), rate({ freeAbovePaise: 199_900 })],
    })
    expect(freeShippingThreshold([a, b])).toBe(149_900)
  })

  it('is null when a zone never turns free, a weight rate is the only free one, or no zones exist', () => {
    const free = zone({ rates: [rate({ freeAbovePaise: 99_900 })] })
    expect(freeShippingThreshold([free, zone()])).toBeNull()
    const weight = zone({
      rates: [rate({ condition: 'weight', minValue: 0, maxValue: 500, freeAbovePaise: 1 })],
    })
    expect(freeShippingThreshold([weight])).toBeNull()
    expect(freeShippingThreshold([])).toBeNull()
  })
})

describe('write schemas', () => {
  it('accepts prefix and exact PIN code patterns only', () => {
    expect(isPincodePattern('560*')).toBe(true)
    expect(isPincodePattern('560001')).toBe(true)
    expect(isPincodePattern('056*')).toBe(false)
    expect(isPincodePattern('560')).toBe(false)
    expect(isPincodePattern('5600011')).toBe(false)
  })

  it('upper-cases states and refuses inverted bands', () => {
    const z = ShippingZoneWriteSchema.parse({ name: ' South ', stateCodes: ['ka'] })
    expect(z).toMatchObject({ name: 'South', stateCodes: ['KA'], rates: [], pincodeRules: [] })
    const bad = ShippingRateWriteSchema.safeParse({
      name: 'Band',
      condition: 'order_value',
      minValue: 1000,
      maxValue: 500,
      pricePaise: 1,
    })
    expect(bad.success).toBe(false)
  })
})
