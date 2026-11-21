/** SOURCE OF TRUTH: one courier's slower speed at no lower price stays off the list — WHAT:
 * Blue Dart Air at the same ₹139 as Blue Dart Surface but arriving later is not a card, while a
 * faster speed that costs more still is / WHY: owner, 21 Nov 2026, arm sleeves: "why are you
 * showing Blue Dart Surface and Blue Dart Air" when Air was dearer-or-equal and later. */
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

const SLEEVE = item('sleeve', ['c-sleeves'])

const run = (airDays: [number, number]) =>
  resolveDeliveryOptions(
    input({
      config: config({
        options: [
          option('std', {
            name: 'Delivery',
            price: { source: 'route', rounding: 'nine' },
            couriers: { show: 'list', hideSlowerDearer: false },
          }),
        ],
        rules: [
          rule(
            'sleeves',
            {
              name: 'Arm sleeves',
              target: { kind: 'collections', values: ['c-sleeves'] },
              routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart' }],
              defaultRoute: { carrier: 'delhivery', speed: 'standard' },
              price: { mode: 'fixed', fixedPaise: 9900, courierPaise: { bluedart: 13900 } },
            },
            0,
          ),
        ],
      }),
      cart: { valuePaise: 169_900, weightGrams: 300, items: [SLEEVE] },
      answers: [
        answer('delhivery', 'Delhivery', [quote('S', 'Surface', 4500, [3, 4])]),
        answer('rapidshyp', 'RapidShyp', [
          quote('71', 'Bluedart Surface', 7400, [2, 2], 'Bluedart Surface'),
          quote('72', 'Bluedart Air', 12900, airDays, 'Bluedart Air'),
        ]),
      ],
    }),
  )

const keys = (r: ReturnType<typeof run>) =>
  (find(r, 'std')?.choices ?? []).map((c) => `${c.route.carrierKey}:${c.route.speed}`)

describe('one courier, two speeds', () => {
  it('drops the speed that costs the same and arrives later', () => {
    // Both Blue Dart speeds cost the rule's ₹139; Air arrives after Surface.
    expect(keys(run([5, 5]))).toEqual(['delhivery:standard', 'bluedart:standard'])
  })

  it('keeps a dearer speed even when its date is later', () => {
    // Option price: Blue Dart Air pays its own ₹122 against Surface's ₹74 (no rule prices).
    const r = resolveDeliveryOptions(
      input({
        config: config({
          options: [
            option('std', {
              name: 'Delivery',
              price: { source: 'route', rounding: 'nine' },
              couriers: { show: 'list', hideSlowerDearer: false },
            }),
          ],
        }),
        cart: { valuePaise: 249_900, weightGrams: 500, items: [SLEEVE] },
        answers: [
          answer('rapidshyp', 'RapidShyp', [
            quote('71', 'Bluedart Surface', 7400, [6, 6], 'Bluedart Surface'),
            quote('72', 'Bluedart Air', 12200, [9, 9], 'Bluedart Air'),
          ]),
        ],
      }),
    )
    expect(keys(r)).toContain('bluedart:express')
  })

  it('keeps a faster speed', () => {
    // Same ₹139, but Air arrives the next day: a real choice.
    expect(keys(run([1, 1]))).toContain('bluedart:express')
  })
})
