import type {
  CredentialCheck,
  RateQuery,
  RateQuote,
  Serviceability,
  ServiceabilityQuery,
  ShippingProvider,
} from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import { chooseCourier, compareCourierRates } from './courier-rates'

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

describe('chooseCourier', () => {
  const shiprocket = fakeProvider('shiprocket', 'Shiprocket')
  const delhivery = fakeProvider('delhivery', 'Delhivery')
  const providers = [delhivery, shiprocket]
  const rows = [
    {
      providerId: 'delhivery',
      providerLabel: 'Delhivery',
      pricePaise: null,
      minTransitDays: 2,
      maxTransitDays: 2,
      codAvailable: true,
      badges: ['fastest' as const],
    },
    {
      providerId: 'shiprocket',
      providerLabel: 'Shiprocket',
      pricePaise: 6000,
      minTransitDays: 3,
      maxTransitDays: 3,
      codAvailable: null,
      badges: ['cheapest' as const, 'recommended' as const],
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
