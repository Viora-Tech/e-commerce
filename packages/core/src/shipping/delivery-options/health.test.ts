/** SOURCE OF TRUTH: courier health tests — WHAT: the circuit breaker, stale-while-revalidate, the health line and the backup share, with mocked courier clients and an in-memory store / WHY: a courier outage must cost checkout nothing after the first few calls. */
import type { RateOption, ShippingProvider } from '@commerce/shipping'
import { describe, expect, it, vi } from 'vitest'
import {
  BREAKER_FAILURES,
  deliveryHealth,
  type HealthStore,
  onBackup,
  recordCheckoutQuote,
  recordCourierCall,
} from './health'
import { shippingMargin } from './margin'
import { DELIVERY_QUOTE_FRESH_MS, gatherProviderAnswers } from './quotes'

const QUERY = {
  originPincode: '110001',
  destinationPincode: '400001',
  weightGrams: 700,
  valuePaise: 150_000,
  wantCod: false,
}

const opt = (serviceId: string, pricePaise: number): RateOption => ({
  serviceId,
  serviceLabel: 'Surface',
  carrier: null,
  pricePaise,
  minTransitDays: 2,
  maxTransitDays: 3,
  codAvailable: null,
  charges: [],
  chargeableWeightGrams: null,
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

/** Redis stand-in with the counter and list calls (TTLs ignored). */
function memoryStore(): HealthStore & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>()
  return {
    data,
    get: async <T>(key: string) => (data.get(key) as T | undefined) ?? null,
    set: async (key, value) => {
      data.set(key, value)
    },
    incr: async (key) => {
      const n = ((data.get(key) as number | undefined) ?? 0) + 1
      data.set(key, n)
      return n
    },
    push: async (key, value, keep) => {
      data.set(key, [value, ...((data.get(key) as unknown[] | undefined) ?? [])].slice(0, keep))
    },
    list: async <T>(key: string) => ((data.get(key) as T[] | undefined) ?? []) as T[],
  }
}

const flush = () => new Promise((r) => setTimeout(r, 5))

const broken = (calls: { n: number }) =>
  mockProvider('shiprocket', {
    quoteOptions: async () => {
      calls.n++
      throw new Error('ECONNRESET')
    },
    checkServiceability: async () => {
      throw new Error('ECONNRESET')
    },
  })

describe('circuit breaker', () => {
  it('skips an app after 3 failures and records each call for the health line', async () => {
    const store = memoryStore()
    const calls = { n: 0 }
    const p = broken(calls)
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      const [a] = await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store })
      expect(a).toMatchObject({ status: 'failed', source: 'live' })
      await flush()
    }
    expect(calls.n).toBe(BREAKER_FAILURES)
    const [skipped] = await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store })
    expect(skipped).toMatchObject({ status: 'failed', serviceable: null })
    expect(skipped?.error).toMatch(/^Skipped since/)
    expect(calls.n).toBe(BREAKER_FAILURES) // not asked while open
    const health = await deliveryHealth(store, 's1', ['shiprocket', 'delhivery'])
    expect(health.apps[0]).toMatchObject({
      providerId: 'shiprocket',
      calls: 3,
      successRate: 0,
      typicalMs: null,
    })
    expect(health.apps[0]?.skippedSince).not.toBeNull()
    expect(health.apps[0]?.lastError?.message).toBeTruthy()
    expect(health.apps[1]).toMatchObject({ calls: 0, successRate: null, skippedSince: null })
  })

  it('a late answer counts as a success and refreshes the cache (#1524)', async () => {
    const store = memoryStore()
    const lands: Array<() => void> = []
    const late = mockProvider('rapidshyp', {
      quoteOptions: () =>
        new Promise<RateOption[]>((resolve) => lands.push(() => resolve([opt('S', 6000)]))),
    })
    let clock = 1_000_000
    const now = () => clock
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      const [a] = await gatherProviderAnswers([late], QUERY, {
        storeId: 's1',
        cache: store,
        deadlineMs: 5,
        now,
      })
      // Past the deadline: failed the first time, the stale cached answer after that.
      expect(a?.source === 'live' ? a.status : 'cache').toBe(i === 0 ? 'failed' : 'cache')
      clock += 1900 // RapidShyp's ~2 s
      for (const land of lands.splice(0)) land()
      await flush()
      clock += DELIVERY_QUOTE_FRESH_MS + 1 // stale again: the next shopper asks live
    }
    const health = await deliveryHealth(store, 's1', ['rapidshyp'], clock)
    expect(health.apps[0]).toMatchObject({ calls: 3, successRate: 1, skippedSince: null })
    expect(health.apps[0]?.typicalMs).toBe(1900)
    // Never skipped, and the late answer refreshed the cache for the next shopper.
    clock -= DELIVERY_QUOTE_FRESH_MS + 1
    const [next] = await gatherProviderAnswers([late], QUERY, { storeId: 's1', cache: store, now })
    expect(next).toMatchObject({ status: 'ok', source: 'cache', stale: false })
  })

  it('a call that ends in an error after the deadline still counts as a failure', async () => {
    const store = memoryStore()
    const fails: Array<() => void> = []
    const hung = mockProvider('rapidshyp', {
      quoteOptions: () =>
        new Promise<RateOption[]>((_, reject) =>
          fails.push(() => reject(new Error('The operation timed out'))),
        ),
      checkServiceability: () =>
        new Promise((_, reject) => fails.push(() => reject(new Error('The operation timed out')))),
    })
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      await gatherProviderAnswers([hung], QUERY, { storeId: 's1', cache: store, deadlineMs: 5 })
      for (const fail of fails.splice(0)) fail()
      await flush()
    }
    const [a] = await gatherProviderAnswers([hung], QUERY, { storeId: 's1', cache: store })
    expect(a?.error).toMatch(/^Skipped since/)
  })

  it('a call still running after the deadline is not counted yet', async () => {
    const store = memoryStore()
    const slow = mockProvider('rapidshyp', {
      quoteOptions: () => new Promise<RateOption[]>(() => undefined),
      checkServiceability: () => new Promise(() => undefined),
    })
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      await gatherProviderAnswers([slow], QUERY, { storeId: 's1', cache: store, deadlineMs: 5 })
      await flush()
    }
    const [a] = await gatherProviderAnswers([slow], QUERY, {
      storeId: 's1',
      cache: store,
      deadlineMs: 5,
    })
    expect(a?.error).toMatch(/No answer within 5 ms/)
    expect((await deliveryHealth(store, 's1', ['rapidshyp'])).apps[0]?.calls).toBe(0)
  })

  it('a store without counters has no breaker', async () => {
    const plain = memoryStore()
    const store: HealthStore = { get: plain.get, set: plain.set }
    const calls = { n: 0 }
    const p = broken(calls)
    for (let i = 0; i < 4; i++)
      await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store })
    expect(calls.n).toBe(4)
  })
})

describe('stale-while-revalidate', () => {
  it('a fresh answer is used without asking; a stale one is asked again live', async () => {
    const store = memoryStore()
    let clock = 1_000_000
    const now = () => clock
    const quoteOptions = vi.fn(async () => [opt('S', 6000)])
    const p = mockProvider('delhivery', { quoteOptions })
    await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    await flush()
    const [fresh] = await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    expect(fresh).toMatchObject({ source: 'cache', stale: false })
    expect(quoteOptions).toHaveBeenCalledTimes(1)
    clock += DELIVERY_QUOTE_FRESH_MS + 1
    const [again] = await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    expect(again).toMatchObject({ source: 'live', status: 'ok' })
    expect(quoteOptions).toHaveBeenCalledTimes(2)
  })

  it('a stale answer stands in when the live call misses, and the late answer refreshes it', async () => {
    const store = memoryStore()
    let clock = 1_000_000
    const now = () => clock
    let price = 6000
    let land: () => void = () => undefined
    let slow = false
    const p = mockProvider('delhivery', {
      quoteOptions: () =>
        slow
          ? new Promise<RateOption[]>((resolve) => {
              land = () => resolve([opt('S', price)])
            })
          : Promise.resolve([opt('S', price)]),
    })
    await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    await flush()
    clock += DELIVERY_QUOTE_FRESH_MS + 1
    slow = true
    price = 7000
    const [a] = await gatherProviderAnswers([p], QUERY, {
      storeId: 's1',
      cache: store,
      now,
      deadlineMs: 5,
    })
    expect(a).toMatchObject({ status: 'ok', source: 'cache', stale: true })
    expect(a?.services[0]?.pricePaise).toBe(6000)
    expect(a?.error).toMatch(/No answer within 5 ms/)
    land()
    await flush()
    slow = false
    const [b] = await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    expect(b).toMatchObject({ source: 'cache', stale: false })
    expect(b?.services[0]?.pricePaise).toBe(7000)
  })

  it('cache-only takes a stale answer and never calls a courier', async () => {
    const store = memoryStore()
    let clock = 1_000_000
    const now = () => clock
    const quoteOptions = vi.fn(async () => [opt('S', 6000)])
    const p = mockProvider('delhivery', { quoteOptions })
    await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    await flush()
    clock += DELIVERY_QUOTE_FRESH_MS * 10
    const [a] = await gatherProviderAnswers([p], QUERY, {
      storeId: 's1',
      cache: store,
      now,
      cacheOnly: true,
    })
    expect(a).toMatchObject({ status: 'ok', source: 'cache', stale: true })
    expect(quoteOptions).toHaveBeenCalledTimes(1)
  })

  it('an open breaker serves the stale answer', async () => {
    const store = memoryStore()
    let clock = 1_000_000
    const now = () => clock
    let fail = false
    const p = mockProvider('shiprocket', {
      quoteOptions: async () => {
        if (fail) throw new Error('ECONNRESET')
        return [opt('7', 8000)]
      },
      checkServiceability: async () => {
        if (fail) throw new Error('ECONNRESET')
        return {
          provider: 'shiprocket',
          serviceable: true,
          codAvailable: true,
          prepaidAvailable: true,
          minTransitDays: null,
          maxTransitDays: null,
          reason: null,
        }
      },
    })
    await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    await flush()
    clock += DELIVERY_QUOTE_FRESH_MS + 1
    fail = true
    for (let i = 0; i < BREAKER_FAILURES; i++) {
      const [a] = await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
      expect(a).toMatchObject({ status: 'ok', stale: true })
      await flush()
    }
    const [skipped] = await gatherProviderAnswers([p], QUERY, { storeId: 's1', cache: store, now })
    expect(skipped).toMatchObject({ status: 'ok', source: 'cache', stale: true })
    expect(skipped?.error).toMatch(/^Skipped since/)
  })
})

describe('health line and backup share', () => {
  it('reports success rate, median latency and the latest error', async () => {
    const store = memoryStore()
    const at = Date.now()
    await recordCourierCall(store, 's1', 'delhivery', { at, ok: true, ms: 300, error: null })
    await recordCourierCall(store, 's1', 'delhivery', { at, ok: true, ms: 500, error: null })
    await recordCourierCall(store, 's1', 'delhivery', { at, ok: false, ms: null, error: 'late' })
    await recordCourierCall(store, 's1', 'delhivery', { at, ok: true, ms: 400, error: null })
    const health = await deliveryHealth(store, 's1', ['delhivery'], at)
    expect(health.apps[0]).toMatchObject({
      calls: 4,
      successRate: 0.75,
      typicalMs: 400,
      lastError: { message: 'late' },
      skippedSince: null,
    })
  })

  it('counts checkouts and the ones that fell back to the zone rate', async () => {
    const store = memoryStore()
    const now = Date.now()
    const backup = { status: 'options' as const, options: [{ source: 'backup' as const }] }
    const live = { status: 'options' as const, options: [{ source: 'live' as const }] }
    const none = { status: 'none' as const, options: [] }
    expect(onBackup(backup as never)).toBe(true)
    expect(onBackup(none)).toBe(true)
    expect(onBackup(live as never)).toBe(false)
    await recordCheckoutQuote(store, 's1', backup as never, now)
    await recordCheckoutQuote(store, 's1', live as never, now)
    await recordCheckoutQuote(store, 's1', live as never, now - 3 * 3_600_000)
    await recordCheckoutQuote(store, 's1', none, now - 30 * 3_600_000) // older than a day
    const health = await deliveryHealth(store, 's1', [], now)
    expect(health).toMatchObject({ checkouts24h: 3, backup24h: 1 })
  })
})

describe('shipping margin', () => {
  const delivery = { courierCostPaise: 9000, insured: true, insurancePaise: 1500 }

  it('uses the booking charge once there is one, else the checkout quote', () => {
    expect(shippingMargin(delivery, 15000, null)).toEqual({
      chargedPaise: 15000,
      courierPaise: 9000,
      courierFrom: 'quote',
      insurancePaise: 1500,
      marginPaise: 4500,
    })
    expect(shippingMargin(delivery, 15000, 14000)).toMatchObject({
      courierFrom: 'booking',
      marginPaise: -500,
    })
  })

  it('has no margin on a backup order until it is booked, and no insurance when not insured', () => {
    const backup = { courierCostPaise: null, insured: false, insurancePaise: null }
    expect(shippingMargin(backup, 8000, null)).toMatchObject({
      courierPaise: null,
      courierFrom: null,
      marginPaise: null,
    })
    expect(shippingMargin(backup, 8000, 6000)).toMatchObject({
      insurancePaise: 0,
      marginPaise: 2000,
    })
  })

  it('a split cart adds up every parcel’s courier and insurance', () => {
    const parcel = (id: string | undefined, cost: number | null, insurance: number | null) => ({
      ...(id ? { fulfillmentOrderId: id } : {}),
      locationId: `loc-${id}`,
      onHold: false,
      route: null,
      insured: insurance !== null,
      insurancePaise: insurance,
      markupPaise: 0,
      courierCostPaise: cost,
      promisedEarliest: null,
      promisedLatest: null,
    })
    // The order-level fields are the first parcel's; the margin must not stop there.
    const split = {
      ...delivery,
      parcels: [parcel('fo-1', 9000, 1500), parcel('fo-2', 6000, null)],
    }
    expect(shippingMargin(split, 20000, null)).toEqual({
      chargedPaise: 20000,
      courierPaise: 15000,
      courierFrom: 'quote',
      insurancePaise: 1500,
      marginPaise: 3500,
    })
    // One parcel booked: its own charge replaces its quote; the order's latest charge is ignored.
    expect(shippingMargin(split, 20000, 99999, { 'fo-2': 7000 })).toMatchObject({
      courierPaise: 16000,
      courierFrom: 'mixed',
      marginPaise: 2500,
    })
    expect(shippingMargin(split, 20000, null, { 'fo-1': 8000, 'fo-2': 7000 })).toMatchObject({
      courierFrom: 'booking',
      marginPaise: 3500,
    })
    // A parcel with no cost known yet: no margin until it is.
    const unknown = {
      ...split,
      parcels: [parcel('fo-1', 9000, 1500), parcel(undefined, null, null)],
    }
    expect(shippingMargin(unknown, 20000, null)).toMatchObject({
      courierPaise: null,
      marginPaise: null,
    })
  })
})
