import type {
  CredentialCheck,
  RateOption,
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
  rateOptionLabel,
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
    optionKey: 'x',
    providerId: 'x',
    providerName: 'X',
    providerLabel: 'X',
    serviceId: null,
    charges: [],
    chargeableWeightGrams: null,
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
    serviceId: null,
    charges: [] as CourierRateRow['charges'],
    chargeableWeightGrams: null,
    problem: null,
    problemDetail: null,
    deliveryBy: null,
    etaFromSettings: false,
  } as const
  const rows: CourierRateRow[] = [
    {
      ...unbadged,
      optionKey: 'delhivery',
      providerId: 'delhivery',
      providerName: 'Delhivery',
      providerLabel: 'Delhivery',
      pricePaise: null,
      minTransitDays: 2,
      maxTransitDays: 2,
      codAvailable: true,
      badges: ['fastest'],
    },
    {
      ...unbadged,
      optionKey: 'shiprocket',
      providerId: 'shiprocket',
      providerName: 'Shiprocket',
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

describe('compareCourierRates with per-service options', () => {
  const option = (over: Partial<RateOption>): RateOption => ({
    serviceId: 'S',
    serviceLabel: 'Surface',
    carrier: null,
    pricePaise: 9000,
    minTransitDays: 4,
    maxTransitDays: 4,
    codAvailable: null,
    charges: [],
    chargeableWeightGrams: null,
    ...over,
  })
  const withOptions = (
    id: string,
    label: string,
    options: RateOption[] | Error,
    serviceability: Partial<Serviceability> = {},
  ): ShippingProvider => ({
    ...fakeProvider(id, label, {
      quote: { pricePaise: 1, minTransitDays: 1, maxTransitDays: 1 },
      serviceability,
    }),
    async quoteOptions() {
      if (options instanceof Error) throw options
      return options
    },
  })

  it('names direct services after the courier and aggregator ones after the carrier', () => {
    expect(rateOptionLabel('Delhivery', option({ serviceLabel: 'Express' }))).toBe(
      'Delhivery Express',
    )
    expect(
      rateOptionLabel('Shiprocket', option({ serviceLabel: 'Bluedart Air', carrier: 'Bluedart' })),
    ).toBe('Bluedart Air (Shiprocket)')
  })

  it('lists every service as its own bookable row with its charges', async () => {
    const delhivery = withOptions('delhivery', 'Delhivery', [
      option({ charges: [{ kind: 'freight', pricePaise: 7000 }] }),
      option({ serviceId: 'E', serviceLabel: 'Express', pricePaise: 14000, minTransitDays: 2 }),
    ])
    const shiprocket = withOptions('shiprocket', 'Shiprocket', [
      option({
        serviceId: '10',
        serviceLabel: 'Delhivery Surface',
        carrier: 'Delhivery Surface',
        pricePaise: 8000,
        codAvailable: true,
      }),
    ])
    const rows = await compareCourierRates([delhivery, shiprocket], query)
    expect(rows.map((r) => [r.optionKey, r.providerLabel, r.serviceId])).toEqual([
      ['delhivery:S', 'Delhivery Surface', 'S'],
      ['delhivery:E', 'Delhivery Express', 'E'],
      ['shiprocket:10', 'Delhivery Surface (Shiprocket)', '10'],
    ])
    expect(rows[0]?.charges).toEqual([{ kind: 'freight', pricePaise: 7000 }])
    expect(rows.find((r) => r.badges.includes('cheapest'))?.optionKey).toBe('shiprocket:10')
    expect(rows.find((r) => r.badges.includes('fastest'))?.optionKey).toBe('delhivery:E')
  })

  it('takes COD support from serviceability when the options do not say', async () => {
    const p = withOptions('delhivery', 'Delhivery', [option({})], { codAvailable: false })
    const rows = await compareCourierRates([p], { ...query, paymentMode: 'cod' })
    expect(rows[0]).toMatchObject({ codAvailable: false, problem: 'no_cod' })
  })

  it('falls back to one row when the options fail or the PIN code is not served', async () => {
    const failing = withOptions('a', 'A', new Error('down'))
    const unserved = withOptions('b', 'B', [option({})], { serviceable: false, reason: 'No' })
    const rows = await compareCourierRates([failing, unserved], query)
    expect(rows.map((r) => [r.optionKey, r.serviceId, r.problem])).toEqual([
      ['a', null, null],
      ['b', null, 'not_serviceable'],
    ])
  })
})

describe('compareCourierRates coverage', () => {
  const abroad: RateQuery = { ...query, destinationPincode: '76449', destinationCountry: 'US' }

  /** A quoting courier that counts its serviceability calls. */
  function counting(id: string, calls: string[], coverage?: ShippingProvider['coverage']) {
    const base = fakeProvider(id, id, {
      quote: { pricePaise: 5000, minTransitDays: 3, maxTransitDays: 3 },
    })
    const provider: ShippingProvider = {
      ...base,
      ...(coverage ? { coverage } : {}),
      async checkServiceability(q) {
        calls.push(id)
        return base.checkServiceability(q)
      },
    }
    return provider
  }

  it('never asks a domestic courier about a foreign address, or an export courier about India', async () => {
    const calls: string[] = []
    const domestic = counting('delhivery', calls)
    const exports = counting('dhl-express', calls, 'international')

    const foreign = await compareCourierRates([domestic, exports], abroad)
    expect(foreign.find((r) => r.providerId === 'delhivery')).toMatchObject({
      problem: 'not_serviceable',
      problemDetail: 'Delivers within India only.',
    })
    expect(foreign.find((r) => r.providerId === 'dhl-express')).toMatchObject({
      problem: null,
      pricePaise: 5000,
    })
    expect(calls).toEqual(['dhl-express'])

    const home = await compareCourierRates([domestic, exports], query)
    expect(home.find((r) => r.providerId === 'dhl-express')).toMatchObject({
      problem: 'not_serviceable',
      problemDetail: 'Ships from India to other countries only.',
    })
    expect(calls).toEqual(['dhl-express', 'delhivery'])
  })

  it('passes the destination country and city on to serviceability', async () => {
    const seen: ServiceabilityQuery[] = []
    const base = fakeProvider('fedex', 'FedEx')
    const fedex: ShippingProvider = {
      ...base,
      coverage: 'international',
      async checkServiceability(q) {
        seen.push(q)
        return base.checkServiceability(q)
      },
    }
    await compareCourierRates([fedex], { ...abroad, destinationCity: 'Graford' })
    expect(seen[0]).toMatchObject({ destinationCountry: 'US', destinationCity: 'Graford' })
  })

  it('lists an export courier with no rate API (ShipGlobal) as "rate on booking" abroad', async () => {
    const { quoteRate: _noRates, ...base } = fakeProvider('shipglobal', 'ShipGlobal')
    const shipglobal: ShippingProvider = {
      ...base,
      coverage: 'international',
      tracksManually: true,
    }
    const dhl = counting('dhl-express', [], 'international')
    const rows = await compareCourierRates([dhl, shipglobal], abroad)
    expect(rows.find((r) => r.providerId === 'shipglobal')).toMatchObject({
      problem: null,
      pricePaise: null,
      serviceId: null,
      codAvailable: false,
    })
    const home = await compareCourierRates([shipglobal], query)
    expect(home[0]).toMatchObject({ problem: 'not_serviceable' })
  })
})
