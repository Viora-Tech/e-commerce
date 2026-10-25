import type { CourierRateRow } from '@commerce/core'
import { describe, expect, test } from 'vitest'
import { courierInitials, groupCounts } from './courier-groups'
import { pickupDayKey, pickupReady, startingPickupPlan } from './pickup-plan'

const row = (providerName: string, providerLabel = providerName): CourierRateRow => ({
  optionKey: providerLabel,
  providerId: providerName.toLowerCase(),
  providerName,
  providerLabel,
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
})

describe('groupCounts', () => {
  test('groups rows by the connected courier, aggregator carriers under the aggregator', () => {
    const groups = groupCounts([
      row('Delhivery', 'Delhivery Surface'),
      row('Shiprocket', 'Xpressbees Surface (Shiprocket)'),
      row('Delhivery', 'Delhivery Express'),
    ])
    expect(groups).toEqual([
      { group: 'Delhivery', count: 2 },
      { group: 'Shiprocket', count: 1 },
    ])
  })
})

describe('courierInitials', () => {
  test('the carrier gives the letters, never the aggregator in brackets', () => {
    expect(courierInitials('Blue Dart')).toBe('BD')
    expect(courierInitials('Delhivery Surface (Shiprocket)')).toBe('DS')
    expect(courierInitials('Delhivery')).toBe('DE')
  })
})

describe('pickup plan', () => {
  test('starts tomorrow at 14:00 and is ready', () => {
    const now = new Date('2026-10-15T06:00:00Z')
    const plan = startingPickupPlan(now)
    expect(plan.date).toBe(pickupDayKey(1, now))
    expect(plan.date).toBe('2026-10-16')
    expect(pickupReady(plan)).toBe(true)
  })

  test('a malformed time is not ready', () => {
    expect(pickupReady({ ask: true, date: '2026-10-16', timeFrom: '2pm' })).toBe(false)
  })
})
