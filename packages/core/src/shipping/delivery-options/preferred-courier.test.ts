/** SOURCE OF TRUTH: the owner's courier-list cases of 20 Nov 2026 — WHAT: a rule's preferred
 * courier hides its own other speed, cheaper couriers cost what the preferred one costs (free when
 * it is free), dearer ones add the difference, and the "Round delivery prices" setting / WHY:
 * mice by Delhivery Air with no Delhivery Surface card; Blue Dart and Amazon still offered. */
import { describe, expect, it } from 'vitest'
import {
  answer,
  config,
  find,
  input,
  item,
  option,
  quote,
  rule,
} from '../../testing/delivery-options-fixtures'
import { resolveDeliveryOptions } from './resolve'
import { roundPrice } from './rounding'

/** The owner's sample: a mouse to 131001. */
const answers = [
  answer('delhivery', 'Delhivery', [
    quote('S', 'Surface', 5000, [4, 5]),
    quote('E', 'Express', 8900, [2, 3]),
  ]),
  answer('rapidshyp', 'RapidShyp', [
    quote('50', 'Amazon Shipping Surface', 5900, [4, 5], 'Amazon Shipping'),
    quote('60', 'Bluedart Surface', 7900, [3, 4], 'Bluedart Surface'),
    quote('70', 'Bluedart Air', 12900, [2, 2], 'Bluedart Air'),
  ]),
]

const MICE = rule(
  'mice',
  {
    name: 'Mice',
    target: { kind: 'products', values: ['mouse'] },
    routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart' }, { carrier: 'amazon' }],
    defaultRoute: { carrier: 'delhivery', speed: 'express' },
  },
  0,
)
const mouseCart = { valuePaise: 150_000, weightGrams: 400, items: [item('mouse')] }

const run = (price: Record<string, unknown>, rules = [MICE]) => {
  const list = option('std', {
    name: 'Delivery',
    price,
    couriers: { show: 'list', hideSlowerDearer: false },
  })
  const r = resolveDeliveryOptions(
    input({ config: config({ options: [list], rules }), cart: mouseCart, answers }),
  )
  return find(r, 'std')?.choices ?? []
}

describe('a rule with a preferred courier, in a courier list', () => {
  it('shows the preferred courier first and hides its other speed; other couriers stay', () => {
    const keys = run({ source: 'free' }).map((c) => c.route.key)
    expect(keys[0]).toBe('delhivery:E')
    expect(keys).not.toContain('delhivery:S')
    expect(keys).toEqual(expect.arrayContaining(['rapidshyp:50', 'rapidshyp:60', 'rapidshyp:70']))
  })

  it('free preferred courier: cheaper couriers are free too, a dearer one adds the difference', () => {
    const cards = run({ source: 'free', rounding: 'nine' })
    const price = (key: string) => cards.find((c) => c.route.key === key)?.pricePaise
    expect(price('delhivery:E')).toBe(0)
    expect(price('rapidshyp:50')).toBe(0)
    expect(price('rapidshyp:60')).toBe(0)
    // Blue Dart Air costs ₹40 more than Delhivery Air: +₹49 on the …9 rounding.
    expect(price('rapidshyp:70')).toBe(4900)
  })

  it('charged preferred courier: cheaper couriers cost the same, a dearer one more', () => {
    const cards = run({ source: 'route', rounding: 'nine' })
    const price = (key: string) => cards.find((c) => c.route.key === key)?.pricePaise
    expect(price('delhivery:E')).toBe(8900)
    expect(price('rapidshyp:50')).toBe(8900)
    expect(price('rapidshyp:60')).toBe(8900)
    expect(price('rapidshyp:70')).toBe(8900 + 4900)
  })

  it('with no preferred courier, every speed of a courier still shows', () => {
    const keys = run({ source: 'route' }, []).map((c) => c.route.key)
    expect(keys).toEqual(expect.arrayContaining(['delhivery:S', 'delhivery:E']))
  })
})

describe('Round delivery prices', () => {
  it('rounds up the store’s way, and ₹0 stays ₹0', () => {
    const rupees = (r: number, how: Parameters<typeof roundPrice>[1]) =>
      roundPrice(r * 100, how) / 100
    expect([43, 58, 100].map((r) => rupees(r, 'nine'))).toEqual([49, 59, 109])
    expect([43, 58, 100].map((r) => rupees(r, 'fifty'))).toEqual([49, 99, 149])
    expect([43, 58, 100].map((r) => rupees(r, 'ten'))).toEqual([50, 60, 100])
    expect([43.2, 58, 100].map((r) => rupees(r, 'off'))).toEqual([44, 58, 100])
    expect(roundPrice(0, 'nine')).toBe(0)
  })

  it('options saved before keep the ₹10 rule', () => {
    expect(option('std', { name: 'Delivery' }).price.rounding).toBe('ten')
  })
})
