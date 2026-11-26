/** SOURCE OF TRUTH: a rule's courier wins, 27 Nov 2026 — WHAT: on the fixed layout a Standard
 * option takes a product rule's preferred route even when its speed is Express (mice by Delhivery
 * Air, free), falls back to the next courier the rule allows when the preferred cannot reach the
 * PIN, never picks outside the rule's couriers, leaves products without a rule as before, and
 * keeps split carts, the shown prices, the saved route and booking in step / WHY: live Waimers
 * showed Amazon Shipping (110001) and Ekart (400001) for a mouse whose rule prefers Delhivery
 * Air, because a Standard card only took surface routes before the rule's route was applied. */
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
  traceOf,
} from '../../testing/delivery-options-fixtures'
import type { CourierRateRow } from '../courier-rates'
import { bookingPlan } from './booking'
import { orderDeliveryFor, shownPrices } from './checkout'
import { resolveParcelDeliveries } from './parcels'
import { resolveDeliveryOptions } from './resolve'
import { ruleGroups } from './rule-split'

/** Waimers' live setup: one Standard option priced from zones, Express off. */
const STANDARD = option('std', {
  name: 'Standard',
  speed: 'standard',
  strategy: 'cheapest',
  price: { source: 'zone' },
})
const EXPRESS_OFF = option('exp', { name: 'Express', speed: 'express', enabled: false }, 1)

const MICE = rule(
  'mice',
  {
    name: 'Mice',
    target: { kind: 'collections', values: ['mice'] },
    routes: [
      { carrier: 'delhivery', speed: 'any' },
      { carrier: 'amazon', speed: 'standard' },
      { carrier: 'bluedart', speed: 'any' },
      { carrier: 'ekart', speed: 'standard' },
    ],
    defaultRoute: { carrier: 'delhivery', speed: 'express' },
    price: { mode: 'free' },
  },
  0,
)
const GLASS = rule(
  'glass',
  {
    name: 'Glass pads',
    target: { kind: 'collections', values: ['glass'] },
    routes: [{ carrier: 'delhivery', speed: 'standard' }],
    defaultRoute: { carrier: 'delhivery', speed: 'standard' },
    insurance: 'required',
  },
  1,
)
const cfg = config({ layout: 'fixed', options: [STANDARD, EXPRESS_OFF], rules: [MICE, GLASS] })

const mouse = item('mouse', ['mice'])
const glass = item('pad', ['glass'])
const cable = item('cable')
const cartOf = (...items: ReturnType<typeof item>[]) => ({
  valuePaise: 150_000,
  weightGrams: 400,
  items,
})

/** Delhivery direct (Surface and Air) plus RapidShyp's Amazon, Ekart, Blue Dart and DTDC. */
const delhivery = (air = true) =>
  answer('delhivery', 'Delhivery', [
    quote('S', 'Surface', 7000, [4, 5]),
    ...(air ? [quote('E', 'Express', 9500, [2, 3])] : []),
  ])
const rapidshyp = answer('rapidshyp', 'RapidShyp', [
  quote('50', 'Amazon Shipping Surface', 5200, [4, 5], 'Amazon Shipping'),
  quote('60', 'Ekart Surface', 5600, [4, 6], 'Ekart'),
  quote('70', 'Bluedart Air', 13000, [2, 2], 'Bluedart Air'),
  quote('80', 'DTDC Surface', 4000, [5, 6], 'DTDC Surface'),
])

const run = (items: ReturnType<typeof item>[], answers = [delhivery(), rapidshyp]) =>
  resolveDeliveryOptions(input({ config: cfg, cart: cartOf(...items), answers }))

describe('a rule’s preferred route wins on a Standard card (fixed layout)', () => {
  it('a mouse ships by Delhivery Air, free', () => {
    const r = run([mouse])
    const std = find(r, 'std')
    expect(std?.pick?.route.key).toBe('delhivery:E')
    expect(std?.pricePaise).toBe(0)
    expect(std?.why).toMatchObject({ kind: 'rule_default', ruleId: 'mice' })
    expect(traceOf(r, 'std')?.routes.find((t) => t.key === 'delhivery:E')?.dropped).toBeNull()
    expect(find(r, 'exp')).toBeUndefined()
  })

  it('the order charges what checkout showed and saves Delhivery Air; booking finds it', () => {
    const r = run([mouse])
    const shown = shownPrices(r)
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: false },
      'prepaid',
      shown,
      cfg,
    )
    if (!out.ok) throw new Error(out.problem)
    expect(out.shipping.pricePaise).toBe(0)
    expect(out.delivery.route?.key).toBe('delhivery:E')
    expect(out.delivery.courierCostPaise).toBe(9500)

    const rows = [rateRow('delhivery', 'E', 'Express', 9500), rateRow('rapidshyp', '50', 'Amazon Shipping Surface', 5200)]
    const plan = bookingPlan(
      rows,
      { delivery: out.delivery, option: STANDARD, rules: [MICE], settings: [] },
      { insured: false },
    )
    expect(plan.chosenKey).toBe('delhivery:E')
    expect(plan.chosenProblem).toBeNull()
  })

  it('cash on delivery keeps Delhivery Air', () => {
    const r = run([mouse])
    expect(find(r, 'std')?.cod?.route.key).toBe('delhivery:E')
    const cod = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: false },
      'cod',
      shownPrices(r),
      cfg,
    )
    if (!cod.ok) throw new Error(cod.problem)
    expect(cod.delivery.route?.key).toBe('delhivery:E')
  })

  it('preferred route cannot reach the PIN: the next courier the rule allows, still free', () => {
    const r = run([mouse], [delhivery(false), rapidshyp])
    const std = find(r, 'std')
    // DTDC is cheaper but not one of the rule's couriers; Amazon Surface is the cheapest allowed.
    expect(std?.pick?.route.key).toBe('rapidshyp:50')
    expect(std?.pricePaise).toBe(0)
    expect(traceOf(r, 'std')?.routes.find((t) => t.key === 'rapidshyp:80')?.dropped).toBe('rule')
  })

  it('never a courier outside the rule, whatever the preferred route does', () => {
    for (const answers of [[delhivery(), rapidshyp], [delhivery(false), rapidshyp]]) {
      const key = find(run([mouse], answers), 'std')?.pick?.route.carrierKey
      expect(['delhivery', 'amazon', 'bluedart', 'ekart']).toContain(key)
    }
  })

  it('a product with no rule is unchanged: the cheapest Surface route at the zone price', () => {
    const std = find(run([cable]), 'std')
    expect(std?.pick?.route.key).toBe('rapidshyp:80')
    expect(std?.pricePaise).toBe(4900)
    expect(std?.why).toMatchObject({ kind: 'cheapest' })
  })

  it('a mouse and a glass pad in one parcel: the courier both rules allow (Delhivery Surface)', () => {
    expect(ruleGroups(cfg, [mouse, glass], [delhivery(), rapidshyp], 800)).toBeNull()
    const std = find(run([mouse, glass]), 'std')
    expect(std?.pick?.route.key).toBe('delhivery:S')
    expect(std?.insurance.required).toBe(true)
  })

  it('split cart (glass pad + mouse as two parcels): each parcel keeps its rule’s courier', () => {
    const { config: _c, cart: _cart, answers: _a, ...base } = input()
    const r = resolveParcelDeliveries(
      { ...base, config: cfg },
      [
        { cart: { valuePaise: 100_000, weightGrams: 600, items: [glass] }, answers: [delhivery(), rapidshyp] },
        { cart: { valuePaise: 50_000, weightGrams: 200, items: [mouse] }, answers: [delhivery(), rapidshyp] },
      ],
      150_000,
    )
    expect(r.parcels?.map((p) => find(p, 'std')?.pick?.route.key)).toEqual([
      'delhivery:S',
      'delhivery:E',
    ])
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: true },
      'prepaid',
      shownPrices(r),
      cfg,
      ['loc-a:open', 'loc-b:open'],
    )
    if (!out.ok) throw new Error(out.problem)
    expect(out.delivery.parcels?.map((p) => p.route.key)).toEqual(['delhivery:S', 'delhivery:E'])
  })
})

/** A Create shipment rate row, as `bookingPlan` reads it. */
function rateRow(
  providerId: string,
  serviceId: string,
  serviceLabel: string,
  pricePaise: number,
): CourierRateRow {
  return {
    optionKey: `${providerId}:${serviceId}`,
    providerId,
    providerName: providerId,
    providerLabel: providerId,
    serviceId,
    serviceLabel,
    carrier: providerId === 'delhivery' ? null : serviceLabel,
    charges: [],
    chargeableWeightGrams: null,
    pricePaise,
    minTransitDays: 2,
    maxTransitDays: 3,
    codAvailable: true,
    problem: null,
    problemDetail: null,
    deliveryBy: '2026-11-05',
    etaFromSettings: false,
    badges: [],
  } as CourierRateRow
}
