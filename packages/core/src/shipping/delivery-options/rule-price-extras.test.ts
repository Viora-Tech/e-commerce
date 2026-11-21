/** SOURCE OF TRUTH: a rule price's per-courier fixed prices and packing charge, owner 21 Nov
 * 2026 — WHAT: a Fixed rule naming couriers' own prices (a courier not named keeps Fixed's
 * behaviour), a packing charge added after rounding on the option's price and on Fixed but not
 * on Free, each rule's packing once in a mixed cart, insurance on top, COD, and the order
 * charging what the card showed / WHY: arm sleeves "Delhivery ₹99, Blue Dart ₹139"; switches
 * pay courier cost plus packing. */
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
  svc,
} from '../../testing/delivery-options-fixtures'
import { orderDeliveryFor, shownPrices } from './checkout'
import { RouteRuleInputSchema } from './config'
import { resolveDeliveryOptions } from './resolve'
import { roundPrice } from './rounding'

/** Delhivery Surface ₹45 and Air ₹89 (COD ₹30 more), Amazon ₹59, Blue Dart Air ₹129. */
const answers = (bluedartInsurance: number | null = null) => [
  answer('delhivery', 'Delhivery', [
    quote('S', 'Surface', 4500, [4, 5]),
    svc({
      serviceId: 'E',
      serviceLabel: 'Express',
      pricePaise: 8900,
      codPricePaise: 11900,
      minTransitDays: 2,
      maxTransitDays: 3,
    }),
  ]),
  answer('rapidshyp', 'RapidShyp', [
    quote('50', 'Amazon Shipping Surface', 5900, [4, 5], 'Amazon Shipping'),
    svc({
      serviceId: '70',
      serviceLabel: 'Bluedart Air',
      carrier: 'Bluedart Air',
      pricePaise: 12900,
      insurancePaise: bluedartInsurance,
      minTransitDays: 2,
      maxTransitDays: 2,
    }),
  ]),
]

const ROUTES = [{ carrier: 'delhivery' }, { carrier: 'bluedart' }, { carrier: 'amazon' }]
const ruleFor = (id: string, collection: string, price: Record<string, unknown>, at = 0) =>
  rule(
    id,
    { name: id, target: { kind: 'collections', values: [collection] }, routes: ROUTES, price },
    at,
  )
/** Arm sleeves go first by Delhivery Air. */
const sleeves = (price: Record<string, unknown>) =>
  rule(
    'sleeves',
    {
      name: 'Arm sleeves',
      target: { kind: 'collections', values: ['c-sleeves'] },
      routes: ROUTES,
      defaultRoute: { carrier: 'delhivery', speed: 'express' },
      price,
    },
    0,
  )
const switches = (price: Record<string, unknown>) => ruleFor('switches', 'c-switches', price, 1)
const SLEEVE = item('sleeve', ['c-sleeves'])
const SWITCH = item('switch', ['c-switches'])
const SWITCH_2 = item('switch-2', ['c-switches'])
const PAD = item('pad', ['c-pads'])

const listOption = (over: Record<string, unknown> = {}) =>
  option('std', {
    name: 'Delivery',
    price: { source: 'route', rounding: 'nine' },
    couriers: { show: 'list', hideSlowerDearer: false },
    ...over,
  })

const run = (
  rules: ReturnType<typeof rule>[],
  items = [SLEEVE],
  {
    valuePaise = 150_000,
    opt = listOption(),
    bluedartInsurance = null,
  }: {
    valuePaise?: number
    opt?: ReturnType<typeof option>
    bluedartInsurance?: number | null
  } = {},
) =>
  resolveDeliveryOptions(
    input({
      config: config({ options: [opt], rules }),
      cart: { valuePaise, weightGrams: 400, items },
      answers: answers(bluedartInsurance),
    }),
  )

const cards = (r: ReturnType<typeof run>) => find(r, 'std')?.choices ?? []
const card = (r: ReturnType<typeof run>, key: string) => cards(r).find((c) => c.route.key === key)
const priceOf = (r: ReturnType<typeof run>, key: string) => card(r, key)?.pricePaise

describe('a fixed price per courier', () => {
  it('the schema: old rules parse unchanged, the new fields are kept', () => {
    const old = RouteRuleInputSchema.parse({
      name: 'Old',
      target: { kind: 'all', values: [] },
      routes: [{ carrier: 'delhivery' }],
      price: { mode: 'fixed', fixedPaise: 9900 },
    })
    expect(old.price).toEqual({ mode: 'fixed', fixedPaise: 9900 })
    const now = RouteRuleInputSchema.parse({
      ...old,
      price: { ...old.price, courierPaise: { bluedart: 13900 }, packingPaise: 2000 },
    })
    expect(now.price).toMatchObject({ courierPaise: { bluedart: 13900 }, packingPaise: 2000 })
  })

  it('Delhivery ₹99, Blue Dart ₹139: a named courier costs its own price, no difference added', () => {
    const r = run([sleeves({ mode: 'fixed', fixedPaise: 9900, courierPaise: { bluedart: 13900 } })])
    expect(priceOf(r, 'delhivery:E')).toBe(9900)
    // Amazon is not named: the fixed price (it costs the store less than the pick).
    expect(priceOf(r, 'rapidshyp:50')).toBe(9900)
    // Without the name it would be ₹99 + ₹49 difference.
    expect(priceOf(r, 'rapidshyp:70')).toBe(13900)
    expect(card(r, 'rapidshyp:70')?.listPricePaise).toBe(13900)
  })

  it('the first courier named: it costs its price; a courier not named keeps Fixed plus difference', () => {
    const r = run([sleeves({ mode: 'fixed', fixedPaise: 9900, courierPaise: { delhivery: 7900 } })])
    expect(priceOf(r, 'delhivery:E')).toBe(7900)
    expect(priceOf(r, 'rapidshyp:50')).toBe(9900)
    expect(priceOf(r, 'rapidshyp:70')).toBe(9900 + 4900)
  })

  it('the shopper’s insurance tick is added to a named courier’s price', () => {
    const opt = listOption({ insurance: { default: 'on' } })
    const r = run(
      [sleeves({ mode: 'fixed', fixedPaise: 9900, courierPaise: { bluedart: 13900 } })],
      [SLEEVE],
      {
        opt,
        bluedartInsurance: 1200,
      },
    )
    const bd = card(r, 'rapidshyp:70')
    expect(bd?.insurancePaise ?? 0).toBeGreaterThan(0)
    expect(bd?.pricePaise).toBe(13900 + roundPrice(bd?.insurancePaise ?? 0, 'nine'))
  })

  it('free above ₹X reached: the named courier pays only its difference, like any free rule', () => {
    const r = run([
      sleeves({
        mode: 'fixed',
        fixedPaise: 9900,
        freeAbovePaise: 100_000,
        courierPaise: { bluedart: 13900 },
      }),
    ])
    expect(priceOf(r, 'delhivery:E')).toBe(0)
    // Free above reached: Blue Dart is the difference only, as on any free rule.
    expect(priceOf(r, 'rapidshyp:70')).toBe(4900)
  })

  it('the order charges what the named courier’s card showed', () => {
    const r = run([sleeves({ mode: 'fixed', fixedPaise: 9900, courierPaise: { bluedart: 13900 } })])
    const choice = { optionId: 'std', routeKey: 'rapidshyp:70', insured: false }
    const out = orderDeliveryFor(r, choice, 'prepaid', shownPrices(r), config())
    expect(out.ok && out.shipping.pricePaise).toBe(13900)
  })
})

describe('a packing charge', () => {
  it('on the option’s price: added after rounding (₹49 + ₹20 = ₹69)', () => {
    const r = run([switches({ mode: 'option', packingPaise: 2000 })], [SWITCH])
    // Delhivery Surface ₹45 rounds up to ₹49, then packing.
    expect(find(r, 'std')?.pricePaise).toBe(6900)
    expect(cards(r)[0]?.listPricePaise).toBe(6900)
  })

  it('not re-rounded: ₹89 + ₹15 packing is ₹104', () => {
    const r = run([sleeves({ mode: 'option', packingPaise: 1500 })])
    expect(priceOf(r, 'delhivery:E')).toBe(10400)
    // Other couriers: that price plus their difference.
    expect(priceOf(r, 'rapidshyp:70')).toBe(10400 + 4900)
  })

  it('on Fixed: the fixed price plus packing, and plus the insurance ticked', () => {
    expect(
      priceOf(
        run([sleeves({ mode: 'fixed', fixedPaise: 9900, packingPaise: 2000 })]),
        'delhivery:E',
      ),
    ).toBe(11900)
    const opt = listOption({ insurance: { default: 'on' } })
    const r = run([sleeves({ mode: 'fixed', fixedPaise: 9900, packingPaise: 2000 })], [SLEEVE], {
      opt,
    })
    const first = cards(r)[0]
    const insurance = roundPrice(first?.insurancePaise ?? 0, 'nine')
    expect(first?.pricePaise).toBe(9900 + 2000 + insurance)
  })

  it('a named courier’s price plus packing', () => {
    const r = run([
      sleeves({
        mode: 'fixed',
        fixedPaise: 9900,
        packingPaise: 1000,
        courierPaise: { bluedart: 13900 },
      }),
    ])
    expect(priceOf(r, 'delhivery:E')).toBe(10900)
    expect(priceOf(r, 'rapidshyp:70')).toBe(14900)
  })

  it('never on Free, nor once free above ₹X is reached', () => {
    expect(priceOf(run([sleeves({ mode: 'free', packingPaise: 2000 })]), 'delhivery:E')).toBe(0)
    const above = sleeves({ mode: 'option', freeAbovePaise: 100_000, packingPaise: 2000 })
    expect(priceOf(run([above]), 'delhivery:E')).toBe(0)
    expect(priceOf(run([above], [SLEEVE], { valuePaise: 50_000 }), 'delhivery:E')).toBe(10900)
  })

  it('mixed cart: each rule’s packing once, the highest delivery price', () => {
    const rules = [
      sleeves({ mode: 'fixed', fixedPaise: 9900, packingPaise: 1000 }),
      switches({ mode: 'option', packingPaise: 2000 }),
    ]
    expect(find(run(rules, [SLEEVE, SWITCH]), 'std')?.pricePaise).toBe(9900 + 1000 + 2000)
    // Two switches, one rule: packing once.
    expect(find(run(rules, [SWITCH, SWITCH_2]), 'std')?.pricePaise).toBe(4900 + 2000)
    // A product no rule matches adds nothing.
    expect(find(run(rules, [SWITCH, PAD]), 'std')?.pricePaise).toBe(4900 + 2000)
  })

  it('a free product does not cancel another product’s packing', () => {
    const rules = [sleeves({ mode: 'free' }), switches({ mode: 'option', packingPaise: 2000 })]
    // Delhivery Air goes first (the sleeve's rule), at the switches' price plus their packing.
    expect(find(run(rules, [SLEEVE, SWITCH]), 'std')?.pricePaise).toBe(8900 + 2000)
  })

  it('COD adds its charge on top; the order charges the card; the courier cost stays the courier’s', () => {
    const r = run([sleeves({ mode: 'option', packingPaise: 2000 })])
    const first = cards(r)[0]
    expect(first?.pricePaise).toBe(10900)
    expect(first?.codPricePaise).toBe(10900 + 3000)
    const choice = { optionId: 'std', routeKey: 'delhivery:E', insured: false }
    const out = orderDeliveryFor(r, choice, 'cod', shownPrices(r), config())
    expect(out.ok && out.shipping.pricePaise).toBe(13900)
    // Packing is revenue: the saved courier cost (the margin's cost side) is what it was.
    const plain = run([sleeves({ mode: 'option' })])
    const same = orderDeliveryFor(plain, choice, 'cod', shownPrices(plain), config())
    expect(out.ok && out.delivery?.courierCostPaise).toBe(
      same.ok && same.delivery?.courierCostPaise,
    )
  })
})
