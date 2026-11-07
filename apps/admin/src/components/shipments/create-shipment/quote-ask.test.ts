import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type DraftOrder, type PackageForm, packageFor, type ShipmentDraft } from './flow-state'
import { debouncedAsk, quoteAsk } from './quote-ask'

const order: DraftOrder = {
  orderId: 'o1',
  orderNumber: 1042,
  customerName: 'Asha',
  city: 'Guwahati',
  pincode: '781001',
  line1: null,
  line2: null,
  stateCode: 'AS',
  phone: null,
  paymentStatus: 'paid',
  fulfillmentStatus: 'unfulfilled',
  paymentMode: 'prepaid',
  totalPaise: 149900,
  blocked: null,
  parcels: [
    {
      id: 'p1',
      position: 1,
      locationName: 'Jaipur warehouse',
      lines: [
        {
          id: 'l1',
          title: 'Kurta / M',
          quantity: 2,
          imageUrl: null,
          sku: null,
          unitPricePaise: 0,
          weightGrams: null,
        },
      ],
      valuePaise: 149900,
      weightGrams: 700,
      dimensionsCm: null,
      pickupLocationId: 'loc-jaipur',
    },
  ],
}

const draft: ShipmentDraft = {
  couriers: [{ id: 'delhivery', label: 'Delhivery', hasRates: true, hasPickup: true }],
  boxes: [],
  defaultBoxId: null,
  pickupPlaces: [],
  orders: [order],
}

const form = (over: Partial<PackageForm> = {}): PackageForm => ({
  ...packageFor(order, order.parcels[0] as DraftOrder['parcels'][number], draft),
  ...over,
})

describe('quoteAsk', () => {
  it('waits for a weight (and a COD amount on COD)', () => {
    expect(quoteAsk(draft, 'p1', form({ weightGrams: '' })).state).toBe('needs_package')
    expect(quoteAsk(draft, 'p1', form({ weightGrams: '0' })).state).toBe('needs_package')
    expect(quoteAsk(draft, 'p1', form({ paymentMode: 'cod', codAmount: '' })).state).toBe(
      'needs_package',
    )
  })

  it('waits while only part of the box size is typed', () => {
    expect(quoteAsk(draft, 'p1', form({ length: '30', width: '', height: '' })).state).toBe(
      'incomplete',
    )
    expect(quoteAsk(draft, 'p1', form({ length: '30', width: '20', height: 'x' })).state).toBe(
      'incomplete',
    )
  })

  it('asks with no size at all, and with a full one', () => {
    const none = quoteAsk(draft, 'p1', form({ length: '', width: '', height: '' }))
    expect(none.state).toBe('ready')
    const full = quoteAsk(draft, 'p1', form({ length: '30', width: '20', height: '10' }))
    expect(full).toMatchObject({
      state: 'ready',
      request: { weightGrams: 700, dimensionsCm: { length: 30, width: 20, height: 10 } },
    })
  })

  it('gives equal values the same key, so retyping the same number asks nothing new', () => {
    const a = quoteAsk(
      draft,
      'p1',
      form({ weightGrams: '150', length: '30', width: '20', height: '10' }),
    )
    const b = quoteAsk(
      draft,
      'p1',
      form({ weightGrams: '150.0', length: '30', width: '20', height: '10.0' }),
    )
    const c = quoteAsk(
      draft,
      'p1',
      form({ weightGrams: '151', length: '30', width: '20', height: '10' }),
    )
    if (a.state !== 'ready' || b.state !== 'ready' || c.state !== 'ready') throw new Error('ready')
    expect(a.key).toBe(b.key)
    expect(a.key).not.toBe(c.key)
  })
})

describe('debouncedAsk', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks once, after the quiet period', async () => {
    const ask = vi.fn(async () => 'rates')
    const done = debouncedAsk(ask, 600, new AbortController().signal)
    await vi.advanceTimersByTimeAsync(599)
    expect(ask).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(ask).toHaveBeenCalledTimes(1)
    await expect(done).resolves.toBe('rates')
  })

  it('typing again before the delay cancels the ask: the courier is never called', async () => {
    const ask = vi.fn(async () => 'rates')
    const controller = new AbortController()
    const done = debouncedAsk(ask, 600, controller.signal)
    await vi.advanceTimersByTimeAsync(300)
    controller.abort()
    await vi.advanceTimersByTimeAsync(1000)
    expect(ask).not.toHaveBeenCalled()
    await expect(done).resolves.toBeNull()
  })

  it('an answer that arrives after a newer edit is dropped, and the request is aborted', async () => {
    let seen: AbortSignal | null = null
    let answer: (value: string) => void = () => undefined
    const ask = vi.fn(
      (signal: AbortSignal) =>
        new Promise<string>((resolve) => {
          seen = signal
          answer = resolve
        }),
    )
    const controller = new AbortController()
    const done = debouncedAsk(ask, 600, controller.signal)
    await vi.advanceTimersByTimeAsync(600)
    controller.abort()
    answer('stale rates')
    await expect(done).resolves.toBeNull()
    expect((seen as AbortSignal | null)?.aborted).toBe(true)
  })

  it('a failure of a live ask still reaches the caller; one after abort does not', async () => {
    const live = debouncedAsk(
      async () => {
        throw new Error('courier down')
      },
      10,
      new AbortController().signal,
    )
    const settled = live.catch((e: Error) => e.message)
    await vi.advanceTimersByTimeAsync(10)
    await expect(settled).resolves.toBe('courier down')

    const controller = new AbortController()
    const aborted = debouncedAsk(
      async () => {
        controller.abort()
        throw new Error('aborted')
      },
      10,
      controller.signal,
    )
    await vi.advanceTimersByTimeAsync(10)
    await expect(aborted).resolves.toBeNull()
  })
})
