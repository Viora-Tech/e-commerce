/** SOURCE OF TRUTH: tests for a courier list that charges a faster courier its full price, owner
 * 21 Nov 2026 — WHAT: `couriers.extra: 'full'`: a dearer courier costs its own price (cost,
 * markup, insurance, rounded the option's way), never below the first courier; a cheaper one
 * costs what the first costs; product rule prices (Free, Fixed, a mixed cart), free above, and
 * the order charging what the card showed / WHY: "faster courier cost when there is no option to
 * charge the complete amount?" */
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
import { orderDeliveryFor, shownPrices } from './checkout'
import { OptionCouriersSchema } from './config'
import { resolveDeliveryOptions } from './resolve'

/** Delhivery Surface ₹50 and Air ₹89, Amazon Surface ₹59, Blue Dart Air ₹129 (store's cost). */
const answers = () => [
  answer('delhivery', 'Delhivery', [
    quote('S', 'Surface', 5000, [4, 5]),
    quote('E', 'Express', 8900, [2, 3]),
  ]),
  answer('rapidshyp', 'RapidShyp', [
    quote('50', 'Amazon Shipping Surface', 5900, [4, 5], 'Amazon Shipping'),
    quote('70', 'Bluedart Air', 12900, [2, 2], 'Bluedart Air'),
  ]),
]

const listOption = (extra: 'difference' | 'full' | 'none', price: Record<string, unknown> = {}) =>
  option('std', {
    name: 'Delivery',
    price: { source: 'route', rounding: 'nine', ...price },
    couriers: { show: 'list', hideSlowerDearer: false, extra },
  })

const mice = (price: Record<string, unknown>) =>
  rule(
    'mice',
    {
      name: 'Mice',
      target: { kind: 'collections', values: ['c-mice'] },
      routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart' }, { carrier: 'amazon' }],
      defaultRoute: { carrier: 'delhivery', speed: 'express' },
      price,
    },
    0,
  )
const skates = (fixedPaise: number) =>
  rule(
    'skates',
    {
      name: 'Skates',
      target: { kind: 'collections', values: ['c-skates'] },
      routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart' }, { carrier: 'amazon' }],
      price: { mode: 'fixed', fixedPaise },
    },
    1,
  )
const MOUSE = item('mouse', ['c-mice'])
const SKATE = item('skate', ['c-skates'])
const PAD = item('pad', ['c-pads'])

const run = (
  opt: ReturnType<typeof option>,
  rules: ReturnType<typeof rule>[] = [],
  items = [PAD],
  valuePaise = 150_000,
) =>
  resolveDeliveryOptions(
    input({
      config: config({ options: [opt], rules }),
      cart: { valuePaise, weightGrams: 400, items },
      answers: answers(),
    }),
  )

const prices = (r: ReturnType<typeof run>) =>
  Object.fromEntries((find(r, 'std')?.choices ?? []).map((c) => [c.route.key, c.pricePaise]))

describe('faster couriers at their full price', () => {
  it('options saved before keep the difference', () => {
    expect(OptionCouriersSchema.parse({}).extra).toBe('difference')
    const r = run(listOption('difference'))
    expect(find(r, 'std')?.fullPrices).toBeUndefined()
    // ₹59 first, Delhivery Air ₹39 more: + ₹39.
    expect(prices(r)['delhivery:E']).toBe(5900 + 3900)
  })

  it('a dearer courier costs its own price, rounded the option’s way', () => {
    const r = run(listOption('full'))
    expect(find(r, 'std')?.fullPrices).toBe(true)
    expect(prices(r)).toEqual({
      'delhivery:S': 5900,
      'rapidshyp:50': 5900,
      'delhivery:E': 8900,
      'rapidshyp:70': 12900,
    })
  })

  it('rounding and markup apply as on the first courier', () => {
    const r = run(listOption('full', { rounding: 'ten', markupPaise: 1000 }))
    // Surface ₹50 + ₹10 = ₹60; Air ₹89 + ₹10 = ₹99 → ₹100; Blue Dart ₹139 → ₹140.
    expect(prices(r)).toMatchObject({
      'delhivery:S': 6000,
      'delhivery:E': 10000,
      'rapidshyp:70': 14000,
    })
    const half = run(listOption('full', { rounding: 'fifty' }))
    expect(prices(half)['delhivery:E']).toBe(9900)
    expect(prices(half)['rapidshyp:70']).toBe(14900)
  })

  it('free above: every courier is ₹0 to the shopper, so the fastest goes first, free', () => {
    // As with the difference: at the same ₹0 the earliest date wins (pickByStrategy).
    const r = run(listOption('full', { freeAbovePaise: 100_000 }))
    expect(find(r, 'std')?.choices[0]?.route.key).toBe('rapidshyp:70')
    expect(new Set(Object.values(prices(r)))).toEqual(new Set([0]))
  })

  it('a free product rule: the preferred courier is free, a dearer one costs its full price', () => {
    const r = run(listOption('full'), [mice({ mode: 'free' })], [MOUSE])
    expect(find(r, 'std')?.choices[0]?.route.key).toBe('delhivery:E')
    expect(prices(r)['delhivery:E']).toBe(0)
    // Cheaper than the pick: what the pick costs.
    expect(prices(r)['rapidshyp:50']).toBe(0)
    expect(prices(r)['rapidshyp:70']).toBe(12900)
  })

  it('a fixed rule price above a faster courier’s own price: never cheaper than the first', () => {
    const r = run(listOption('full'), [mice({ mode: 'fixed', fixedPaise: 19900 })], [MOUSE])
    expect(prices(r)['delhivery:E']).toBe(19900)
    expect(prices(r)['rapidshyp:70']).toBe(19900)
  })

  it('mixed cart: a free mouse with ₹99 skates pays ₹99 first, Blue Dart its full ₹129', () => {
    const r = run(listOption('full'), [mice({ mode: 'free' }), skates(9900)], [MOUSE, SKATE])
    expect(find(r, 'std')?.pricePaise).toBe(9900)
    expect(prices(r)['rapidshyp:70']).toBe(12900)
  })

  it('the order charges the full price the card showed', () => {
    const opt = listOption('full')
    const r = run(opt)
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: 'rapidshyp:70', insured: false },
      'prepaid',
      shownPrices(r),
      config({ options: [opt] }),
    )
    expect(out.ok && out.shipping.pricePaise).toBe(12900)
  })

  it('nothing extra still prices every courier at the first one’s price', () => {
    const r = run(listOption('none'))
    expect(new Set(Object.values(prices(r)))).toEqual(new Set([5900]))
  })
})
