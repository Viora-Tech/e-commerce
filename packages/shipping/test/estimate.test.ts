import { describe, expect, it } from 'vitest'
import { CourierError, courierFetch } from '../src/courier-error'
import { estimateDelivery, type ShippingPolicy } from '../src/estimate'
import { FakeShippingProvider, fakeShippingFactory } from '../src/fake'
import { parsePincode } from '../src/pincode'
import { ShippingRegistry } from '../src/registry'
import { describeShippingProvider } from '../src/testing'
import type { Serviceability } from '../src/types'

const policy: ShippingPolicy = {
  originPincode: '131028',
  workingDays: [1, 2, 3, 4, 5, 6],
  deliveryDays: [1, 2, 3, 4, 5, 6, 7],
  holidays: [],
  cutoff: '14:00',
  timeZone: 'Asia/Kolkata',
  defaultMinTransitDays: 3,
  defaultMaxTransitDays: 5,
  codAllowed: true,
}

const monday10 = new Date('2026-09-21T10:00:00+05:30')

const answer = (over: Partial<Serviceability>): Serviceability => ({
  provider: 'stub',
  serviceable: true,
  codAvailable: true,
  prepaidAvailable: true,
  minTransitDays: 2,
  maxTransitDays: 2,
  reason: null,
  ...over,
})

describe('parsePincode', () => {
  it('accepts what customers actually type', () => {
    expect(parsePincode('110 001')).toEqual({ ok: true, pincode: '110001' })
    expect(parsePincode('110-001')).toEqual({ ok: true, pincode: '110001' })
  })
  it('rejects leading zeros and wrong lengths with a reason code', () => {
    expect(parsePincode('012345')).toMatchObject({ ok: false, reason: 'leading_zero' })
    expect(parsePincode('1234')).toMatchObject({ ok: false, reason: 'not_six_digits' })
    expect(parsePincode(undefined)).toMatchObject({ ok: false, reason: 'missing' })
  })
})

describe('estimateDelivery', () => {
  it('uses the courier transit time when it answers', async () => {
    const r = await estimateDelivery({
      pincode: '560001',
      policy,
      provider: { id: 'stub', checkServiceability: async () => answer({}) },
      now: monday10,
    })
    expect(r).toMatchObject({
      ok: true,
      serviceable: true,
      earliestDate: '2026-09-23',
      fallback: false,
    })
  })

  it('falls back to configured days when the courier fails, and says so', async () => {
    const r = await estimateDelivery({
      pincode: '560001',
      policy,
      provider: {
        id: 'stub',
        checkServiceability: async () => {
          throw new CourierError('timeout', 'stub', 'slow')
        },
      },
      now: monday10,
    })
    expect(r).toMatchObject({
      ok: true,
      serviceable: true,
      earliestDate: '2026-09-24',
      fallback: true,
    })
  })

  it('returns unserviceable when the courier says no', async () => {
    const r = await estimateDelivery({
      pincode: '560001',
      policy,
      provider: {
        id: 'stub',
        checkServiceability: async () => answer({ serviceable: false, reason: 'nope' }),
      },
      now: monday10,
    })
    expect(r).toEqual({ ok: true, serviceable: false, pincode: '560001', reason: 'nope' })
  })

  it('COD needs both the merchant and the courier to say yes', async () => {
    const noCourier = await estimateDelivery({
      pincode: '560001',
      policy,
      provider: { id: 'stub', checkServiceability: async () => answer({ codAvailable: false }) },
      now: monday10,
    })
    const noMerchant = await estimateDelivery({
      pincode: '560001',
      policy: { ...policy, codAllowed: false },
      provider: { id: 'stub', checkServiceability: async () => answer({}) },
      now: monday10,
    })
    expect(noCourier).toMatchObject({ codAvailable: false })
    expect(noMerchant).toMatchObject({ codAvailable: false })
  })

  it('prefers a cached lookup and never calls the courier', async () => {
    let calls = 0
    const r = await estimateDelivery({
      pincode: '560001',
      policy,
      provider: {
        id: 'stub',
        checkServiceability: async () => {
          calls += 1
          return answer({})
        },
      },
      cached: answer({ minTransitDays: 1, maxTransitDays: 1 }),
      now: monday10,
    })
    expect(calls).toBe(0)
    expect(r).toMatchObject({ earliestDate: '2026-09-22' })
  })

  it('rejects a bad pincode before touching the courier', async () => {
    const r = await estimateDelivery({ pincode: '12', policy, provider: null, now: monday10 })
    expect(r).toMatchObject({ ok: false })
  })
})

describe('courierFetch', () => {
  const respond = (status: number) => async () => new Response('{}', { status })

  it('maps auth, rate limit and other statuses to CourierError kinds', async () => {
    await expect(courierFetch('x', 'http://t', { fetchImpl: respond(401) })).rejects.toMatchObject({
      kind: 'auth',
    })
    await expect(courierFetch('x', 'http://t', { fetchImpl: respond(429) })).rejects.toMatchObject({
      kind: 'rate_limited',
    })
    await expect(courierFetch('x', 'http://t', { fetchImpl: respond(500) })).rejects.toMatchObject({
      kind: 'unavailable',
    })
  })

  it('maps a timeout', async () => {
    const hang: typeof fetch = (_u, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () =>
          reject(Object.assign(new Error('t'), { name: 'TimeoutError' })),
        )
      })
    await expect(
      courierFetch('x', 'http://t', { fetchImpl: hang, timeoutMs: 10 }),
    ).rejects.toMatchObject({ kind: 'timeout' })
  })
})

describe('registry and fake provider', () => {
  it('creates a provider from a registered factory', () => {
    const reg = new ShippingRegistry().register(fakeShippingFactory)
    expect(reg.ids()).toEqual(['fake'])
    const r = reg.create('fake', {})
    expect(r.ok && r.provider.id).toBe('fake')
    expect(reg.create('nope', {})).toMatchObject({ ok: false })
  })

  it('is deterministic and walks a shipment through its stages', async () => {
    let t = 0
    const p = new FakeShippingProvider(() => t)
    const a = await p.checkServiceability({ originPincode: '131028', destinationPincode: '110001' })
    const b = await p.checkServiceability({ originPincode: '131028', destinationPincode: '110001' })
    expect(a).toEqual(b)
    const { waybill } = await p.createShipment({
      orderId: 'o',
      orderNumber: 7,
      to: { name: '', line1: '', city: '', state: '', pincode: '110001', country: 'IN', phone: '' },
      from: {
        name: '',
        line1: '',
        city: '',
        state: '',
        pincode: '131028',
        country: 'IN',
        phone: '',
      },
      lines: [],
      paymentMode: 'prepaid',
      codAmountPaise: 0,
      valuePaise: 0,
      weightGrams: 500,
    })
    expect((await p.track(waybill)).status).toBe('created')
    t = 3 * 24 * 3_600_000
    expect((await p.track(waybill)).status).toBe('delivered')
  })
})

describeShippingProvider('fake', { create: () => new FakeShippingProvider() })
