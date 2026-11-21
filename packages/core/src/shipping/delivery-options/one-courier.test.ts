/** SOURCE OF TRUTH: tests for a courier list limited to one courier, owner 21 Nov 2026 — WHAT:
 * `couriers.max: 1` (the Options page's "Can shoppers pick a faster courier? No") shows only the
 * included courier, at its own price, in the list layout too, and the order charges what the
 * card showed / WHY: the 3-question Options page needs a "No" that the engine already honours. */
import { describe, expect, it } from 'vitest'
import { answer, config, find, input, option, quote } from '../../testing/delivery-options-fixtures'
import { orderDeliveryFor, shownPrices } from './checkout'
import { OptionCouriersSchema } from './config'
import { resolveDeliveryOptions } from './resolve'

/** Delhivery Surface ₹50 and Air ₹89, Amazon Surface ₹59 (store's cost). */
const answers = () => [
  answer('delhivery', 'Delhivery', [
    quote('S', 'Surface', 5000, [4, 5]),
    quote('E', 'Express', 8900, [2, 3]),
  ]),
  answer('rapidshyp', 'RapidShyp', [
    quote('50', 'Amazon Shipping Surface', 5900, [4, 5], 'Amazon Shipping'),
  ]),
]

const cfg = (max: number | null, layout?: 'list') =>
  config({
    ...(layout ? { layout } : {}),
    options: [
      option('std', {
        name: 'Delivery',
        price: { source: 'route', rounding: 'nine' },
        couriers: { show: layout ? 'one' : 'list', hideSlowerDearer: false, max },
      }),
    ],
  })

const run = (max: number | null, layout?: 'list') =>
  resolveDeliveryOptions(
    input({
      config: cfg(max, layout),
      cart: { valuePaise: 150_000, weightGrams: 400, items: [] },
      answers: answers(),
    }),
  )

describe('a courier list limited to one courier', () => {
  it('saves 1 (it was 2 at least before)', () => {
    expect(OptionCouriersSchema.parse({ max: 1 }).max).toBe(1)
    expect(() => OptionCouriersSchema.parse({ max: 0 })).toThrow()
  })

  it('shows only the included courier at its own price', () => {
    const all = find(run(null), 'std')
    expect(all?.choices.length).toBe(3)
    const one = find(run(1), 'std')
    expect(one?.choices.map((c) => c.route.key)).toEqual(['delhivery:S'])
    expect(one?.pricePaise).toBe(5900)
  })

  it('does the same in the automatic courier list layout', () => {
    const one = find(run(1, 'list'), 'std')
    expect(one?.choices.map((c) => c.route.key)).toEqual(['delhivery:S'])
  })

  it('charges what the card showed', () => {
    const r = run(1)
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: 'delhivery:S', insured: false },
      'prepaid',
      shownPrices(r),
      cfg(1),
    )
    expect(out.ok && out.shipping.pricePaise).toBe(5900)
  })
})
