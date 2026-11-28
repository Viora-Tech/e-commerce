/** SOURCE OF TRUTH: the `own` courier list mode, owner 28 Nov 2026 — WHAT: only the recommended
 * courier gets the option's or rule's price; every other courier shows its own shipping price
 * (rounded the option's way) plus its own insurance when ticked, never below the pick, and the
 * order charges what the card showed / WHY: Waimers, PIN 131001, two mice under the Free "Mice"
 * rule: with insurance on Amazon showed +₹109 and Ekart +₹129 under `difference`; the owner
 * chose "Only the recommended courier gets your price; others pay their own price". */
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
import { resolveDeliveryOptions } from './resolve'

const MICE = rule(
  'mice',
  {
    name: 'Mice',
    target: { kind: 'collections', values: ['c-mice'] },
    routes: [
      { carrier: 'delhivery', speed: 'express' },
      { carrier: 'amazon', speed: 'standard' },
      { carrier: 'bluedart' },
      { carrier: 'ekart', speed: 'standard' },
    ],
    defaultRoute: { carrier: 'delhivery', speed: 'express' },
    price: { mode: 'free' },
  },
  0,
)

const listOption = (extra: string) =>
  option('std', {
    name: 'Standard',
    speed: 'standard',
    strategy: 'fastest',
    price: { source: 'route', rounding: 'ten' },
    insurance: { default: 'on' },
    couriers: { show: 'list', extra, roundTo9: true, max: 5, hideSlowerDearer: false },
  })

/** Delhivery Air ₹120 (tomorrow); via RapidShyp Amazon ₹100, Ekart ₹115, Blue Dart Air ₹180. */
const answers = [
  answer('delhivery', 'Delhivery', [quote('E', 'Express', 12000, [1, 1])]),
  answer('rapidshyp', 'RapidShyp', [
    quote('8001', 'Amazon Shipping Surface', 10000, [2, 2], 'Amazon Shipping'),
    quote('7001', 'Ekart Surface', 11500, [4, 4], 'Ekart'),
    quote('18002', 'Bluedart Air', 18000, [2, 2], 'Bluedart Air'),
  ]),
]

/** Two Hitscan Hyperlight X (₹10,999 each): computer components, Delhivery Protect 0.40%. */
const MOUSE = { ...item('mouse', ['c-mice']), categoryId: 'el-7-9' }

const run = (insure: boolean, extra = 'own', rules = [MICE]) =>
  resolveDeliveryOptions(
    input({
      config: config({ options: [listOption(extra)], rules }),
      cart: { valuePaise: 2_199_800, weightGrams: 400, items: [MOUSE] },
      answers,
      insure,
    }),
  )

const card = (r: ReturnType<typeof run>, key: string) =>
  find(r, 'std')?.choices.find((c) => c.route.key === key)
const priceOf = (r: ReturnType<typeof run>, key: string) => card(r, key)?.pricePaise

/* RapidShyp's insurance on ₹21,998: 0.89% + 18% GST = ₹231.02, rounded up to ₹240. */
const RAPIDSHYP_INSURANCE = 24000

describe('own: only the recommended courier gets the price', () => {
  it('two mice, insurance off: Delhivery Air ₹0, Amazon and Ekart their own shipping', () => {
    const r = run(false)
    expect(find(r, 'std')?.insurance.on).toBe(false)
    expect(priceOf(r, 'delhivery:E')).toBe(0)
    expect(priceOf(r, 'rapidshyp:8001')).toBe(10000)
    // ₹115 up to the next ₹10.
    expect(priceOf(r, 'rapidshyp:7001')).toBe(12000)
    expect(find(r, 'std')?.fullPrices).toBe(true)
  })

  it('insurance on: each adds its own insurance, the same for both RapidShyp couriers', () => {
    const off = run(false)
    const on = run(true)
    expect(find(on, 'std')?.insurance.on).toBe(true)
    // The Free rule still covers the recommended courier, insurance included.
    expect(priceOf(on, 'delhivery:E')).toBe(0)
    const amazon = (priceOf(on, 'rapidshyp:8001') ?? 0) - (priceOf(off, 'rapidshyp:8001') ?? 0)
    const ekart = (priceOf(on, 'rapidshyp:7001') ?? 0) - (priceOf(off, 'rapidshyp:7001') ?? 0)
    expect(amazon).toBe(RAPIDSHYP_INSURANCE)
    expect(ekart).toBe(RAPIDSHYP_INSURANCE)
    expect(priceOf(on, 'rapidshyp:8001')).toBe(10000 + RAPIDSHYP_INSURANCE)
    expect(card(on, 'rapidshyp:8001')?.insurancePaise).toBe(23102)
  })

  it('a courier dearer than the pick shows its own price', () => {
    expect(priceOf(run(false), 'rapidshyp:18002')).toBe(18000)
    expect(priceOf(run(true), 'rapidshyp:18002')).toBe(18000 + RAPIDSHYP_INSURANCE)
  })

  it('never cheaper than the pick: with no rule, Amazon at ₹100 shows the pick’s ₹120', () => {
    const r = run(false, 'own', [])
    expect(priceOf(r, 'delhivery:E')).toBe(12000)
    expect(priceOf(r, 'rapidshyp:8001')).toBe(12000)
    expect(priceOf(r, 'rapidshyp:18002')).toBe(18000)
  })

  it('the order charges what the card showed, insured or not', () => {
    for (const insured of [false, true]) {
      const r = run(insured)
      const shown = priceOf(r, 'rapidshyp:7001')
      const choice = { optionId: 'std', routeKey: 'rapidshyp:7001', insured }
      const out = orderDeliveryFor(r, choice, 'prepaid', shownPrices(r), config())
      if (!out.ok) throw new Error('expected an order')
      expect(out.shipping.pricePaise).toBe(shown)
    }
  })

  it('difference: Amazon and Ekart add the same insurance gap with insurance on, ₹0 off', () => {
    expect(priceOf(run(false, 'difference'), 'rapidshyp:8001')).toBe(0)
    expect(priceOf(run(false, 'difference'), 'rapidshyp:7001')).toBe(0)
    // Was +₹109 and +₹129 before shipping and insurance were priced apart (28 Nov 2026).
    expect(priceOf(run(true, 'difference'), 'rapidshyp:8001')).toBe(12900)
    expect(priceOf(run(true, 'difference'), 'rapidshyp:7001')).toBe(12900)
  })
})
