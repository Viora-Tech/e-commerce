import type {
  CredentialCheck,
  RateQuery,
  RateQuote,
  Serviceability,
  ServiceabilityQuery,
  ShippingProvider,
} from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import {
  type CourierRateRow,
  chooseCourier,
  compareCourierRates,
  datedCourierRows,
} from './courier-rates'

const query: RateQuery = {
  originPincode: '131028',
  destinationPincode: '560001',
  weightGrams: 500,
  declaredValuePaise: 199900,
  paymentMode: 'prepaid',
}

/** A minimal ShippingProvider for these pure-function tests. */
function fakeProvider(
  id: string,
  label: string,
  opts: {
    quote?: RateQuote | null | (() => Promise<RateQuote | null>)
    serviceability?: Partial<Serviceability>
  } = {},
): ShippingProvider {
  return {
    id,
    label,
    async quoteRate(): Promise<RateQuote | null> {
      if (typeof opts.quote === 'function') return opts.quote()
      return opts.quote ?? null
    },
    async checkServiceability(_q: ServiceabilityQuery): Promise<Serviceability> {
      return {
        provider: id,
        serviceable: true,
        codAvailable: false,
        prepaidAvailable: true,
        minTransitDays: null,
        maxTransitDays: null,
        reason: null,
        ...opts.serviceability,
      }
    },
    async createShipment() {
      throw new Error('not used in these tests')
    },
    async track() {
      throw new Error('not used in these tests')
    },
    async cancel() {},
    async verifyCredentials(): Promise<CredentialCheck> {
      return { ok: true, message: 'ok' }
    },
  }
}

describe('compareCourierRates', () => {
  it('ranks a quoting courier by price and a serviceability-only courier by transit time', async () => {
    const shiprocket = fakeProvider('shiprocket', 'Shiprocket', {
      quote: { pricePaise: 6000, minTransitDays: 3, maxTransitDays: 3 },
    })
    const delhivery = fakeProvider('delhivery', 'Delhivery', {
      serviceability: { minTransitDays: 2, maxTransitDays: 2, codAvailable: true },
    })
    const rows = await compareCourierRates([shiprocket, delhivery], query)
    const sr = rows.find((r) => r.providerId === 'shiprocket')
    const dl = rows.find((r) => r.providerId === 'delhivery')
    expect(sr).toMatchObject({
      pricePaise: 6000,
      minTransitDays: 3,
      badges: ['cheapest', 'recommended'],
    })
    expect(dl).toMatchObject({
      pricePaise: null,
      minTransitDays: 2,
      codAvailable: true,
      badges: ['fastest'],
    })
  })

  it('a courier that throws still gets a row instead of blanking the table', async () => {
    const ok = fakeProvider('shiprocket', 'Shiprocket', {
      quote: { pricePaise: 6000, minTransitDays: 3, maxTransitDays: 3 },
    })
    const brokenBase = fakeProvider('delhivery', 'Delhivery')
    const broken: ShippingProvider = {
      id: brokenBase.id,
      label: brokenBase.label,
      async checkServiceability() {
        throw new Error('boom')
      },
      createShipment: brokenBase.createShipment,
      track: brokenBase.track,
      cancel: brokenBase.cancel,
      verifyCredentials: brokenBase.verifyCredentials,
    }
    const rows = await compareCourierRates([ok, broken], query)
    expect(rows).toHaveLength(2)
    expect(rows.find((r) => r.providerId === 'delhivery')).toMatchObject({
      pricePaise: null,
      minTransitDays: null,
      badges: [],
    })
  })

  it('an unserviceable route gets nulls, not a fabricated quote', async () => {
    const p = fakeProvider('delhivery', 'Delhivery', { serviceability: { serviceable: false } })
    const rows = await compareCourierRates([p], query)
    expect(rows[0]).toMatchObject({ pricePaise: null, minTransitDays: null, badges: [] })
  })

  it('recommends the fastest when nobody quotes a price', async () => {
    const a = fakeProvider('a', 'A', { serviceability: { minTransitDays: 4, maxTransitDays: 4 } })
    const b = fakeProvider('b', 'B', { serviceability: { minTransitDays: 2, maxTransitDays: 2 } })
    const rows = await compareCourierRates([a, b], query)
    expect(rows.find((r) => r.providerId === 'b')?.badges).toContain('recommended')
  })
})

describe('compareCourierRates problems', () => {
  it('marks a courier that never answered as unreachable, with the app wording', async () => {
    const base = fakeProvider('rapidshyp', 'RapidShyp')
    const down: ShippingProvider = {
      ...base,
      async quoteRate() {
        throw new Error('socket hang up')
      },
      async checkServiceability() {
        throw new Error('socket hang up')
      },
    }
    const [row] = await compareCourierRates([down], query)
    expect(row).toMatchObject({ problem: 'unreachable', problemDetail: 'socket hang up' })
    expect(row?.badges).toEqual([])
  })

  it('a PIN code the courier does not reach is a problem row with its reason', async () => {
    const p = fakeProvider('delhivery', 'Delhivery', {
      quote: { pricePaise: 4000, minTransitDays: 2, maxTransitDays: 3 },
      serviceability: { serviceable: false, reason: 'Pincode not serviceable' },
    })
    const [row] = await compareCourierRates([p], query)
    expect(row).toMatchObject({
      problem: 'not_serviceable',
      problemDetail: 'Pincode not serviceable',
      pricePaise: null,
      badges: [],
    })
  })

  it('a COD parcel never recommends a courier without COD there, even if cheapest', async () => {
    const cheapNoCod = fakeProvider('a', 'A', {
      quote: { pricePaise: 3000, minTransitDays: 2, maxTransitDays: 2 },
      serviceability: { codAvailable: false },
    })
    const dearCod = fakeProvider('b', 'B', {
      quote: { pricePaise: 5000, minTransitDays: 4, maxTransitDays: 5 },
      serviceability: { codAvailable: true },
    })
    const rows = await compareCourierRates([cheapNoCod, dearCod], {
      ...query,
      paymentMode: 'cod',
    })
    expect(rows.find((r) => r.providerId === 'a')).toMatchObject({ problem: 'no_cod', badges: [] })
    expect(rows.find((r) => r.providerId === 'b')?.badges).toEqual([
      'cheapest',
      'fastest',
      'recommended',
    ])
  })

  it('the same courier without COD is fine for a prepaid parcel', async () => {
    const p = fakeProvider('a', 'A', {
      quote: { pricePaise: 3000, minTransitDays: 2, maxTransitDays: 2 },
      serviceability: { codAvailable: false },
    })
    const [row] = await compareCourierRates([p], query)
    expect(row).toMatchObject({ problem: null, codAvailable: false })
    expect(row?.badges).toContain('recommended')
  })

  it('a courier with no rate call still gets a bookable row, priced on booking', async () => {
    const base = fakeProvider('delhivery', 'Delhivery', {
      serviceability: { minTransitDays: 3, maxTransitDays: 4, codAvailable: true },
    })
    const { quoteRate: _unused, ...noRates } = base
    const [row] = await compareCourierRates([noRates], query)
    expect(row).toMatchObject({ pricePaise: null, problem: null, minTransitDays: 3 })
    expect(row?.badges).toContain('recommended')
  })

  it('recommends the only courier that can take the parcel when nobody quotes or times', async () => {
    const a = fakeProvider('a', 'A', { serviceability: { serviceable: false } })
    const b = fakeProvider('b', 'B')
    const rows = await compareCourierRates([a, b], query)
    expect(rows.find((r) => r.providerId === 'b')?.badges).toEqual(['recommended'])
  })
})

describe('datedCourierRows', () => {
  const policy = {
    cutoff: '14:00',
    timeZone: 'Asia/Kolkata',
    workingDays: [1, 2, 3, 4, 5, 6],
    deliveryDays: [1, 2, 3, 4, 5, 6, 7],
    holidays: [],
    defaultMinTransitDays: 3,
    defaultMaxTransitDays: 6,
  }
  // Tuesday 13 Oct 2026, 10:00 IST: dispatches today.
  const now = new Date('2026-10-13T04:30:00Z')
  const row = (over: Partial<CourierRateRow>): CourierRateRow => ({
    providerId: 'x',
    providerLabel: 'X',
    pricePaise: null,
    minTransitDays: null,
    maxTransitDays: null,
    codAvailable: null,
    problem: null,
    problemDetail: null,
    deliveryBy: null,
    etaFromSettings: false,
    badges: [],
    ...over,
  })

  it('dates a courier from its own transit days', () => {
    const [r] = datedCourierRows([row({ minTransitDays: 2, maxTransitDays: 3 })], policy, now)
    expect(r).toMatchObject({ deliveryBy: '2026-10-16', etaFromSettings: false })
  })

  it("falls back to the store's usual transit days and says so", () => {
    const [r] = datedCourierRows([row({})], policy, now)
    expect(r).toMatchObject({ deliveryBy: '2026-10-19', etaFromSettings: true })
  })

  it('leaves a courier that cannot take the parcel undated', () => {
    const [r] = datedCourierRows([row({ problem: 'not_serviceable' })], policy, now)
    expect(r?.deliveryBy).toBeNull()
  })
})

describe('chooseCourier', () => {
  const shiprocket = fakeProvider('shiprocket', 'Shiprocket')
  const delhivery = fakeProvider('delhivery', 'Delhivery')
  const providers = [delhivery, shiprocket]
  const unbadged = {
    problem: null,
    problemDetail: null,
    deliveryBy: null,
    etaFromSettings: false,
  } as const
  const rows: CourierRateRow[] = [
    {
      ...unbadged,
      providerId: 'delhivery',
      providerLabel: 'Delhivery',
      pricePaise: null,
      minTransitDays: 2,
      maxTransitDays: 2,
      codAvailable: true,
      badges: ['fastest'],
    },
    {
      ...unbadged,
      providerId: 'shiprocket',
      providerLabel: 'Shiprocket',
      pricePaise: 6000,
      minTransitDays: 3,
      maxTransitDays: 3,
      codAvailable: null,
      badges: ['cheapest', 'recommended'],
    },
  ]

  it('cheapest picks the cheapest-badged row', () => {
    expect(chooseCourier(rows, providers, { mode: 'cheapest' })?.id).toBe('shiprocket')
  })

  it('fastest picks the fastest-badged row', () => {
    expect(chooseCourier(rows, providers, { mode: 'fastest' })?.id).toBe('delhivery')
  })

  it('preferred picks that courier even if not cheapest', () => {
    expect(chooseCourier(rows, providers, { mode: 'preferred', providerId: 'delhivery' })?.id).toBe(
      'delhivery',
    )
  })

  it('preferred falls back to the first connected courier when not connected', () => {
    expect(chooseCourier(rows, providers, { mode: 'preferred', providerId: 'ghost' })?.id).toBe(
      'delhivery',
    )
  })

  it('per_zone matches the destination state', () => {
    const rule = {
      mode: 'per_zone' as const,
      zones: [{ stateCodes: ['KA'], providerId: 'shiprocket' }],
      fallback: 'cheapest' as const,
    }
    expect(chooseCourier(rows, providers, rule, { stateCode: 'KA' })?.id).toBe('shiprocket')
    expect(chooseCourier(rows, providers, rule, { stateCode: 'HR' })?.id).toBe('shiprocket')
  })

  it('empty rows falls back to the first connected courier', () => {
    expect(chooseCourier([], providers, { mode: 'cheapest' })?.id).toBe('delhivery')
  })

  it('no connected couriers returns null', () => {
    expect(chooseCourier([], [], { mode: 'cheapest' })).toBeNull()
  })
})
