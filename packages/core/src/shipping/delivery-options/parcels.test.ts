/** SOURCE OF TRUTH: split-cart delivery tests — WHAT: one parcel is the plain engine, two parcels add up per option, a parcel that cannot be quoted hides the option or falls back like one parcel, the Shipping rate is charged once / WHY: a cart from two warehouses is two labels (#1546). */
import type { ShippingProvider } from '@commerce/shipping'
import { describe, expect, it, vi } from 'vitest'
import { quoteParcelDeliveries } from './checkout'
import { type DeliveryConfig, type DeliveryOption, DeliveryOptionInputSchema } from './config'
import { resolveParcelDeliveries, shareValue } from './parcels'
import { resolveDeliveryOptions } from './resolve'
import type { ResolveInput } from './resolve-types'
import type { ProviderAnswer } from './routes'

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

const option = (id: string, input: Record<string, unknown>, position: number): DeliveryOption => ({
  ...DeliveryOptionInputSchema.parse(input),
  id,
  position,
})
const STANDARD = option('std', { name: 'Standard', speed: 'standard' }, 0)
const EXPRESS = option(
  'exp',
  { name: 'Express', speed: 'express', strategy: 'fastest', cod: { mode: 'prepaid_only' } },
  1,
)
const config = (options = [STANDARD, EXPRESS]): DeliveryConfig => ({
  options,
  rules: [],
  routeSettings: [],
  version: 'v1',
})

/** Delhivery direct: Surface and Express at these prices (paise). */
const delhivery = (surface: number, express: number, maxDays = 5): ProviderAnswer => ({
  providerId: 'delhivery',
  providerLabel: 'Delhivery',
  status: 'ok',
  source: 'live',
  ms: 300,
  error: null,
  serviceable: true,
  services: [
    {
      serviceId: 'S',
      serviceLabel: 'Surface',
      carrier: null,
      pricePaise: surface,
      codPricePaise: surface + 3000,
      insurancePaise: null,
      minTransitDays: maxDays - 1,
      maxTransitDays: maxDays,
      codAvailable: true,
    },
    {
      serviceId: 'E',
      serviceLabel: 'Express',
      carrier: null,
      pricePaise: express,
      codPricePaise: null,
      insurancePaise: null,
      minTransitDays: 2,
      maxTransitDays: 3,
      codAvailable: true,
    },
  ],
})
const down: ProviderAnswer = {
  providerId: 'delhivery',
  providerLabel: 'Delhivery',
  status: 'failed',
  source: 'live',
  ms: null,
  error: 'No answer within 800 ms',
  serviceable: null,
  services: [],
}

const base = (options?: DeliveryOption[]): Omit<ResolveInput, 'cart' | 'answers'> => ({
  config: config(options),
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
})
const cart = (valuePaise: number, weightGrams: number) => ({ valuePaise, weightGrams, items: [] })
const find = (r: ReturnType<typeof resolveDeliveryOptions>, id: string) =>
  r.options.find((o) => o.optionId === id)

describe('resolveParcelDeliveries', () => {
  it('one location: exactly the single-parcel engine', () => {
    const one = { cart: cart(150_000, 6554), answers: [delhivery(14000, 26000)] }
    expect(resolveParcelDeliveries(base(), [one], 150_000)).toEqual(
      resolveDeliveryOptions({ ...base(), ...one }),
    )
  })

  it('two locations: each parcel priced on its own, added up per option', () => {
    const r = resolveParcelDeliveries(
      base(),
      [
        { cart: cart(100_000, 6554), answers: [delhivery(14000, 26000, 5)] },
        { cart: cart(50_000, 500), answers: [delhivery(4500, 9100, 3)] },
      ],
      150_000,
    )
    // ₹140 + ₹45 → ₹50 (rounded up to ₹10 per parcel).
    expect(find(r, 'std')).toMatchObject({ pricePaise: 14000 + 5000, source: 'live' })
    expect(find(r, 'std')?.pick).toMatchObject({ courierCostPaise: 14000 + 4500 })
    // COD: ₹170 + ₹75 → ₹80.
    expect(find(r, 'std')?.cod?.pricePaise).toBe(17000 + 8000)
    expect(find(r, 'exp')?.pricePaise).toBe(26000 + 10000)
    // The later parcel's dates: the 5-day one.
    const alone = resolveDeliveryOptions({
      ...base(),
      cart: cart(100_000, 6554),
      answers: [delhivery(14000, 26000, 5)],
    })
    expect(find(r, 'std')?.latest).toBe(find(alone, 'std')?.latest)
  })

  it('free-above reads the whole order, not each parcel', () => {
    const free = option('std', { name: 'Standard', price: { freeAbovePaise: 120_000 } }, 0)
    const r = resolveParcelDeliveries(
      base([free]),
      [
        { cart: cart(100_000, 500), answers: [delhivery(6000, 10000)] },
        { cart: cart(50_000, 500), answers: [delhivery(6000, 10000)] },
      ],
      150_000,
    )
    expect(find(r, 'std')?.pricePaise).toBe(0)
  })

  it('a parcel that cannot be quoted: Express hidden, Standard on backup at the Shipping rate', () => {
    const r = resolveParcelDeliveries(
      base(),
      [
        { cart: cart(100_000, 6554), answers: [delhivery(14000, 26000)] },
        { cart: cart(50_000, 500), answers: [down] },
      ],
      150_000,
    )
    expect(find(r, 'exp')).toBeUndefined()
    // The quoted parcel's ₹140 plus the Shipping rate (₹49) for the one that fell back.
    expect(find(r, 'std')).toMatchObject({
      source: 'backup',
      pick: null,
      pricePaise: 14000 + 4900,
      backupRate: { rateId: 'rate-1' },
    })
  })

  it('the Shipping rate is charged once, never once per parcel', () => {
    const r = resolveParcelDeliveries(
      base(),
      [
        { cart: cart(100_000, 6554), answers: [down] },
        { cart: cart(50_000, 500), answers: [down] },
      ],
      150_000,
    )
    expect(find(r, 'std')).toMatchObject({ source: 'backup', pricePaise: 4900 })
  })

  it('no option every parcel can carry: none', () => {
    const r = resolveParcelDeliveries(
      base([EXPRESS]),
      [
        { cart: cart(100_000, 6554), answers: [delhivery(14000, 26000)] },
        { cart: cart(50_000, 500), answers: [down] },
      ],
      150_000,
    )
    expect(r).toMatchObject({ status: 'none', options: [] })
  })
})

describe('shareValue', () => {
  it('splits the order value by the parcels’ goods, rounding on the last', () => {
    expect(shareValue(1000, [1, 2])).toEqual([333, 667])
    expect(shareValue(1000, [0, 0])).toEqual([1000, 0])
  })
})

describe('quoteParcelDeliveries', () => {
  /** A mocked courier: every ask takes `ms`; nothing reaches a real API. */
  const slowCourier = (ms: number) => {
    const asked: Array<{ originPincode: string; weightGrams: number }> = []
    const provider = {
      id: 'delhivery',
      label: 'Delhivery',
      checkServiceability: vi.fn(async () => ({
        provider: 'delhivery',
        serviceable: true,
        codAvailable: true,
        prepaidAvailable: true,
        minTransitDays: 3,
        maxTransitDays: 4,
        reason: null,
      })),
      quoteOptions: vi.fn(async (q: { originPincode: string; weightGrams: number }) => {
        asked.push({ originPincode: q.originPincode, weightGrams: q.weightGrams })
        await new Promise((r) => setTimeout(r, ms))
        return [
          {
            serviceId: 'S',
            serviceLabel: 'Surface',
            carrier: null,
            pricePaise: q.weightGrams > 1000 ? 14000 : 6000,
            minTransitDays: 3,
            maxTransitDays: 4,
            codAvailable: true,
            charges: [],
            chargeableWeightGrams: null,
          },
        ]
      }),
      createShipment: vi.fn(),
      track: vi.fn(),
      cancel: vi.fn(),
      verifyCredentials: vi.fn(),
    } as unknown as ShippingProvider
    return { provider, asked }
  }
  const parcel = (key: string, originPincode: string, weightGrams: number, valuePaise: number) => ({
    key,
    lines: [{ variantId: key, quantity: 1 }],
    originPincode,
    valuePaise,
    weightGrams,
    cart: cart(valuePaise, weightGrams),
  })

  it('asks each parcel from its own location at once, within one deadline, and adds up', async () => {
    const { provider, asked } = slowCourier(50)
    const started = Date.now()
    const { result, parcels } = await quoteParcelDeliveries({
      ...base([STANDARD]),
      storeId: 's1',
      providers: [provider],
      deadlineMs: 300,
      destinationPincode: '400001',
      orderValuePaise: 150_000,
      parcels: [parcel('a', '122001', 6554, 100_000), parcel('b', '110001', 500, 50_000)],
    })
    // In parallel: about one ask's time, not two.
    expect(Date.now() - started).toBeLessThan(280)
    // Prepaid and COD, for each parcel from its own PIN code.
    expect([...new Set(asked.map((a) => a.originPincode))].sort()).toEqual(['110001', '122001'])
    expect(find(result, 'std')?.pricePaise).toBe(14000 + 6000)
    expect(parcels.map((p) => p.key)).toEqual(['a', 'b'])
    expect(parcels.every((p) => p.answers[0]?.status === 'ok')).toBe(true)
  })

  it('a parcel whose courier misses the deadline falls back like one parcel', async () => {
    const { provider } = slowCourier(200)
    const { result } = await quoteParcelDeliveries({
      ...base(),
      storeId: 's1',
      providers: [provider],
      deadlineMs: 20,
      destinationPincode: '400001',
      orderValuePaise: 150_000,
      parcels: [parcel('a', '122001', 6554, 100_000), parcel('b', '110001', 500, 50_000)],
    })
    expect(find(result, 'exp')).toBeUndefined()
    expect(find(result, 'std')).toMatchObject({ source: 'backup', pricePaise: 4900 })
  })
})
