/** SOURCE OF TRUTH: the `difference` courier list mode with insurance, owner 28 Nov 2026 — WHAT:
 * a card adds the shipping it costs the store more and the insurance it costs more, each at least
 * ₹0 and rounded on its own, so two couriers at one insurance rate add the same / WHY: Waimers,
 * one mouse ₹10,999, PIN 131001, Delhivery Express free: Amazon showed +₹49 and Ekart +₹59 with
 * insurance on (both RapidShyp, 0.89% + GST) because their cheaper shipping leaked into it. */
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

const listOption = option('std', {
  name: 'Standard',
  speed: 'standard',
  strategy: 'fastest',
  price: { source: 'route', rounding: 'ten' },
  insurance: { default: 'on' },
  couriers: { show: 'list', extra: 'difference', roundTo9: true, max: 5, hideSlowerDearer: false },
})

/** Delhivery Express ₹120 (tomorrow); via RapidShyp Amazon ₹100, Ekart ₹115, Blue Dart Air ₹180. */
const answers = [
  answer('delhivery', 'Delhivery', [quote('E', 'Express', 12000, [1, 1])]),
  answer('rapidshyp', 'RapidShyp', [
    quote('8001', 'Amazon Shipping Surface', 10000, [2, 2], 'Amazon Shipping'),
    quote('7001', 'Ekart Surface', 11500, [4, 4], 'Ekart'),
    quote('18002', 'Bluedart Air', 18000, [2, 2], 'Bluedart Air'),
  ]),
]

/** One Hitscan Hyperlight X (₹10,999): computer components, Delhivery Protect 0.40%. */
const MOUSE = { ...item('mouse', ['c-mice']), categoryId: 'el-7-9' }

const run = (insure: boolean) =>
  resolveDeliveryOptions(
    input({
      config: config({ options: [listOption], rules: [MICE] }),
      cart: { valuePaise: 1_099_900, weightGrams: 200, items: [MOUSE] },
      answers,
      insure,
    }),
  )

const card = (r: ReturnType<typeof run>, key: string) =>
  find(r, 'std')?.choices.find((c) => c.route.key === key)
const priceOf = (r: ReturnType<typeof run>, key: string) => card(r, key)?.pricePaise

describe('difference: shipping and insurance gaps priced apart', () => {
  it('insurance off: Amazon and Ekart ship cheaper than Delhivery, so both are ₹0', () => {
    const r = run(false)
    expect(find(r, 'std')?.insurance.on).toBe(false)
    expect(priceOf(r, 'delhivery:E')).toBe(0)
    expect(priceOf(r, 'rapidshyp:8001')).toBe(0)
    expect(priceOf(r, 'rapidshyp:7001')).toBe(0)
  })

  it('insurance on: Amazon and Ekart add the same, the insurance gap only (+₹69)', () => {
    const r = run(true)
    expect(find(r, 'std')?.insurance.on).toBe(true)
    expect(priceOf(r, 'delhivery:E')).toBe(0)
    // RapidShyp 0.89% + GST on ₹10,999 = ₹115.51; Delhivery Protect 0.40% + GST = ₹51.92.
    expect(card(r, 'rapidshyp:8001')?.insurancePaise).toBe(11551)
    expect(card(r, 'delhivery:E')?.insurancePaise).toBe(5192)
    // ₹63.59 up to …9.
    expect(priceOf(r, 'rapidshyp:8001')).toBe(6900)
    expect(priceOf(r, 'rapidshyp:7001')).toBe(6900)
  })

  it('a courier dearer on both adds each gap rounded on its own', () => {
    // Shipping ₹60 → ₹69, insurance ₹63.59 → ₹69.
    expect(priceOf(run(false), 'rapidshyp:18002')).toBe(6900)
    expect(priceOf(run(true), 'rapidshyp:18002')).toBe(13800)
  })

  it('never cheaper than the pick', () => {
    for (const insure of [false, true]) {
      const r = run(insure)
      const pick = priceOf(r, 'delhivery:E') ?? 0
      for (const c of find(r, 'std')?.choices ?? [])
        expect(c.pricePaise).toBeGreaterThanOrEqual(pick)
    }
  })
})
