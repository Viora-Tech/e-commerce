import { describe, expect, it } from 'vitest'
import {
  dayKey,
  dayStart,
  formatInZone,
  IST_OFFSET_MS,
  startOfDay,
  startOfMonth,
  wallClock,
  zoneOffsetMs,
} from '../src/index'

// 2026-09-30 20:00 UTC is 1 Oct 01:30 in India.
const lateUtc = new Date('2026-09-30T20:00:00.000Z')

describe('store-timezone day maths', () => {
  it('uses the fixed IST offset by default', () => {
    expect(IST_OFFSET_MS).toBe(5.5 * 3_600_000)
    expect(zoneOffsetMs(lateUtc)).toBe(IST_OFFSET_MS)
    expect(wallClock(lateUtc).getUTCHours()).toBe(1)
  })

  it('works out other zones from Intl', () => {
    expect(zoneOffsetMs(lateUtc, 'UTC')).toBe(0)
    expect(zoneOffsetMs(new Date('2026-01-15T12:00:00Z'), 'America/New_York')).toBe(-5 * 3_600_000)
  })

  it('keys and bounds the day in the store zone, not UTC', () => {
    expect(dayKey(lateUtc)).toBe('2026-10-01')
    expect(dayKey(lateUtc, 'UTC')).toBe('2026-09-30')
    expect(startOfDay(lateUtc).toISOString()).toBe('2026-09-30T18:30:00.000Z')
    expect(startOfDay(lateUtc, undefined, 1).toISOString()).toBe('2026-10-01T18:30:00.000Z')
    expect(dayStart('2026-10-01').toISOString()).toBe('2026-09-30T18:30:00.000Z')
  })

  it('bounds the month in the store zone', () => {
    expect(startOfMonth(lateUtc).toISOString()).toBe('2026-09-30T18:30:00.000Z')
    expect(startOfMonth(lateUtc, undefined, -1).toISOString()).toBe('2026-08-31T18:30:00.000Z')
  })
})

describe('formatInZone', () => {
  it('pins the zone so server and browser agree', () => {
    expect(formatInZone(lateUtc, { day: 'numeric', month: 'short' })).toBe('1 Oct')
    expect(formatInZone(lateUtc, { day: 'numeric', month: 'short' }, { timeZone: 'UTC' })).toBe(
      '30 Sept',
    )
  })
})
