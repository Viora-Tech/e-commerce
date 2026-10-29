/** SOURCE OF TRUTH: checkout courier quote tests — WHAT: parallel asks, the deadline, the cache and cache-only, with mocked courier clients / WHY: checkout must never wait on a slow courier. */
import type { RateOption, ShippingProvider } from '@commerce/shipping'
import { describe, expect, it, vi } from 'vitest'
import { deliveryQuoteKey, gatherProviderAnswers, type QuoteCache, valueBucket } from './quotes'
import { directCarrier, normaliseCarrier, serviceSpeed } from './routes'

const QUERY = {
  originPincode: '110001',
  destinationPincode: '400001',
  weightGrams: 700,
  valuePaise: 150_000,
  wantCod: true,
}

const opt = (
  serviceId: string,
  pricePaise: number,
  extra: Partial<RateOption> = {},
): RateOption => ({
  serviceId,
  serviceLabel: serviceId === 'E' ? 'Express' : 'Surface',
  carrier: null,
  pricePaise,
  minTransitDays: 2,
  maxTransitDays: 3,
  codAvailable: null,
  charges: [],
  chargeableWeightGrams: null,
  ...extra,
})

/** A mocked courier client: nothing here reaches a real API. */
function mockProvider(id: string, over: Partial<ShippingProvider> = {}): ShippingProvider {
  return {
    id,
    label: id,
    checkServiceability: vi.fn(async () => ({
      provider: id,
      serviceable: true,
      codAvailable: true,
      prepaidAvailable: true,
      minTransitDays: null,
      maxTransitDays: null,
      reason: null,
    })),
    createShipment: vi.fn(),
    track: vi.fn(),
    cancel: vi.fn(),
    verifyCredentials: vi.fn(),
    ...over,
  } as ShippingProvider
}

function memoryCache(): QuoteCache & { store: Map<string, unknown> } {
  const store = new Map<string, unknown>()
  return {
    store,
    get: async <T>(key: string) => (store.get(key) as T | undefined) ?? null,
    set: async (key, value) => {
      store.set(key, value)
    },
  }
}

describe('gatherProviderAnswers', () => {
  it('asks prepaid, COD and serviceability at once and reads the insurance line', async () => {
    const quoteOptions = vi.fn(async (q: { paymentMode: string }) => [
      opt('S', q.paymentMode === 'cod' ? 9000 : 6000, {
        charges: [{ kind: 'insurance', pricePaise: 1500 }],
      }),
    ])
    const [a] = await gatherProviderAnswers([mockProvider('delhivery', { quoteOptions })], QUERY, {
      storeId: 's1',
    })
    expect(quoteOptions).toHaveBeenCalledTimes(2)
    expect(a).toMatchObject({ status: 'ok', source: 'live', serviceable: true })
    expect(a?.services[0]).toMatchObject({
      pricePaise: 6000,
      codPricePaise: 9000,
      insurancePaise: 1500,
      codAvailable: true,
    })
  })

  it('a courier that misses the deadline is failed, not "not serviceable", and is cached when it lands', async () => {
    const cache = memoryCache()
    let land: (v: RateOption[]) => void = () => undefined
    const slow = mockProvider('shiprocket', {
      quoteOptions: () => new Promise<RateOption[]>((resolve) => (land = resolve)),
      checkServiceability: () => new Promise(() => undefined),
    })
    const fast = mockProvider('delhivery', { quoteOptions: async () => [opt('S', 6000)] })
    const answers = await gatherProviderAnswers(
      [slow, fast],
      { ...QUERY, wantCod: false },
      {
        storeId: 's1',
        cache,
        deadlineMs: 20,
      },
    )
    expect(answers.find((a) => a.providerId === 'shiprocket')).toMatchObject({
      status: 'failed',
      serviceable: null,
    })
    expect(answers.find((a) => a.providerId === 'delhivery')?.status).toBe('ok')
    land([opt('7', 8000)])
    await new Promise((r) => setTimeout(r, 10))
    expect(cache.store.has(deliveryQuoteKey('s1', 'shiprocket', QUERY))).toBe(false) // serviceability never answered
    expect(cache.store.has(deliveryQuoteKey('s1', 'delhivery', QUERY))).toBe(true)
  })

  it('reads the cache first, and cache-only never calls a courier', async () => {
    const cache = memoryCache()
    const quoteOptions = vi.fn(async () => [opt('S', 6000)])
    const p = mockProvider('delhivery', { quoteOptions })
    await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache })
    const again = await gatherProviderAnswers(
      [p],
      { ...QUERY, weightGrams: 900 },
      { storeId: 's1', cache },
    )
    expect(again[0]?.source).toBe('cache') // 700 g and 900 g share the 1 kg slab
    const other = await gatherProviderAnswers(
      [p],
      { ...QUERY, destinationPincode: '560001' },
      {
        storeId: 's1',
        cache,
        cacheOnly: true,
      },
    )
    expect(other[0]).toMatchObject({ status: 'failed', source: 'cache' })
    expect(quoteOptions).toHaveBeenCalledTimes(2) // prepaid + COD, once
  })

  it('a courier with only a single rate gives one service; transport failure is failed', async () => {
    const single = mockProvider('dtdc', {
      quoteRate: async () => ({ pricePaise: 5000, minTransitDays: 3, maxTransitDays: 4 }),
    })
    const broken = mockProvider('bluedart', {
      checkServiceability: async () => {
        throw new Error('ECONNRESET')
      },
    })
    const intl = mockProvider('dhl-express', { coverage: 'international' })
    const answers = await gatherProviderAnswers([single, broken, intl], QUERY, { storeId: 's1' })
    expect(answers).toHaveLength(2)
    expect(answers[0]?.services[0]).toMatchObject({
      serviceId: '',
      pricePaise: 5000,
      codPricePaise: 5000,
    })
    expect(answers[1]).toMatchObject({ status: 'failed' })
  })

  it('buckets order value', () => {
    expect(valueBucket(150_000)).toBe('0-2k')
    expect(valueBucket(300_000)).toBe('2-5k')
    expect(valueBucket(800_000)).toBe('5k+')
  })
})

describe('carrier names and speeds', () => {
  it('names the carrier, never the aggregator', () => {
    expect(normaliseCarrier('Bluedart Air')).toEqual({ key: 'bluedart', name: 'Blue Dart' })
    expect(normaliseCarrier('Blue Dart Surface 2kg')).toEqual({
      key: 'bluedart',
      name: 'Blue Dart',
    })
    expect(normaliseCarrier('Shree Maruti 2kg')).toEqual({
      key: 'shree-maruti',
      name: 'Shree Maruti',
    })
    expect(directCarrier('indiapost', 'India Post')).toEqual({
      key: 'india-post',
      name: 'India Post',
    })
  })

  it('tells Surface from Express, ignoring the carrier name', () => {
    expect(serviceSpeed('E', 'Express', 'Delhivery')).toBe('express')
    expect(serviceSpeed('S', 'Surface', 'Delhivery')).toBe('standard')
    expect(serviceSpeed('20', 'Bluedart Air', 'Blue Dart')).toBe('express')
    expect(serviceSpeed('9', 'Ecom Express Surface', 'Ecom Express')).toBe('standard')
    expect(serviceSpeed('9', 'Ecom Express', 'Ecom Express')).toBe('standard')
  })
})
