/** SOURCE OF TRUTH: carts split by product rules, owner 21 Nov 2026 — WHAT: a courier every
 * product's rules allow keeps one parcel; none in common splits into one parcel per rule group
 * (unmatched items join the largest, overlapping groups merge), inside a warehouse split too;
 * each parcel's rule price is its own (a free glass pad parcel beside a paid mouse parcel); a
 * courier picked per parcel round-trips through `shownPrices` and `orderDeliveryFor` / WHY:
 * "split only when rules have nothing in common", one label per parcel. */
import type { ShippingProvider } from '@commerce/shipping'
import { describe, expect, it, vi } from 'vitest'
import {
  answer,
  config,
  delhivery,
  input,
  item,
  NOW,
  option,
  POLICY,
  quote,
  rule,
  shiprocket,
} from '../../testing/delivery-options-fixtures'
import { orderDeliveryFor, type QuoteParcel, quoteParcelDeliveries, shownPrices } from './checkout'
import type { DeliveryConfig } from './config'
import { resolveParcelDeliveries } from './parcels'
import { ruleGroups } from './rule-split'

const PAD = item('pad', ['c-pads'])
const MOUSE = item('mouse', ['c-mice'])
const MOUSE2 = item('mouse-2', ['c-mice'])
const SKATE = item('skate', ['c-skates'])
const CABLE = item('cable')

const pads = (price: Record<string, unknown> = { mode: 'option' }) =>
  rule(
    'pads',
    {
      name: 'Glass pads',
      target: { kind: 'collections', values: ['c-pads'] },
      routes: [{ carrier: 'delhivery' }],
      price,
    },
    0,
  )
const mice = (carriers = ['bluedart']) =>
  rule(
    'mice',
    {
      name: 'Mice',
      target: { kind: 'collections', values: ['c-mice'] },
      routes: carriers.map((carrier) => ({ carrier })),
    },
    1,
  )
const skates = rule(
  'skates',
  {
    name: 'Skates',
    target: { kind: 'collections', values: ['c-skates'] },
    routes: [{ carrier: 'delhivery' }, { carrier: 'bluedart' }],
  },
  2,
)

const LIST = option('std', {
  name: 'Delivery',
  price: { source: 'route', rounding: 'nine' },
  couriers: { show: 'list', hideSlowerDearer: false },
})
const listConfig = (rules = [pads(), mice()]): DeliveryConfig =>
  config({ layout: 'list', options: [LIST], rules })

const ANSWERS = [delhivery(), shiprocket()]

describe('ruleGroups', () => {
  it('keeps one parcel when a courier is allowed by every product’s rules', () => {
    expect(
      ruleGroups(listConfig([pads(), mice(['delhivery', 'bluedart'])]), [PAD, MOUSE], ANSWERS, 400),
    ).toBeNull()
    // No rule at all, or a single product: nothing to split.
    expect(ruleGroups(listConfig([]), [PAD, MOUSE], ANSWERS, 400)).toBeNull()
    expect(ruleGroups(listConfig(), [PAD], ANSWERS, 400)).toBeNull()
  })

  it('splits into one parcel per rule group when the rules have nothing in common', () => {
    expect(ruleGroups(listConfig(), [PAD, MOUSE], ANSWERS, 400)).toEqual([['pad'], ['mouse']])
  })

  it('puts items no rule matches into the largest group', () => {
    expect(ruleGroups(listConfig(), [PAD, MOUSE, CABLE, MOUSE2], ANSWERS, 400)).toEqual([
      ['mouse', 'mouse-2', 'cable'],
      ['pad'],
    ])
  })

  it('merges a group into one whose couriers it shares', () => {
    expect(
      ruleGroups(listConfig([pads(), mice(), skates]), [PAD, MOUSE, SKATE], ANSWERS, 400),
    ).toEqual([['pad', 'skate'], ['mouse']])
  })

  it('uses the first Standard option when cards are fixed', () => {
    expect(ruleGroups(config({ rules: [pads(), mice()] }), [PAD, MOUSE], ANSWERS, 400)).toEqual([
      ['pad'],
      ['mouse'],
    ])
  })
})

const base = (cfg: DeliveryConfig) => {
  const { cart: _c, answers: _a, ...rest } = input({ config: cfg })
  return rest
}
const cartOf = (valuePaise: number, items = [PAD]) => ({ valuePaise, weightGrams: 400, items })

describe('a cart split by product rules', () => {
  const split = (cfg: DeliveryConfig) =>
    resolveParcelDeliveries(
      base(cfg),
      [
        { cart: cartOf(50_000, [PAD]), answers: ANSWERS },
        { cart: cartOf(100_000, [MOUSE]), answers: ANSWERS },
      ],
      150_000,
    )

  it('prices each parcel with its own rule price: a free glass pad beside a paid mouse', () => {
    const result = split(listConfig([pads({ mode: 'free' }), mice()]))
    const card = result.options[0]
    const [pad, mouse] = card?.parcelOptions ?? []
    expect(pad?.pricePaise).toBe(0)
    expect(pad?.choices.every((c) => c.route.carrier === 'Delhivery')).toBe(true)
    expect(mouse?.pick?.route.carrier).toBe('Blue Dart')
    expect(mouse?.pricePaise).toBeGreaterThan(0)
    expect(card?.pricePaise).toBe((pad?.pricePaise ?? 0) + (mouse?.pricePaise ?? 0))
    // No courier every parcel offers: the shopper picks per parcel, not from one list.
    expect(card?.choices).toEqual([])
  })

  it('charges the couriers picked per parcel, never more than each card showed', () => {
    const cfg = listConfig()
    const result = split(cfg)
    const card = result.options[0]
    const pad = card?.parcelOptions?.[0]
    const other = pad?.choices[1]
    expect(other).toBeDefined()
    const shown = shownPrices(result)
    const mouse = card?.parcelOptions?.[1]
    const keys = ['loc:open:1', 'loc:open:2']
    const choice = {
      optionId: 'std',
      routeKey: null,
      insured: card?.insurance.on ?? false,
      parcelRouteKeys: [other?.route.key ?? null, null],
    }
    const out = orderDeliveryFor(result, choice, 'prepaid', shown, cfg, keys)
    expect(out.ok).toBe(true)
    if (!out.ok) return
    expect(out.shipping.pricePaise).toBe((other?.pricePaise ?? 0) + (mouse?.pricePaise ?? 0))
    expect(out.delivery.pickedBy).toBe('shopper')
    expect(out.delivery.parcels?.map((p) => p.route?.key)).toEqual([
      other?.route.key,
      mouse?.pick?.route.key,
    ])
    expect(out.delivery.parcels?.map((p) => p.locationId)).toEqual(['loc', 'loc'])

    // A parcel shown cheaper than it costs now is charged what was shown.
    const lower = Object.fromEntries(
      Object.entries(shown).map(([k, v]) => [k, k.endsWith('|p1') ? v - 1000 : v]),
    )
    const again = orderDeliveryFor(result, choice, 'prepaid', lower, cfg, keys)
    expect(again.ok && again.shipping.pricePaise).toBe(
      (other?.pricePaise ?? 0) + (mouse?.pricePaise ?? 0) - 1000,
    )
  })

  it('keeps today’s shape for a choice without per-parcel keys', () => {
    const cfg = listConfig()
    const result = split(cfg)
    const out = orderDeliveryFor(
      result,
      { optionId: 'std', routeKey: null, insured: false },
      'prepaid',
      shownPrices(result),
      cfg,
      ['loc:open:1', 'loc:open:2'],
    )
    expect(out.ok && out.shipping.pricePaise).toBe(result.options[0]?.pricePaise)
  })
})

describe('quoteParcelDeliveries with a rule split', () => {
  /** An aggregator that offers Delhivery Surface and Bluedart Air for any parcel. */
  const aggregator = () => {
    const asked: string[] = []
    const provider = {
      id: 'shiprocket',
      label: 'Shiprocket',
      checkServiceability: vi.fn(),
      quoteOptions: vi.fn(async (q: { originPincode: string; weightGrams: number }) => {
        asked.push(`${q.originPincode}:${q.weightGrams}`)
        return [
          { ...quote('10', 'Delhivery Surface', 8000, [4, 5], 'Delhivery Surface') },
          { ...quote('20', 'Bluedart Air', 12800, [1, 2], 'Bluedart Air') },
        ].map((s) => ({ ...s, charges: [], chargeableWeightGrams: null }))
      }),
      createShipment: vi.fn(),
      track: vi.fn(),
      cancel: vi.fn(),
      verifyCredentials: vi.fn(),
    } as unknown as ShippingProvider
    return { provider, asked }
  }
  const located = (key: string, origin: string, items = [PAD, MOUSE]): QuoteParcel => ({
    key,
    lines: items.map((i) => ({ variantId: `v-${i.productId}`, quantity: 1 })),
    originPincode: origin,
    valuePaise: 75_000,
    weightGrams: 900,
    cart: { valuePaise: 75_000, weightGrams: 900, items },
  })

  it('splits within a warehouse parcel and leaves the other warehouse whole', async () => {
    const { provider, asked } = aggregator()
    const cfg = listConfig()
    const splitByRule = async (p: QuoteParcel, answers: readonly unknown[]) => {
      const groups = ruleGroups(cfg, p.cart.items, answers as never, p.weightGrams)
      if (!groups) return null
      return groups.map((g, i) => ({
        ...p,
        key: `${p.key}:${i + 1}`,
        lines: p.lines.filter((l) => g.some((id) => l.variantId === `v-${id}`)),
        weightGrams: 400,
        cart: {
          ...p.cart,
          weightGrams: 400,
          items: p.cart.items.filter((it) => g.includes(it.productId)),
        },
      }))
    }
    const { result, parcels } = await quoteParcelDeliveries({
      ...base(cfg),
      policy: POLICY,
      now: NOW,
      storeId: 's1',
      providers: [provider],
      providerSettings: undefined,
      destinationPincode: '400001',
      orderValuePaise: 150_000,
      parcels: [located('l1:open', '122001'), located('l2:open', '110001', [CABLE])],
      splitByRule,
    })
    expect(parcels.map((p) => p.key)).toEqual(['l1:open:1', 'l1:open:2', 'l2:open'])
    expect(parcels.map((p) => p.lines.map((l) => l.variantId))).toEqual([
      ['v-pad'],
      ['v-mouse'],
      ['v-cable'],
    ])
    // The two new parcels are asked about at their own weight.
    expect(asked.filter((a) => a === '122001:400').length).toBeGreaterThan(0)
    const card = result.options[0]
    expect(result.parcels).toHaveLength(3)
    expect(card?.parcelOptions?.map((p) => p.pick?.route.carrier)).toEqual([
      'Delhivery',
      'Blue Dart',
      expect.any(String),
    ])
  })

  it('asks nothing more when the rules share a courier', async () => {
    const { provider, asked } = aggregator()
    const cfg = listConfig([pads(), mice(['delhivery', 'bluedart'])])
    const known = [
      [
        answer('shiprocket', 'Shiprocket', [
          quote('10', 'Delhivery Surface', 8000, [4, 5], 'Delhivery Surface'),
        ]),
      ],
    ]
    const { parcels } = await quoteParcelDeliveries({
      ...base(cfg),
      storeId: 's1',
      providers: [provider],
      providerSettings: undefined,
      destinationPincode: '400001',
      orderValuePaise: 150_000,
      parcels: [located('l1:open', '122001')],
      known,
      splitByRule: async (p, answers) => {
        const groups = ruleGroups(cfg, p.cart.items, answers, p.weightGrams)
        return groups ? [p, p] : null
      },
    })
    expect(parcels.map((p) => p.key)).toEqual(['l1:open'])
    expect(asked).toEqual([])
  })
})
