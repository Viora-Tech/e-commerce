/** SOURCE OF TRUTH: a product rule's price and the COD fee setting, owner 20 Nov 2026 — WHAT:
 * Free, Fixed ₹ and free above ₹X on the first courier, other couriers at that price plus the
 * difference, the highest price in a mixed cart, a preferred courier that cannot reach the PIN,
 * Express keeping its own price, and the courier's COD charge included or on its own line /
 * WHY: "Mice ship free by Delhivery Air", skates pay ₹99, COD still charges on a free order. */
import { describe, expect, it } from 'vitest'
import {
  answer,
  config,
  EXPRESS,
  find,
  input,
  item,
  option,
  quote,
  rule,
  STANDARD,
  svc,
} from '../../testing/delivery-options-fixtures'
import { orderDeliveryFor, shownPrices } from './checkout'
import { RouteRuleInputSchema } from './config'
import { resolveDeliveryOptions } from './resolve'

/** A mouse to 131001; Delhivery Air takes COD for ₹30 more. */
const answers = (withAir = true) => [
  answer('delhivery', 'Delhivery', [
    quote('S', 'Surface', 5000, [4, 5]),
    ...(withAir
      ? [
          svc({
            serviceId: 'E',
            serviceLabel: 'Express',
            pricePaise: 8900,
            codPricePaise: 11900,
            minTransitDays: 2,
            maxTransitDays: 3,
          }),
        ]
      : []),
  ]),
  answer('rapidshyp', 'RapidShyp', [
    quote('50', 'Amazon Shipping Surface', 5900, [4, 5], 'Amazon Shipping'),
    quote('70', 'Bluedart Air', 12900, [2, 2], 'Bluedart Air'),
  ]),
]

const mice = (price: Record<string, unknown>, over: Record<string, unknown> = {}) =>
  rule(
    'mice',
    {
      name: 'Mice',
      target: { kind: 'collections', values: ['c-mice'] },
      routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart' }, { carrier: 'amazon' }],
      defaultRoute: { carrier: 'delhivery', speed: 'express' },
      price,
      ...over,
    },
    0,
  )
const skates = rule(
  'skates',
  {
    name: 'Skates',
    target: { kind: 'collections', values: ['c-skates'] },
    routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart' }, { carrier: 'amazon' }],
    price: { mode: 'fixed', fixedPaise: 9900 },
  },
  1,
)
const MOUSE = item('mouse', ['c-mice'])
const SKATE = item('skate', ['c-skates'])
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
  {
    items = [MOUSE],
    valuePaise = 150_000,
    opt = listOption(),
    withAir = true,
  }: {
    items?: ReturnType<typeof item>[]
    valuePaise?: number
    opt?: ReturnType<typeof option>
    withAir?: boolean
  } = {},
) =>
  resolveDeliveryOptions(
    input({
      config: config({ options: [opt], rules }),
      cart: { valuePaise, weightGrams: 400, items },
      answers: answers(withAir),
    }),
  )

const cards = (r: ReturnType<typeof run>) => find(r, 'std')?.choices ?? []
const priceOf = (r: ReturnType<typeof run>, key: string) =>
  cards(r).find((c) => c.route.key === key)?.pricePaise

describe('a rule’s price', () => {
  it('a rule saved before rule prices reads as the option’s price', () => {
    const parsed = RouteRuleInputSchema.parse({
      name: 'Old',
      target: { kind: 'all', values: [] },
      routes: [{ carrier: 'delhivery' }],
    })
    expect(parsed.price).toEqual({ mode: 'option' })
    expect(priceOf(run([mice({})]), 'delhivery:E')).toBe(8900)
  })

  it('Free: the preferred courier is ₹0, a cheaper one too, a dearer one adds the difference', () => {
    const r = run([mice({ mode: 'free' })])
    expect(cards(r)[0]?.route.key).toBe('delhivery:E')
    expect(priceOf(r, 'delhivery:E')).toBe(0)
    // Struck through: what it would have cost.
    expect(cards(r)[0]?.listPricePaise).toBe(8900)
    expect(priceOf(r, 'rapidshyp:50')).toBe(0)
    // Blue Dart Air costs ₹40 more than Delhivery Air: +₹49 on the …9 rounding.
    expect(priceOf(r, 'rapidshyp:70')).toBe(4900)
  })

  it('Fixed ₹99: the first courier costs ₹99, a dearer one ₹99 plus the difference', () => {
    const r = run([mice({ mode: 'fixed', fixedPaise: 9900 })])
    expect(priceOf(r, 'delhivery:E')).toBe(9900)
    expect(priceOf(r, 'rapidshyp:50')).toBe(9900)
    expect(priceOf(r, 'rapidshyp:70')).toBe(9900 + 4900)
  })

  it('free above ₹1,000: free from that order value, the normal price below it', () => {
    const rules = [mice({ mode: 'option', freeAbovePaise: 100_000 })]
    expect(priceOf(run(rules, { valuePaise: 100_000 }), 'delhivery:E')).toBe(0)
    expect(priceOf(run(rules, { valuePaise: 99_900 }), 'delhivery:E')).toBe(8900)
  })

  it('a fixed price with free above: ₹0 from the threshold, the fixed price below', () => {
    const rules = [mice({ mode: 'fixed', fixedPaise: 4900, freeAbovePaise: 100_000 })]
    expect(priceOf(run(rules, { valuePaise: 150_000 }), 'delhivery:E')).toBe(0)
    expect(priceOf(run(rules, { valuePaise: 50_000 }), 'delhivery:E')).toBe(4900)
  })

  it('mixed cart: a free mouse with ₹99 skates pays ₹99', () => {
    const r = run([mice({ mode: 'free' }), skates], { items: [MOUSE, SKATE] })
    expect(find(r, 'std')?.pricePaise).toBe(9900)
  })

  it('mixed cart: a free mouse with a product no rule prices pays the normal price', () => {
    const r = run([mice({ mode: 'free' })], { items: [MOUSE, PAD] })
    // Delhivery Air still goes first (the mouse's rule), at its normal price.
    expect(find(r, 'std')?.pricePaise).toBe(8900)
  })

  it('a preferred courier that cannot reach the PIN is skipped; the next keeps the rule price', () => {
    const r = run([mice({ mode: 'free' })], { withAir: false })
    const first = cards(r)[0]
    expect(first?.route.key).not.toBe('delhivery:E')
    expect(first?.pricePaise).toBe(0)
  })

  it('only this one (forced), unreachable: the next allowed courier goes first, still free', () => {
    const r = run([mice({ mode: 'free' }, { forceRoute: true })], { withAir: false })
    expect(find(r, 'std')?.pricePaise).toBe(0)
  })

  it('Express keeps its own price; the rule prices the Standard option', () => {
    const r = resolveDeliveryOptions(
      input({
        config: config({ options: [STANDARD, EXPRESS], rules: [mice({ mode: 'free' })] }),
        cart: { valuePaise: 150_000, weightGrams: 400, items: [MOUSE] },
        answers: answers(),
      }),
    )
    expect(find(r, 'std')?.pricePaise).toBe(0)
    expect(find(r, 'exp')?.pricePaise).toBeGreaterThan(0)
  })
})

describe('the cash on delivery fee', () => {
  const choice = { optionId: 'std', routeKey: 'delhivery:E', insured: false }

  it('included (the default): a free rule’s card costs the COD charge on COD', () => {
    const r = run([mice({ mode: 'free' })])
    const first = cards(r)[0]
    expect(first?.codPricePaise).toBe(3000)
    expect(first?.codFeePaise ?? null).toBeNull()
    const out = orderDeliveryFor(r, choice, 'cod', shownPrices(r), config())
    expect(out.ok && out.shipping.pricePaise).toBe(3000)
    expect(out.ok && out.shipping.codSurchargePaise).toBeNull()
  })

  it('separate: the delivery price stays free and the charge is its own fee', () => {
    const opt = listOption({ cod: { mode: 'allowed', fee: 'separate' } })
    const r = run([mice({ mode: 'free' })], { opt })
    const first = cards(r)[0]
    expect(first?.codPricePaise).toBe(0)
    expect(first?.codFeePaise).toBe(3000)
    const out = orderDeliveryFor(r, choice, 'cod', shownPrices(r), config({ options: [opt] }))
    expect(out.ok && out.shipping.pricePaise).toBe(0)
    expect(out.ok && out.shipping.codSurchargePaise).toBe(3000)
    // Prepaid pays no COD fee.
    const prepaid = orderDeliveryFor(r, choice, 'prepaid', shownPrices(r), config())
    expect(prepaid.ok && prepaid.shipping.codSurchargePaise).toBeNull()
  })

  it('one card (not a list): a free rule adds the COD charge, or keeps it separate', () => {
    const one = (fee: 'included' | 'separate') =>
      run([mice({ mode: 'free' }, { forceRoute: true })], {
        opt: option('std', { name: 'Standard', cod: { mode: 'allowed', fee } }),
      })
    const included = find(one('included'), 'std')
    expect(included?.pricePaise).toBe(0)
    expect(included?.cod?.pricePaise).toBe(3000)
    const separate = find(one('separate'), 'std')
    expect(separate?.cod?.pricePaise).toBe(0)
    expect(separate?.cod?.codFeePaise).toBe(3000)
  })

  it('separate, with no rule price: the COD pick is priced prepaid and carries the fee', () => {
    const opt = option('std', {
      name: 'Standard',
      price: { source: 'route', rounding: 'ten' },
      cod: { mode: 'allowed', fee: 'separate' },
    })
    const r = run([], { opt, items: [PAD] })
    const o = find(r, 'std')
    // Delhivery Surface ₹50 is cheapest; COD on it costs nothing more here, so no fee.
    expect(o?.cod?.pricePaise).toBe(o?.pricePaise)
  })
})
