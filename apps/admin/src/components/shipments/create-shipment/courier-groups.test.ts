import type { CourierRateRow } from '@commerce/core'
import { describe, expect, test } from 'vitest'
import { courierGroup, courierInitials, groupCounts } from './courier-groups'
import { pickupDayKey, pickupReady, startingPickupPlan } from './pickup-plan'

const row = (providerLabel: string): CourierRateRow => ({
  providerId: providerLabel,
  providerLabel,
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

describe('courierGroup', () => {
  test('reads the aggregator after "via", else the courier before the dot', () => {
    expect(courierGroup('Xpressbees · Surface via Shiprocket')).toBe('Shiprocket')
    expect(courierGroup('Shadowfax via RapidShyp')).toBe('RapidShyp')
    expect(courierGroup('Delhivery · Express')).toBe('Delhivery')
    expect(courierGroup('Blue Dart')).toBe('Blue Dart')
  })

  test('counts rows per group in first-seen order', () => {
    const groups = groupCounts([
      row('Delhivery · Surface'),
      row('Xpressbees via Shiprocket'),
      row('Delhivery · Express'),
    ])
    expect(groups).toEqual([
      { group: 'Delhivery', count: 2 },
      { group: 'Shiprocket', count: 1 },
    ])
  })
})

describe('courierInitials', () => {
  test('two words give their initials, one word its first two letters', () => {
    expect(courierInitials('Blue Dart · Apex (your account)')).toBe('BD')
    expect(courierInitials('Delhivery · Surface')).toBe('DE')
    expect(courierInitials('Shadowfax via RapidShyp')).toBe('SH')
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
