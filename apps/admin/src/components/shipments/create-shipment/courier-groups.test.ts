import type { CourierRateRow } from '@commerce/core'
import { describe, expect, test } from 'vitest'
import { courierInitials, courierMode, groupCounts, sortCourierRows } from './courier-groups'
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
  test('before noon in India it starts today at 14:00 and is ready', () => {
    // 11:30 IST.
    const now = new Date('2026-10-15T06:00:00Z')
    const plan = startingPickupPlan(now)
    expect(plan.date).toBe(pickupDayKey(0, now))
    expect(plan.date).toBe('2026-10-15')
    expect(plan.timeFrom).toBe('14:00')
    expect(pickupReady(plan)).toBe(true)
  })

  test('from noon in India it starts tomorrow', () => {
    // 12:00 IST exactly, and 23:50 IST.
    expect(startingPickupPlan(new Date('2026-10-15T06:30:00Z')).date).toBe('2026-10-16')
    expect(startingPickupPlan(new Date('2026-10-15T18:20:00Z')).date).toBe('2026-10-16')
    // 00:10 IST on the 16th (still the 15th in UTC): before noon, so today, the 16th.
    expect(startingPickupPlan(new Date('2026-10-15T18:40:00Z')).date).toBe('2026-10-16')
  })

  test('a malformed time is not ready', () => {
    expect(pickupReady({ ask: true, date: '2026-10-16', timeFrom: '2pm' })).toBe(false)
  })
})

describe('courierMode and sortCourierRows (the drawer tabs and Sort)', () => {
  const priced = (
    label: string,
    price: number | null,
    by: string | null,
    extra: Partial<CourierRateRow> = {},
  ) => ({
    ...row('RapidShyp', label),
    pricePaise: price,
    deliveryBy: by,
    ...extra,
  })

  test('air, express and priority services fly; the rest go by surface', () => {
    expect(courierMode(priced('Delhivery Air (RapidShyp)', 1, null))).toBe('air')
    expect(courierMode(priced('Delhivery Express', 1, null))).toBe('air')
    expect(courierMode(priced('Ekart Surface (RapidShyp)', 1, null))).toBe('surface')
  })

  test('cheapest and fastest sort; a courier that cannot take it sinks to the bottom', () => {
    const rows = [
      priced('A', 30000, '2026-11-20'),
      priced('B', 10000, '2026-11-25'),
      priced('C', 5000, '2026-11-15', { problem: 'not_serviceable' }),
      priced('D', 20000, '2026-11-16', { badges: ['recommended'] }),
    ]
    expect(sortCourierRows(rows, 'cheapest').map((r) => r.providerLabel)).toEqual([
      'B',
      'D',
      'A',
      'C',
    ])
    expect(sortCourierRows(rows, 'fastest').map((r) => r.providerLabel)).toEqual([
      'D',
      'A',
      'B',
      'C',
    ])
    expect(sortCourierRows(rows, 'recommended').map((r) => r.providerLabel)).toEqual([
      'D',
      'A',
      'B',
      'C',
    ])
  })
})
