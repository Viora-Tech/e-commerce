import type { DeliveryEstimate, ShippingPolicy } from '@commerce/shipping'
import { describe, expect, it } from 'vitest'
import { arrivalLabel, fastestRate, type RateWindow, rateWindow } from './rate-dates'

// Saturday 10 Oct 2026, 09:00 IST: before the 14:00 cutoff, so it dispatches today.
const now = new Date('2026-10-10T03:30:00Z')
const policy: ShippingPolicy = {
  workingDays: [1, 2, 3, 4, 5, 6],
  deliveryDays: [1, 2, 3, 4, 5, 6],
  holidays: [],
  cutoff: '14:00',
  timeZone: 'Asia/Kolkata',
  originPincode: '110001',
  defaultMinTransitDays: 3,
  defaultMaxTransitDays: 5,
  codAllowed: true,
}
const courier: DeliveryEstimate = {
  ok: true,
  serviceable: true,
  pincode: '302001',
  codAvailable: true,
  dateRange: 'Tue, 14 Oct',
  earliestDate: '2026-10-14',
  latestDate: '2026-10-14',
  dispatchDate: '2026-10-10',
  dispatchLabel: 'Sat, 10 Oct',
  dispatchesToday: true,
  fallback: false,
  provider: 'delhivery',
}
const noDays = { minTransitDays: null, maxTransitDays: null }
const express = { minTransitDays: 1, maxTransitDays: 1 }

describe('rateWindow', () => {
  it('dates the standard option by the courier, even when it has days of its own', () => {
    expect(
      rateWindow({
        rate: { minTransitDays: 2, maxTransitDays: 3 },
        standard: true,
        delivery: courier,
        policy,
        now,
      }),
    ).toEqual({ earliest: '2026-10-14', latest: '2026-10-14', source: 'courier' })
  })

  it('dates an option without days of its own by the courier', () => {
    expect(
      rateWindow({ rate: noDays, standard: false, delivery: courier, policy, now }),
    ).toMatchObject({
      source: 'courier',
    })
  })

  it('keeps an express option to its own days', () => {
    // Dispatched Sat 10 Oct, one delivery day later (no Sunday deliveries): Mon 12 Oct.
    expect(rateWindow({ rate: express, standard: false, delivery: courier, policy, now })).toEqual({
      earliest: '2026-10-12',
      latest: '2026-10-12',
      source: 'rate',
    })
  })

  it('falls back to the option days, then the store defaults, without a courier answer', () => {
    const fallback = {
      ...courier,
      fallback: true,
      earliestDate: '2026-10-13',
      latestDate: '2026-10-15',
    }
    expect(
      rateWindow({ rate: express, standard: true, delivery: fallback, policy, now })?.source,
    ).toBe('rate')
    expect(rateWindow({ rate: noDays, standard: true, delivery: fallback, policy, now })).toEqual({
      earliest: '2026-10-13',
      latest: '2026-10-15',
      source: 'policy',
    })
  })

  it('has no window where the courier does not deliver', () => {
    const no: DeliveryEstimate = { ok: true, serviceable: false, pincode: '744101', reason: 'No' }
    expect(rateWindow({ rate: express, standard: true, delivery: no, policy, now })).toBeNull()
  })
})

describe('arrivalLabel', () => {
  const at = (earliest: string, latest = earliest): RateWindow => ({
    earliest,
    latest,
    source: 'courier',
  })

  it('says today and tomorrow in the store time zone', () => {
    expect(arrivalLabel(at('2026-10-10'), now, 'Asia/Kolkata')).toBe('Arrives today')
    expect(arrivalLabel(at('2026-10-11'), now, 'Asia/Kolkata')).toBe(
      'Arrives tomorrow, Sun, 11 Oct',
    )
    // 20:00 UTC on the 10th is already the 11th in India.
    const lateUtc = new Date('2026-10-10T20:00:00Z')
    expect(arrivalLabel(at('2026-10-12'), lateUtc, 'Asia/Kolkata')).toBe(
      'Arrives tomorrow, Mon, 12 Oct',
    )
  })

  it('names a later date, or the range', () => {
    expect(arrivalLabel(at('2026-10-14'), now, 'Asia/Kolkata')).toBe('Arrives Wed, 14 Oct')
    expect(arrivalLabel(at('2026-10-14', '2026-10-16'), now, 'Asia/Kolkata')).toBe(
      'Arrives Wed, 14 Oct - Fri, 16 Oct',
    )
  })
})

describe('fastestRate', () => {
  it('flags the option that arrives first, only when they differ', () => {
    const slow = {
      id: 's',
      window: { earliest: '2026-10-14', latest: '2026-10-16', source: 'courier' as const },
    }
    const fast = {
      id: 'f',
      window: { earliest: '2026-10-12', latest: '2026-10-12', source: 'rate' as const },
    }
    expect(fastestRate([slow, fast])?.id).toBe('f')
    expect(fastestRate([slow, { ...slow, id: 't' }])).toBeNull()
    expect(fastestRate([slow])).toBeNull()
    expect(fastestRate([slow, { id: 'x', window: null }])).toBeNull()
  })
})
