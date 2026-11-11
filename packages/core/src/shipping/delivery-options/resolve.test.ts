/** SOURCE OF TRUTH: delivery options engine tests — WHAT: strategies, route filtering, the Glasspads and Mice rules, mixed carts, ₹10 round-up, Express prepaid only, fallback / WHY: the owner's P1 rules must keep holding. */
import { describe, expect, it } from 'vitest'
import {
  type DeliveryConfig,
  type DeliveryOption,
  DeliveryOptionInputSchema,
  type RouteRule,
  RouteRuleInputSchema,
} from './config'
import { roundUpToTenRupees } from './price'
import { chosenRoute, resolveDeliveryOptions } from './resolve'
import type { ResolveInput } from './resolve-types'
import type { ProviderAnswer, QuotedService } from './routes'
import type { CartItemFacts } from './rules'

// Monday 3 Nov 2026, 10:00 IST: before the cut-off, every day a working and delivery day.
const NOW = new Date('2026-11-02T04:30:00Z')
const POLICY = {
  cutoff: '18:00',
  timeZone: 'Asia/Kolkata',
  workingDays: [1, 2, 3, 4, 5, 6, 7],
  deliveryDays: [1, 2, 3, 4, 5, 6, 7],
  holidays: [],
  defaultMinTransitDays: 4,
  defaultMaxTransitDays: 6,
  codAllowed: true,
}

const svc = (
  over: Partial<QuotedService> & Pick<QuotedService, 'serviceId' | 'serviceLabel'>,
): QuotedService => ({
  carrier: null,
  pricePaise: null,
  codPricePaise: null,
  insurancePaise: null,
  minTransitDays: null,
  maxTransitDays: null,
  codAvailable: true,
  ...over,
})

const answer = (
  providerId: string,
  providerLabel: string,
  services: QuotedService[],
  over: Partial<ProviderAnswer> = {},
): ProviderAnswer => ({
  providerId,
  providerLabel,
  status: 'ok',
  source: 'live',
  ms: 300,
  error: null,
  serviceable: true,
  services,
  ...over,
})

/** Delhivery direct: Surface ₹60 (4–5 d), Express ₹102 (2–3 d). */
const delhivery = () =>
  answer('delhivery', 'Delhivery', [
    svc({
      serviceId: 'S',
      serviceLabel: 'Surface',
      pricePaise: 6000,
      codPricePaise: 9000,
      minTransitDays: 4,
      maxTransitDays: 5,
    }),
    svc({
      serviceId: 'E',
      serviceLabel: 'Express',
      pricePaise: 10200,
      minTransitDays: 2,
      maxTransitDays: 3,
    }),
  ])

/**
 * Shiprocket: Delhivery Surface ₹80, Bluedart Air ₹128 (1–2 d), DTDC Surface ₹55 (5–6 d), no COD.
 * ₹55 rounds up to the same ₹60 the shopper pays for Delhivery direct; pass a lower DTDC price
 * (₹45 → ₹50) when a test needs DTDC to be cheaper for the shopper too.
 */
const shiprocket = (dtdcPaise = 5500) =>
  answer('shiprocket', 'Shiprocket', [
    svc({
      serviceId: '10',
      serviceLabel: 'Delhivery Surface',
      carrier: 'Delhivery Surface',
      pricePaise: 8000,
      codPricePaise: 10000,
      minTransitDays: 4,
      maxTransitDays: 5,
    }),
    svc({
      serviceId: '20',
      serviceLabel: 'Bluedart Air',
      carrier: 'Bluedart Air',
      pricePaise: 12800,
      minTransitDays: 1,
      maxTransitDays: 2,
    }),
    svc({
      serviceId: '30',
      serviceLabel: 'DTDC Surface',
      carrier: 'DTDC Surface',
      pricePaise: dtdcPaise,
      minTransitDays: 5,
      maxTransitDays: 6,
      codAvailable: false,
    }),
  ])

const option = (id: string, input: Record<string, unknown>, position = 0): DeliveryOption => ({
  ...DeliveryOptionInputSchema.parse(input),
  id,
  position,
})
const STANDARD = option('std', { name: 'Standard', speed: 'standard', strategy: 'cheapest' }, 0)
const EXPRESS = option(
  'exp',
  { name: 'Express', speed: 'express', strategy: 'fastest', cod: { mode: 'prepaid_only' } },
  1,
)

const rule = (id: string, input: Record<string, unknown>, position: number): RouteRule => ({
  ...RouteRuleInputSchema.parse(input),
  id,
  position,
})
/** The owner's two rules. */
const GLASSPADS = rule(
  'glass',
  {
    name: 'Glasspads',
    target: { kind: 'collections', values: ['col-glasspads'] },
    routes: [{ carrier: 'delhivery' }],
  },
  0,
)
const MICE = rule(
  'mice',
  {
    name: 'Mice',
    target: { kind: 'collections', values: ['col-mice'] },
    optionIds: ['exp'],
    routes: [
      { carrier: 'delhivery', channel: 'direct', speed: 'express' },
      { carrier: 'bluedart', speed: 'express' },
    ],
    defaultRoute: { carrier: 'delhivery', channel: 'direct', speed: 'express' },
    alternatives: [{ carrier: 'bluedart', speed: 'express' }],
  },
  1,
)

const item = (productId: string, collectionIds: string[] = []): CartItemFacts => ({
  productId,
  collectionIds,
  tags: [],
  productType: null,
})

const config = (over: Partial<DeliveryConfig> = {}): DeliveryConfig => ({
  options: [STANDARD, EXPRESS],
  rules: [],
  routeSettings: [],
  version: 'v1',
  ...over,
})

const input = (over: Partial<ResolveInput> = {}): ResolveInput => ({
  config: config(),
  cart: { valuePaise: 150_000, weightGrams: 400, items: [item('p1')] },
  answers: [delhivery(), shiprocket()],
  zone: {
    kind: 'rates',
    options: [
      {
        rateId: 'rate-1',
        name: 'Standard',
        zoneId: 'z',
        zoneName: 'India',
        listPricePaise: 4900,
        pricePaise: 4900,
        codSurchargePaise: null,
        minTransitDays: null,
        maxTransitDays: null,
      },
    ],
  },
  policy: POLICY,
  now: NOW,
  ...over,
})

const find = (r: ReturnType<typeof resolveDeliveryOptions>, id: string) =>
  r.options.find((o) => o.optionId === id)
const dropOf = (r: ReturnType<typeof resolveDeliveryOptions>, optionId: string, key: string) =>
  r.trace.options.find((o) => o.optionId === optionId)?.routes.find((x) => x.key === key)?.dropped

describe('roundUpToTenRupees', () => {
  it('rounds up to the next ₹10 and leaves an exact ₹10 alone', () => {
    expect(roundUpToTenRupees(14_100)).toBe(15_000)
    expect(roundUpToTenRupees(15_000)).toBe(15_000)
    expect(roundUpToTenRupees(1)).toBe(1_000)
    expect(roundUpToTenRupees(0)).toBe(0)
  })
})

describe('strategies', () => {
  it('cheapest: Standard takes the lowest shopper price, which is DTDC via Shiprocket', () => {
    const r = resolveDeliveryOptions(input({ answers: [delhivery(), shiprocket(4500)] }))
    const std = find(r, 'std')
    expect(std?.pick?.route.key).toBe('shiprocket:30')
    expect(std?.title).toBe('Standard · DTDC')
    expect(std?.pricePaise).toBe(5000) // ₹45 → ₹50
    expect(std?.why).toEqual({ kind: 'cheapest' })
  })

  it('cheapest: at the same shopper price the faster route wins, even if it costs the store more', () => {
    // DTDC ₹55 and Delhivery ₹60 both show ₹60; Delhivery arrives a day earlier.
    const r = resolveDeliveryOptions(input())
    const std = find(r, 'std')
    expect(std?.pick?.route.key).toBe('delhivery:S')
    expect(std?.title).toBe('Standard · Delhivery')
    expect(std?.pricePaise).toBe(6000)
    expect(std?.why).toEqual({ kind: 'cheapest' })
  })

  it('cheapest: a tie goes to the direct route', () => {
    const tied = answer('shiprocket', 'Shiprocket', [
      svc({
        serviceId: '10',
        serviceLabel: 'Delhivery Surface',
        carrier: 'Delhivery',
        pricePaise: 6000,
        minTransitDays: 4,
        maxTransitDays: 5,
      }),
    ])
    const r = resolveDeliveryOptions(input({ answers: [delhivery(), tied] }))
    expect(find(r, 'std')?.pick?.route.key).toBe('delhivery:S')
  })

  it('a preferred courier wins at the same shopper price, before the earlier arrival (#1520)', () => {
    // DTDC ₹55 and Delhivery ₹60 both show ₹60; Delhivery is faster, but the merchant prefers DTDC.
    const std = option('std', { name: 'Standard', speed: 'standard', preferCarrier: 'dtdc' })
    const r = resolveDeliveryOptions(input({ config: config({ options: [std, EXPRESS] }) }))
    expect(find(r, 'std')?.pick?.route.key).toBe('shiprocket:30')
    expect(find(r, 'std')?.pricePaise).toBe(6000)
  })

  it('a preferred courier never makes the shopper pay more', () => {
    // DTDC ₹45 shows ₹50; the preferred Delhivery shows ₹60, so DTDC still wins.
    const std = option('std', { name: 'Standard', speed: 'standard', preferCarrier: 'delhivery' })
    const r = resolveDeliveryOptions(
      input({
        config: config({ options: [std, EXPRESS] }),
        answers: [delhivery(), shiprocket(4500)],
      }),
    )
    expect(find(r, 'std')?.pick?.route.key).toBe('shiprocket:30')
  })

  it('fastest keeps its date: a preferred courier that arrives later does not win', () => {
    const exp = option('exp', {
      name: 'Express',
      speed: 'express',
      strategy: 'fastest',
      cod: { mode: 'prepaid_only' },
      preferCarrier: 'delhivery',
    })
    const r = resolveDeliveryOptions(input({ config: config({ options: [STANDARD, exp] }) }))
    expect(find(r, 'exp')?.pick?.route.key).toBe('shiprocket:20')
  })

  it('fastest: Express takes the earliest arrival (Blue Dart Air), shown by its carrier', () => {
    const r = resolveDeliveryOptions(input())
    const exp = find(r, 'exp')
    expect(exp?.pick?.route.key).toBe('shiprocket:20')
    expect(exp?.title).toBe('Express · Blue Dart')
    expect(exp?.pricePaise).toBe(13_000) // ₹128 → ₹130
    expect(exp?.why).toEqual({ kind: 'fastest' })
  })

  it('fastest: a same-date tie goes to the cheaper route', () => {
    const slowAir = answer('shiprocket', 'Shiprocket', [
      svc({
        serviceId: '20',
        serviceLabel: 'Bluedart Air',
        carrier: 'Bluedart Air',
        pricePaise: 15000,
        minTransitDays: 2,
        maxTransitDays: 3,
      }),
    ])
    const r = resolveDeliveryOptions(input({ answers: [delhivery(), slowAir] }))
    expect(find(r, 'exp')?.pick?.route.key).toBe('delhivery:E')
  })

  it('prefer direct within ₹X beats a slightly cheaper aggregator route', () => {
    const preferring = option('std', {
      name: 'Standard',
      strategy: 'cheapest',
      preferDirectWithinPaise: 1000,
    })
    const r = resolveDeliveryOptions(
      input({
        config: config({ options: [preferring] }),
        answers: [delhivery(), shiprocket(5000)],
      }),
    )
    const std = find(r, 'std')
    expect(std?.pick?.route.key).toBe('delhivery:S') // ₹60 direct vs ₹50 DTDC: within ₹10
    expect(std?.why).toEqual({ kind: 'prefer_direct', withinPaise: 1000 })
  })

  it('adds markup, rounds up, applies caps and free-above', () => {
    const marked = option('std', {
      name: 'Standard',
      price: { markupPaise: 1000, markupPercent: 10, maxPaise: 7000 },
    })
    const r = resolveDeliveryOptions(input({ config: config({ options: [marked] }) }))
    // ₹55 + ₹10 + 10% (₹5.50) = ₹70.50 → ₹80, capped at ₹70.
    expect(find(r, 'std')?.pricePaise).toBe(7000)
    const free = option('std', { name: 'Standard', price: { freeAbovePaise: 100_000 } })
    const f = find(resolveDeliveryOptions(input({ config: config({ options: [free] }) })), 'std')
    expect(f?.pricePaise).toBe(0)
    expect(f?.listPricePaise).toBe(6000)
  })
})

describe('route filtering', () => {
  it('drops a route the PIN code is not served by, and says so', () => {
    const r = resolveDeliveryOptions(
      input({
        answers: [
          answer('delhivery', 'Delhivery', delhivery().services, { serviceable: false }),
          shiprocket(),
        ],
      }),
    )
    expect(dropOf(r, 'std', 'delhivery:S')).toBe('not_serviceable')
    expect(find(r, 'std')?.pick?.route.providerId).toBe('shiprocket')
  })

  it('insurance on drops routes that do not insure (Blue Dart direct)', () => {
    const insuredStd = option('std', { name: 'Standard', insurance: { default: 'on' } })
    const bluedart = answer('bluedart', 'Blue Dart', [
      svc({
        serviceId: 'A',
        serviceLabel: 'Ground',
        pricePaise: 3000,
        minTransitDays: 3,
        maxTransitDays: 4,
      }),
    ])
    const r = resolveDeliveryOptions(
      input({
        config: config({ options: [insuredStd] }),
        answers: [delhivery(), shiprocket(), bluedart],
      }),
    )
    expect(dropOf(r, 'std', 'bluedart:A')).toBe('no_insurance')
    expect(find(r, 'std')?.pick?.route.key).not.toBe('bluedart:A')
    expect(find(r, 'std')?.insurance).toMatchObject({ offered: true, on: true, required: false })
    // Unticked: the cheaper uninsured route wins again.
    const off = resolveDeliveryOptions(
      input({
        config: config({ options: [insuredStd] }),
        answers: [delhivery(), shiprocket(), bluedart],
        declineInsurance: true,
      }),
    )
    expect(find(off, 'std')?.pick?.route.key).toBe('bluedart:A')
  })

  it('prices insurance from the route rate (% with a minimum) and rounds the total', () => {
    const insuredStd = option('std', { name: 'Standard', insurance: { default: 'on' } })
    const settings = [
      {
        key: 'carrier:dtdc|channel:shiprocket',
        insurancePercent: 0.5,
        insuranceMinPaise: 2000,
        enabled: true,
      },
      {
        key: 'carrier:delhivery|channel:any',
        insurancePercent: 1,
        insuranceMinPaise: 3000,
        enabled: true,
      },
    ]
    const r = resolveDeliveryOptions(
      input({ config: config({ options: [insuredStd], routeSettings: settings }) }),
    )
    const std = find(r, 'std')
    // ₹1,500 × 0.5% = ₹7.50, minimum ₹20 → ₹55 + ₹20 = ₹75 → ₹80
    expect(std?.pick?.insurancePaise).toBe(2000)
    expect(std?.pricePaise).toBe(8000)
  })

  it('an unpriced insurance rate charges ₹0 and reports null', () => {
    const insuredStd = option('std', { name: 'Standard', insurance: { default: 'on' } })
    const r = resolveDeliveryOptions(input({ config: config({ options: [insuredStd] }) }))
    expect(find(r, 'std')?.insurance.pricePaise).toBeNull()
    expect(find(r, 'std')?.pricePaise).toBe(6000)
  })

  it('Standard is picked again for COD: DTDC has no COD, so COD ships Delhivery', () => {
    const r = resolveDeliveryOptions(input({ answers: [delhivery(), shiprocket(4500)] }))
    const std = find(r, 'std')
    expect(std?.codAllowed).toBe(true)
    expect(std?.cod?.route.key).toBe('delhivery:S')
    expect(std?.cod?.pricePaise).toBe(9000) // COD price ₹90
    expect(std && chosenRoute(std, null, 'cod')?.route.key).toBe('delhivery:S')
    expect(std && chosenRoute(std, null, 'prepaid')?.route.key).toBe('shiprocket:30')
  })

  it('Express is prepaid only, even when its saved COD mode says allowed', () => {
    const codExpress = option('exp', {
      name: 'Express',
      speed: 'express',
      strategy: 'fastest',
      cod: { mode: 'allowed' },
    })
    const r = resolveDeliveryOptions(input({ config: config({ options: [STANDARD, codExpress] }) }))
    expect(find(r, 'exp')?.codAllowed).toBe(false)
    expect(find(r, 'exp')?.cod).toBeNull()
  })

  it('a route without a live price needs a cost card', () => {
    const bluedart = answer('bluedart', 'Blue Dart', [
      svc({ serviceId: 'A', serviceLabel: 'Apex', minTransitDays: 1, maxTransitDays: 1 }),
    ])
    const r = resolveDeliveryOptions(input({ answers: [delhivery(), bluedart] }))
    expect(dropOf(r, 'exp', 'bluedart:A')).toBe('no_price')
    const card = [
      {
        key: 'bluedart:A',
        costCard: { firstHalfKgPaise: 9000, extraHalfKgPaise: 3000, codFeePaise: 0 },
        enabled: true,
      },
    ]
    const priced = resolveDeliveryOptions(
      input({
        answers: [delhivery(), bluedart],
        config: config({ routeSettings: card }),
        cart: { valuePaise: 100_000, weightGrams: 1200, items: [item('p')] },
      }),
    )
    // 1.2 kg = three 500 g steps: ₹90 + 2 × ₹30
    expect(find(priced, 'exp')?.pick?.route.key).toBe('bluedart:A')
    expect(find(priced, 'exp')?.pick?.courierCostPaise).toBe(15_000)
  })

  it('a disabled route is skipped', () => {
    const settings = [{ key: 'shiprocket:30', enabled: false }]
    const r = resolveDeliveryOptions(input({ config: config({ routeSettings: settings }) }))
    expect(dropOf(r, 'std', 'shiprocket:30')).toBe('disabled')
  })
})

describe('product route rules', () => {
  it('Glasspads ship with Delhivery only, on every option', () => {
    const r = resolveDeliveryOptions(
      input({
        config: config({ rules: [GLASSPADS] }),
        cart: { valuePaise: 150_000, weightGrams: 400, items: [item('pad', ['col-glasspads'])] },
      }),
    )
    expect(find(r, 'std')?.pick?.route.key).toBe('delhivery:S') // DTDC dropped by the rule
    expect(find(r, 'std')?.title).toBe('Standard · Delhivery')
    expect(find(r, 'exp')?.pick?.route.key).toBe('delhivery:E')
    expect(dropOf(r, 'std', 'shiprocket:30')).toBe('rule')
    expect(r.trace.options[0]?.rulesApplied).toEqual([{ id: 'glass', name: 'Glasspads' }])
  })

  it('Mice: Express defaults to Delhivery Express, with Blue Dart Air as a sub-choice', () => {
    const r = resolveDeliveryOptions(
      input({
        config: config({ rules: [MICE] }),
        cart: { valuePaise: 150_000, weightGrams: 300, items: [item('mouse', ['col-mice'])] },
      }),
    )
    const exp = find(r, 'exp')
    expect(exp?.pick?.route.key).toBe('delhivery:E')
    expect(exp?.pickedBy).toBe('rule:mice')
    expect(exp?.choices.map((c) => c.route.key)).toEqual(['delhivery:E', 'shiprocket:20'])
    expect(exp && chosenRoute(exp, 'shiprocket:20', 'prepaid')?.pricePaise).toBe(13_000)
    // Standard is untouched by the Mice rule: the faster Delhivery Surface at the same ₹60.
    expect(find(r, 'std')?.pick?.route.key).toBe('delhivery:S')
  })

  it('mixed cart: Glasspads + Mice share Delhivery Express, so Express is Delhivery with no Blue Dart choice', () => {
    const r = resolveDeliveryOptions(
      input({
        config: config({ rules: [GLASSPADS, MICE] }),
        cart: {
          valuePaise: 300_000,
          weightGrams: 700,
          items: [item('pad', ['col-glasspads']), item('mouse', ['col-mice'])],
        },
      }),
    )
    const exp = find(r, 'exp')
    expect(exp?.pick?.route.key).toBe('delhivery:E')
    expect(exp?.choices).toEqual([])
    expect(
      r.trace.options.find((t) => t.optionId === 'exp')?.rulesApplied.map((x) => x.id),
    ).toEqual(['glass', 'mice'])
  })

  it('mixed cart with nothing in common: the highest-placed rule wins and the other is overruled', () => {
    const blueOnly = rule(
      'blue',
      {
        name: 'Blue only',
        target: { kind: 'products', values: ['b'] },
        routes: [{ carrier: 'bluedart' }],
      },
      1,
    )
    const r = resolveDeliveryOptions(
      input({
        config: config({ rules: [GLASSPADS, blueOnly] }),
        cart: { valuePaise: 1, weightGrams: 1, items: [item('pad', ['col-glasspads']), item('b')] },
      }),
    )
    const t = r.trace.options.find((o) => o.optionId === 'exp')
    expect(t?.rulesApplied.map((x) => x.id)).toEqual(['glass'])
    expect(t?.rulesOverruled.map((x) => x.id)).toEqual(['blue'])
    expect(find(r, 'exp')?.pick?.route.carrier).toBe('Delhivery')
  })

  it('a rule that requires insurance hides the checkbox and keeps it on', () => {
    const required = rule(
      'req',
      {
        name: 'Fragile',
        target: { kind: 'tags', values: ['FRAGILE'] },
        routes: [{ carrier: 'any' }],
        insurance: 'required',
      },
      0,
    )
    const r = resolveDeliveryOptions(
      input({
        config: config({ rules: [required] }),
        declineInsurance: true,
        cart: { valuePaise: 1, weightGrams: 1, items: [{ ...item('x'), tags: ['fragile'] }] },
      }),
    )
    expect(find(r, 'std')?.insurance).toMatchObject({ offered: false, required: true, on: true })
  })
})

describe('fallback', () => {
  it('couriers down: Standard at the zone rate on backup, Express hidden', () => {
    const down = (id: string) =>
      answer(id, id, [], { status: 'failed', serviceable: null, error: 'timeout', ms: null })
    const r = resolveDeliveryOptions(input({ answers: [down('delhivery'), down('shiprocket')] }))
    expect(r.status).toBe('options')
    expect(r.options.map((o) => o.optionId)).toEqual(['std'])
    const std = find(r, 'std')
    expect(std).toMatchObject({
      source: 'backup',
      pick: null,
      pricePaise: 4900,
      title: 'Standard',
      codAllowed: true,
    })
    expect(std?.backupRate?.rateId).toBe('rate-1')
    expect(r.trace.options.find((o) => o.optionId === 'exp')?.hidden).toBe('couriers_down')
  })

  it('one courier down: picks among those that answered', () => {
    const down = answer('shiprocket', 'Shiprocket', [], {
      status: 'failed',
      serviceable: null,
      error: 'timeout',
    })
    const r = resolveDeliveryOptions(input({ answers: [delhivery(), down] }))
    expect(find(r, 'std')?.pick?.route.key).toBe('delhivery:S')
    expect(find(r, 'std')?.source).toBe('live')
  })

  it('every courier truly said no: unserviceable', () => {
    const no = (id: string) => answer(id, id, [], { serviceable: false })
    const r = resolveDeliveryOptions(input({ answers: [no('delhivery'), no('shiprocket')] }))
    expect(r.status).toBe('unserviceable')
    expect(r.options).toEqual([])
  })

  it('no couriers connected: Standard on backup', () => {
    const r = resolveDeliveryOptions(input({ answers: [] }))
    expect(r.options.map((o) => o.source)).toEqual(['backup'])
  })

  it('no zone rate covers the address: nothing to show', () => {
    const r = resolveDeliveryOptions(input({ answers: [], zone: { kind: 'no_rates' } }))
    expect(r.status).toBe('none')
  })
})

describe('courier list (the option shows every allowed courier)', () => {
  const LIST = option(
    'list',
    {
      name: 'Delivery',
      speed: 'standard',
      strategy: 'cheapest',
      couriers: { show: 'list', max: 4 },
    },
    0,
  )
  const listInput = (over: Partial<ResolveInput> = {}) =>
    input({ config: { ...config(), options: [LIST] }, ...over })

  it('lists couriers of any speed: the pick at its price, the rest at price + the difference', () => {
    const r = resolveDeliveryOptions(listInput())
    const o = find(r, 'list')
    expect(o?.layout).toBe('list')
    const keys = o?.choices.map((c) => c.route.key)
    // Pick: Delhivery Surface ₹60 (same shopper price as DTDC, earlier). DTDC is slower and
    // not dearer, so it goes; Delhivery Express and Bluedart Air follow with their extra.
    expect(keys?.[0]).toBe('delhivery:S')
    expect(keys).toContain('delhivery:E')
    expect(keys).toContain('shiprocket:20')
    const express = o?.choices.find((c) => c.route.key === 'delhivery:E')
    // ₹102 - ₹60 = ₹42 more → +₹49 on top of the pick's ₹60.
    expect(express?.pricePaise).toBe(6_000 + 4_900)
  })

  it('keeps one card per courier and speed (the cheaper app wins)', () => {
    const r = resolveDeliveryOptions(listInput())
    const delhiveryStandard = find(r, 'list')?.choices.filter(
      (c) => c.route.carrierKey === 'delhivery' && c.route.speed === 'standard',
    )
    expect(delhiveryStandard).toHaveLength(1)
    expect(delhiveryStandard?.[0]?.route.key).toBe('delhivery:S')
  })

  it('an option that hides courier names shows only the delivery promise (#1521)', () => {
    const hidden = option('list', {
      name: 'Delivery',
      speed: 'standard',
      couriers: { show: 'list', max: 4, showNames: false },
    })
    const std = option('std', { name: 'Standard', couriers: { showNames: false } })
    const r = resolveDeliveryOptions(input({ config: config({ options: [std, hidden, EXPRESS] }) }))
    expect(find(r, 'std')?.title).toBe('Standard')
    expect(find(r, 'std')?.pick?.route.showCarrier).toBe(false)
    expect(find(r, 'std')?.cod?.route.showCarrier).toBe(false)
    expect(find(r, 'list')?.choices.every((c) => !c.route.showCarrier)).toBe(true)
    // Another option keeps its courier names.
    expect(find(r, 'exp')?.title).toBe('Express · Blue Dart')
  })

  it('a one-card option is unchanged', () => {
    const r = resolveDeliveryOptions(input())
    expect(find(r, 'std')?.layout).toBe('one')
  })
})
