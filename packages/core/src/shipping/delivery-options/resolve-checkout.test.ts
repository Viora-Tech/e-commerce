/** SOURCE OF TRUTH: delivery options engine tests, 20 Nov 2026 round — WHAT: a rule forcing its
 * route at the option's price, the Free price source, the insurance tick both ways, every
 * courier in a list (a different courier before another speed), Express hidden when not faster,
 * and card titles / WHY: #1781 and #1782; `resolve.test.ts` holds the earlier rules and is over
 * the file cap, so these live here. */
import { describe, expect, it } from 'vitest'
import {
  answer,
  config,
  delhivery,
  EXPRESS,
  find,
  input,
  item,
  option,
  quote,
  rule,
  STANDARD,
  traceOf,
} from '../../testing/delivery-options-fixtures'
import { orderDeliveryFor } from './checkout'
import { routeCardLabel, speedWord } from './labels'
import { shippingMargin } from './margin'
import { resolveParcelDeliveries } from './parcels'
import { resolveDeliveryOptions } from './resolve'

/** Mice go by Blue Dart Air, whatever option the shopper picks. */
const MOUSE_AIR = rule(
  'mouse-air',
  {
    name: 'Mice by Air',
    target: { kind: 'products', values: ['mouse'] },
    routes: [{ carrier: 'bluedart' }, { carrier: 'delhivery' }],
    defaultRoute: { carrier: 'bluedart', speed: 'express' },
    forceRoute: true,
  },
  0,
)
const mouseCart = { valuePaise: 150_000, weightGrams: 400, items: [item('mouse')] }

describe('forceRoute (#1782)', () => {
  it('ships Standard by Air at the Standard price; the store covers the difference', () => {
    const r = resolveDeliveryOptions(
      input({ config: config({ rules: [MOUSE_AIR] }), cart: mouseCart }),
    )
    const std = find(r, 'std')
    expect(std?.pick?.route.key).toBe('shiprocket:20')
    // Standard's own pick is Delhivery Surface at ₹60: the shopper pays that.
    expect(std?.pricePaise).toBe(6000)
    expect(std?.pick?.courierCostPaise).toBe(12_800)
    expect(std?.why).toMatchObject({ kind: 'rule_default', ruleId: 'mouse-air', forced: true })
    expect(std?.choices).toEqual([])
    // A Standard card over an Air route is named by the route, never "Standard · Blue Dart".
    expect(std?.title).toBe('Blue Dart Air')
  })

  it('Express rides the same Air route, so it is not faster and hides', () => {
    const r = resolveDeliveryOptions(
      input({ config: config({ rules: [MOUSE_AIR] }), cart: mouseCart }),
    )
    expect(find(r, 'exp')).toBeUndefined()
    expect(traceOf(r, 'exp')?.hidden).toBe('not_faster')
  })

  it('the shipping margin shows what the store covers', () => {
    const r = resolveDeliveryOptions(
      input({ config: config({ rules: [MOUSE_AIR] }), cart: mouseCart }),
    )
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: false },
      'prepaid',
      null,
      config({ rules: [MOUSE_AIR] }),
    )
    if (!out.ok) throw new Error('expected an order')
    expect(out.delivery.route?.key).toBe('shiprocket:20')
    const m = shippingMargin(out.delivery, out.shipping.pricePaise, null)
    expect(m.marginPaise).toBe(6000 - 12_800)
  })

  it('a forced route that does not serve the PIN leaves the option as usual', () => {
    const noAir = answer('shiprocket', 'Shiprocket', [
      quote('10', 'Delhivery Surface', 8000, [4, 5], 'Delhivery Surface'),
    ])
    const r = resolveDeliveryOptions(
      input({
        config: config({ rules: [MOUSE_AIR] }),
        cart: mouseCart,
        answers: [delhivery(), noAir],
      }),
    )
    expect(find(r, 'std')?.pick?.route.key).toBe('delhivery:S')
    expect(find(r, 'std')?.why).toMatchObject({ kind: 'cheapest' })
  })

  it('an every-product rule does not cut a product rule down (most specific wins)', () => {
    const everyDtdc = rule(
      'every',
      { name: 'All by DTDC', target: { kind: 'all', values: [] }, routes: [{ carrier: 'dtdc' }] },
      1,
    )
    const r = resolveDeliveryOptions(
      input({ config: config({ rules: [everyDtdc, MOUSE_AIR] }), cart: mouseCart }),
    )
    expect(find(r, 'std')?.pick?.route.key).toBe('shiprocket:20')
    expect(traceOf(r, 'std')?.rulesOverruled.map((x) => x.id)).toEqual(['every'])
    // A cable in the cart has only the every-product rule: DTDC.
    const cable = resolveDeliveryOptions(
      input({ config: config({ rules: [everyDtdc, MOUSE_AIR] }) }),
    )
    expect(find(cable, 'std')?.pick?.route.key).toBe('shiprocket:30')
  })
})

describe('price source free', () => {
  const FREE = option('std', { name: 'Standard', price: { source: 'free' } })

  it('the card is free and the order charges ₹0 against the courier cost', () => {
    const r = resolveDeliveryOptions(input({ config: config({ options: [FREE] }) }))
    const std = find(r, 'std')
    expect(std?.pricePaise).toBe(0)
    expect(std?.listPricePaise).toBe(0)
    expect(std?.pick?.courierCostPaise).toBe(6000)
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: false },
      'prepaid',
      null,
      config({ options: [FREE] }),
    )
    if (!out.ok) throw new Error('expected an order')
    expect(out.shipping.pricePaise).toBe(0)
    expect(shippingMargin(out.delivery, 0, null).marginPaise).toBe(-6000)
  })

  it('in a courier list the other couriers show the difference on top of ₹0', () => {
    const list = option('std', {
      name: 'Delivery',
      price: { source: 'free' },
      couriers: { show: 'list' },
    })
    const r = resolveDeliveryOptions(input({ config: config({ options: [list] }) }))
    const o = find(r, 'std')
    expect(o?.choices[0]?.pricePaise).toBe(0)
    // Delhivery Express costs ₹42 more → +₹49.
    expect(o?.choices.find((c) => c.route.key === 'delhivery:E')?.pricePaise).toBe(4900)
  })

  it('insurance the shopper ticks is still charged', () => {
    const r = resolveDeliveryOptions(input({ config: config({ options: [FREE] }), insure: true }))
    // Delhivery Protect ₹10.62, rounded up to ₹20.
    expect(find(r, 'std')?.pricePaise).toBe(2000)
  })
})

describe('insurance tick', () => {
  it('default off: offered unticked, with what ticking adds', () => {
    const r = resolveDeliveryOptions(input({ config: config({ options: [STANDARD] }) }))
    const std = find(r, 'std')
    expect(std?.insurance).toMatchObject({ offered: true, on: false, required: false })
    expect(std?.pricePaise).toBe(6000)
    // Insured, Delhivery Surface is ₹60 + ₹10.62 → ₹80: +₹20.
    expect(std?.insurance.extraPaise).toBe(2000)
    expect(std?.insurance.pricePaise).toBe(1062)
  })

  it('the shopper ticks it: the price includes it and the order records it', () => {
    const r = resolveDeliveryOptions(
      input({ config: config({ options: [STANDARD] }), insure: true }),
    )
    const std = find(r, 'std')
    expect(std?.insurance.on).toBe(true)
    expect(std?.pricePaise).toBe(8000)
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: true },
      'prepaid',
      null,
      config({ options: [STANDARD] }),
    )
    if (!out.ok) throw new Error('expected an order')
    expect(out.delivery.insured).toBe(true)
    expect(out.delivery.insurancePaise).toBe(1062)
  })

  it('default on starts ticked; unticking takes it off', () => {
    const on = option('std', { name: 'Standard', insurance: { default: 'on' } })
    const r = resolveDeliveryOptions(input({ config: config({ options: [on] }) }))
    expect(find(r, 'std')?.insurance).toMatchObject({ offered: true, on: true })
    const off = resolveDeliveryOptions(
      input({ config: config({ options: [on] }), insure: false }),
    )
    expect(find(off, 'std')?.insurance.on).toBe(false)
    expect(find(off, 'std')?.pricePaise).toBe(6000)
  })

  it('no route insures: no tick', () => {
    const bluedart = answer('bluedart', 'Blue Dart', [
      quote('A', 'Ground', 3000, [3, 4]),
    ])
    const r = resolveDeliveryOptions(
      input({ config: config({ options: [STANDARD] }), answers: [bluedart] }),
    )
    expect(find(r, 'std')?.insurance.offered).toBe(false)
  })

  it('below the order value it starts from: no tick', () => {
    const above = option('std', { name: 'Standard', insurance: { onlyAbovePaise: 500_000 } })
    const r = resolveDeliveryOptions(input({ config: config({ options: [above] }), insure: true }))
    expect(find(r, 'std')?.insurance).toMatchObject({ offered: false, on: false })
  })
})

describe('courier list shows every courier', () => {
  it('max null (the default) shows every courier that fits', () => {
    const list = option('std', {
      name: 'Delivery',
      couriers: { show: 'list', hideSlowerDearer: false },
    })
    expect(list.couriers.max).toBeNull()
    const r = resolveDeliveryOptions(input({ config: config({ options: [list] }) }))
    // Delhivery Surface, Delhivery Express, DTDC Surface, Blue Dart Air (Delhivery via
    // Shiprocket is the same courier and speed as the direct one).
    expect(find(r, 'std')?.choices).toHaveLength(4)
    const two = option('std', {
      name: 'Delivery',
      couriers: { show: 'list', hideSlowerDearer: false, max: 2 },
    })
    const capped = resolveDeliveryOptions(input({ config: config({ options: [two] }) }))
    expect(find(capped, 'std')?.choices).toHaveLength(2)
  })

  it('filling the three-card floor brings back another courier before another speed', () => {
    const answers = [
      answer('delhivery', 'Delhivery', [
        quote('S', 'Surface', 6000, [4, 5]),
        // Same date, ₹5 dearer: +₹9, beaten by Surface.
        quote('E', 'Express', 6500, [4, 5]),
      ]),
      answer('shiprocket', 'Shiprocket', [
        quote('40', 'Bluedart Surface', 9000, [4, 5], 'Bluedart Surface'),
        quote('50', 'Amazon Shipping Surface', 9500, [4, 5], 'Amazon Shipping'),
      ]),
    ]
    const list = option('std', { name: 'Delivery', couriers: { show: 'list' } })
    const r = resolveDeliveryOptions(input({ config: config({ options: [list] }), answers }))
    expect(find(r, 'std')?.choices.map((c) => c.route.key)).toEqual([
      'delhivery:S',
      'shiprocket:40',
      'shiprocket:50',
    ])
  })

  it('a list option is titled by its pick: courier and speed', () => {
    const list = option('std', { name: 'Delivery', couriers: { show: 'list' } })
    const r = resolveDeliveryOptions(input({ config: config({ options: [list] }) }))
    expect(find(r, 'std')?.title).toBe('Delhivery Surface')
  })
})

describe('Express hidden when not faster (fixed options)', () => {
  it('Express arriving the same day as Standard hides, with not_faster in the trace', () => {
    const same = answer('delhivery', 'Delhivery', [
      quote('S', 'Surface', 6000, [2, 3]),
      quote('E', 'Express', 9000, [2, 3]),
    ])
    const r = resolveDeliveryOptions(input({ answers: [same] }))
    expect(r.options.map((o) => o.optionId)).toEqual(['std'])
    expect(traceOf(r, 'exp')?.hidden).toBe('not_faster')
  })

  it('a split cart compares the added-up cards, not each parcel', () => {
    // Parcel 2 alone has Express no faster than Surface; added up, Express still arrives first.
    const slow = answer('delhivery', 'Delhivery', [
      quote('S', 'Surface', 6000, [4, 5]),
      quote('E', 'Express', 9000, [2, 3]),
    ])
    const even = answer('delhivery', 'Delhivery', [
      quote('S', 'Surface', 6000, [2, 3]),
      quote('E', 'Express', 9000, [2, 3]),
    ])
    const { config: cfg, zone, policy, now } = input()
    const cart = { valuePaise: 75_000, weightGrams: 400, items: [item('p1')] }
    const r = resolveParcelDeliveries(
      { config: cfg, zone, policy, now },
      [
        { cart, answers: [slow] },
        { cart, answers: [even] },
      ],
      150_000,
    )
    expect(r.options.map((o) => o.optionId)).toEqual(['std', 'exp'])
    const both = resolveParcelDeliveries(
      { config: cfg, zone, policy, now },
      [
        { cart, answers: [even] },
        { cart, answers: [even] },
      ],
      150_000,
    )
    expect(both.options.map((o) => o.optionId)).toEqual(['std'])
    expect(traceOf(both, 'exp')?.hidden).toBe('not_faster')
  })

  it('a faster Express stays', () => {
    const r = resolveDeliveryOptions(input({ config: config({ options: [STANDARD, EXPRESS] }) }))
    expect(r.options.map((o) => o.optionId)).toEqual(['std', 'exp'])
  })
})

describe('card labels', () => {
  it('names a route by courier and speed', () => {
    const base = { carrier: 'Delhivery', showCarrier: true, serviceLabel: 'Surface' }
    expect(routeCardLabel({ ...base, speed: 'standard' })).toBe('Delhivery Surface')
    expect(routeCardLabel({ ...base, serviceLabel: 'Express', speed: 'express' })).toBe(
      'Delhivery Express',
    )
    expect(
      routeCardLabel({
        carrier: 'Blue Dart',
        showCarrier: true,
        serviceLabel: 'Bluedart Air',
        speed: 'express',
      }),
    ).toBe('Blue Dart Air')
    expect(routeCardLabel({ ...base, showCarrier: false, speed: 'standard' })).toBe('Surface')
    expect(speedWord({ serviceLabel: 'Apex', speed: 'express' })).toBe('Air')
  })
})
