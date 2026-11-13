/** SOURCE OF TRUTH: split-cart delivery tests — WHAT: one parcel is the plain engine, two parcels add up per option, a parcel that cannot be quoted hides the option or falls back like one parcel, the Shipping rate is charged once / WHY: a cart from two warehouses is two labels (#1546). */
import type { ShippingProvider } from '@commerce/shipping'
import { describe, expect, it, vi } from 'vitest'
import { orderDeliveryFor, quoteParcelDeliveries } from './checkout'
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

describe('resolveParcelDeliveries: insurance, free shipping and each parcel kept', () => {
  /** Delhivery insures at 1%, at least ₹30. */
  const insuring = {
    key: 'carrier:delhivery|channel:any',
    insurancePercent: 1,
    insuranceMinPaise: 3000,
    enabled: true,
  }
  const withSettings = (options: DeliveryOption[]) => ({
    ...base(options),
    config: { ...config(options), routeSettings: [insuring] },
  })
  /** Free India shipping: the Shipping rate lists ₹49 and charges ₹0. */
  const freeZone = (options: DeliveryOption[]): Omit<ResolveInput, 'cart' | 'answers'> => {
    const b = base(options)
    const rates = b.zone.kind === 'rates' ? b.zone.options : []
    return { ...b, zone: { kind: 'rates', options: rates.map((r) => ({ ...r, pricePaise: 0 })) } }
  }
  /* Delhivery through Shiprocket: the route rate applies (Delhivery direct would ignore it for
     its Protect card). */
  const viaShiprocket = (surface: number, express: number): ProviderAnswer => {
    const d = delhivery(surface, express)
    return {
      ...d,
      providerId: 'shiprocket',
      providerLabel: 'Shiprocket',
      services: d.services.map((s) => ({ ...s, carrier: 'Delhivery' })),
    }
  }
  const twoParcels = [
    { cart: cart(100_000, 6554), answers: [viaShiprocket(14000, 26000)] },
    { cart: cart(50_000, 500), answers: [viaShiprocket(4500, 9100)] },
  ]

  it('priced from the Shipping rate without insurance: the rate exactly as typed', () => {
    // The ₹49 rate is ₹49 at checkout, never rounded up to ₹50 (Waimers' ₹99 showed as ₹100).
    const zonePriced = option('std', { name: 'Standard', price: { source: 'zone' } }, 0)
    const one = { cart: cart(150_000, 500), answers: [viaShiprocket(4500, 9100)] }
    const r = resolveDeliveryOptions({ ...base([zonePriced]), ...one })
    expect(find(r, 'std')).toMatchObject({ pricePaise: 4900, listPricePaise: 4900 })
  })

  it('priced from the Shipping rate: the rate once, but every parcel’s insurance', () => {
    const zoneInsured = option(
      'std',
      { name: 'Standard', price: { source: 'zone' }, insurance: { default: 'on' } },
      0,
    )
    const r = resolveParcelDeliveries(withSettings([zoneInsured]), twoParcels, 150_000)
    const std = find(r, 'std')
    // Each parcel insures at ₹30 (1% is less) + 18% GST = ₹35.40. The ₹49 rate is counted once
    // as ₹49, not as a parcel's rounded ₹90 less its insurance (₹54.60, which gave ₹130):
    // ₹49 + ₹35.40 + ₹35.40 = ₹119.80 → ₹120.
    expect(std?.insurance).toMatchObject({ on: true, pricePaise: 3540 + 3540 })
    expect(std?.pick?.insurancePaise).toBe(7080)
    expect(std?.pricePaise).toBe(12000)
    expect(std?.listPricePaise).toBe(12000)
  })

  it('priced by the courier: every parcel’s insurance is in the price too', () => {
    const insured = option('std', { name: 'Standard', insurance: { default: 'on' } }, 0)
    const r = resolveParcelDeliveries(withSettings([insured]), twoParcels, 150_000)
    // Insurance ₹30 + 18% GST = ₹35.40 each: (₹140 + ₹35.40 → ₹180) + (₹45 + ₹35.40 → ₹90).
    expect(find(r, 'std')?.pricePaise).toBe(18000 + 9000)
    expect(find(r, 'std')?.insurance.pricePaise).toBe(7080)
  })

  it('free India shipping stays free with two parcels: ₹0 delivery', () => {
    const zonePriced = option('std', { name: 'Standard', price: { source: 'zone' } }, 0)
    const r = resolveParcelDeliveries(freeZone([zonePriced]), twoParcels, 150_000)
    expect(find(r, 'std')).toMatchObject({ pricePaise: 0, source: 'live' })
    // Couriers down for both parcels: the free Shipping rate, still ₹0.
    const down2 = twoParcels.map((p) => ({ ...p, answers: [down] }))
    expect(
      find(resolveParcelDeliveries(freeZone([STANDARD]), down2, 150_000), 'std'),
    ).toMatchObject({ source: 'backup', pricePaise: 0 })
  })

  it('keeps each parcel’s own result, so the order can save every parcel’s courier', () => {
    const dtdc: ProviderAnswer = {
      ...delhivery(3000, 9000),
      providerId: 'dtdc',
      providerLabel: 'DTDC',
    }
    const r = resolveParcelDeliveries(
      base([STANDARD]),
      [
        { cart: cart(100_000, 6554), answers: [delhivery(14000, 26000)] },
        { cart: cart(50_000, 500), answers: [dtdc] },
      ],
      150_000,
    )
    expect(r.parcels).toHaveLength(2)
    const out = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: false },
      'prepaid',
      null,
      config([STANDARD]),
      ['loc-a:open', 'loc-b:on_hold'],
    )
    if (!out.ok) throw new Error(out.problem)
    // The order's own route stays the first parcel's; each parcel keeps the courier it was quoted.
    expect(out.delivery.route?.providerId).toBe('delhivery')
    expect(out.delivery.parcels).toEqual([
      expect.objectContaining({
        locationId: 'loc-a',
        onHold: false,
        route: expect.objectContaining({ providerId: 'delhivery' }),
        courierCostPaise: 14000,
      }),
      expect.objectContaining({
        locationId: 'loc-b',
        onHold: true,
        route: expect.objectContaining({ providerId: 'dtdc' }),
        courierCostPaise: 3000,
      }),
    ])
    // COD books each parcel's COD route.
    const cod = orderDeliveryFor(
      r,
      { optionId: 'std', routeKey: null, insured: false },
      'cod',
      null,
      config([STANDARD]),
      ['loc-a:open', 'loc-b:on_hold'],
    )
    if (!cod.ok) throw new Error(cod.problem)
    expect(cod.delivery.parcels?.map((p) => p.courierCostPaise)).toEqual([17000, 6000])
  })

  it('one parcel, or no parcel keys: no parcel routes saved (single-location orders unchanged)', () => {
    const one = resolveParcelDeliveries(
      base([STANDARD]),
      [{ cart: cart(150_000, 500), answers: [delhivery(6000, 9000)] }],
      150_000,
    )
    const choice = { optionId: 'std', routeKey: null, insured: false }
    const out = orderDeliveryFor(one, choice, 'prepaid', null, config([STANDARD]), ['loc-a:open'])
    if (!out.ok) throw new Error(out.problem)
    expect(out.delivery.parcels).toBeUndefined()
    const two = resolveParcelDeliveries(base([STANDARD]), twoParcels, 150_000)
    const none = orderDeliveryFor(two, choice, 'prepaid', null, config([STANDARD]))
    if (!none.ok) throw new Error(none.problem)
    expect(none.delivery.parcels).toBeUndefined()
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
      providerSettings: undefined,
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
      providerSettings: undefined,
      deadlineMs: 20,
      destinationPincode: '400001',
      orderValuePaise: 150_000,
      parcels: [parcel('a', '122001', 6554, 100_000), parcel('b', '110001', 500, 50_000)],
    })
    expect(find(result, 'exp')).toBeUndefined()
    expect(find(result, 'std')).toMatchObject({ source: 'backup', pricePaise: 4900 })
  })
})
