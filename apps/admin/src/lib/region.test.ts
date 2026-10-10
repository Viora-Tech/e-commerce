import { describe, expect, it } from 'vitest'
import {
  DEFAULT_REGION,
  orderWeekdays,
  parseRegion,
  regionCookie,
  regionValue,
  weekStartsOn,
} from './region'

describe('region cookie', () => {
  it('round-trips a choice', () => {
    const region = { clock: '24h', weekStart: 'sun' } as const
    expect(parseRegion(regionValue(region))).toEqual(region)
    expect(regionCookie(region)).toMatch(/^admin_region=24h\.sun; path=\//)
    expect(weekStartsOn(region)).toBe(0)
  })

  it('falls back part by part for unknown or missing values', () => {
    expect(parseRegion(undefined)).toEqual(DEFAULT_REGION)
    expect(parseRegion('24h.friday')).toEqual({ clock: '24h', weekStart: 'mon' })
    expect(parseRegion('<script>.sun')).toEqual({ clock: '12h', weekStart: 'sun' })
  })

  it('puts Sunday first only for a Sunday week', () => {
    const days = [1, 2, 3, 4, 5, 6, 7].map((value) => ({ value }))
    expect(orderWeekdays(days, DEFAULT_REGION).map((d) => d.value)).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(orderWeekdays(days, { clock: '12h', weekStart: 'sun' }).map((d) => d.value)).toEqual([
      7, 1, 2, 3, 4, 5, 6,
    ])
  })
})
