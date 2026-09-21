import { describe, expect, it } from 'vitest'
import {
  addWorkingDays,
  buildTrack,
  computeDeliveryEstimate,
  type DispatchPolicy,
  formatDeliveryRange,
  ImpossibleCalendarError,
  isCivilDate,
  isoWeekday,
  nextWorkingDay,
  parseCutoff,
  zonedNow,
} from '../src/delivery-date'

/** Mon-Sat warehouse, couriers deliver every day, 14:00 IST cutoff. */
const policy: DispatchPolicy = {
  workingDays: [1, 2, 3, 4, 5, 6],
  deliveryDays: [1, 2, 3, 4, 5, 6, 7],
  holidays: ['2026-10-20', '01-26'],
  cutoff: '14:00',
  timeZone: 'Asia/Kolkata',
}

/** 2026-09-21 is a Monday. */
const ist = (date: string, time: string) => new Date(`${date}T${time}:00+05:30`)

describe('civil date primitives', () => {
  it('rejects dates that do not exist', () => {
    expect(isCivilDate('2026-02-31')).toBe(false)
    expect(isCivilDate('2026-02-28')).toBe(true)
    expect(isCivilDate(20260228)).toBe(false)
  })

  it('computes ISO weekdays', () => {
    expect(isoWeekday('2026-09-21')).toBe(1)
    expect(isoWeekday('2026-09-27')).toBe(7)
  })

  it('parses cutoffs and rejects nonsense', () => {
    expect(parseCutoff('14:00')).toBe(840)
    expect(() => parseCutoff('25:00')).toThrow(TypeError)
    expect(() => parseCutoff('2pm')).toThrow(TypeError)
  })
})

describe('zonedNow', () => {
  it('uses the civil date in the shop zone, not the server zone', () => {
    // 22:30 IST Monday is 17:00 UTC Monday; 01:00 IST Tuesday is 19:30 UTC Monday.
    expect(zonedNow(ist('2026-09-21', '22:30'), 'Asia/Kolkata')).toEqual({
      date: '2026-09-21',
      minutesSinceMidnight: 22 * 60 + 30,
    })
    expect(zonedNow(ist('2026-09-22', '01:00'), 'Asia/Kolkata')).toEqual({
      date: '2026-09-22',
      minutesSinceMidnight: 60,
    })
  })

  it('renders midnight as hour 0, not 24', () => {
    expect(zonedNow(ist('2026-09-22', '00:05'), 'Asia/Kolkata').minutesSinceMidnight).toBe(5)
  })
})

describe('working-day calendar', () => {
  it('skips Sundays and holidays, including recurring ones', () => {
    expect(nextWorkingDay('2026-09-26', policy)).toBe('2026-09-28') // Sat -> Mon
    expect(nextWorkingDay('2026-10-19', policy)).toBe('2026-10-21') // Diwali-ish holiday
    expect(nextWorkingDay('2027-01-25', policy)).toBe('2027-01-27') // Republic Day every year
  })

  it('adds working days', () => {
    expect(addWorkingDays('2026-09-25', 2, policy)).toBe('2026-09-28') // Fri +2 = Sat, Mon
    expect(() => addWorkingDays('2026-09-25', -1, policy)).toThrow(TypeError)
  })

  it('refuses a calendar with no working days', () => {
    expect(() => nextWorkingDay('2026-09-21', { workingDays: [], holidays: [] })).toThrow(
      ImpossibleCalendarError,
    )
  })
})

describe('computeDeliveryEstimate', () => {
  it('dispatches today before the cutoff and counts transit on delivery days', () => {
    const r = computeDeliveryEstimate({
      now: ist('2026-09-21', '10:00'),
      minTransitDays: 2,
      maxTransitDays: 4,
      policy,
    })
    expect(r.dispatchesToday).toBe(true)
    expect(r.dispatchDate).toBe('2026-09-21')
    expect(r.earliestDate).toBe('2026-09-23')
    expect(r.latestDate).toBe('2026-09-25')
    expect(r.minDays).toBe(2)
    expect(r.maxDays).toBe(4)
  })

  it('does not dispatch at the cutoff minute exactly', () => {
    const r = computeDeliveryEstimate({
      now: ist('2026-09-21', '14:00'),
      minTransitDays: 1,
      maxTransitDays: 1,
      policy,
    })
    expect(r.dispatchesToday).toBe(false)
    expect(r.dispatchDate).toBe('2026-09-22')
  })

  it('rolls a Saturday-evening order to Monday dispatch, and still delivers across Sunday', () => {
    const r = computeDeliveryEstimate({
      now: ist('2026-09-26', '18:00'),
      minTransitDays: 1,
      maxTransitDays: 1,
      policy,
    })
    expect(r.dispatchDate).toBe('2026-09-28')
    expect(r.earliestDate).toBe('2026-09-29')
  })

  it('treats a zero transit time as next day and normalises swapped bounds', () => {
    const r = computeDeliveryEstimate({
      now: ist('2026-09-21', '10:00'),
      minTransitDays: 3,
      maxTransitDays: 0,
      policy,
    })
    expect(r.earliestDate).toBe('2026-09-22')
    expect(r.latestDate).toBe('2026-09-24')
  })

  it('falls back to the dispatch week when deliveryDays is unset', () => {
    const { deliveryDays: _drop, ...noDelivery } = policy
    const r = computeDeliveryEstimate({
      now: ist('2026-09-25', '10:00'), // Friday
      minTransitDays: 2,
      maxTransitDays: 2,
      policy: noDelivery,
    })
    expect(r.earliestDate).toBe('2026-09-28') // Sat, Mon (Sunday skipped)
  })
})

describe('formatting and track', () => {
  it('formats a range and collapses equal ends', () => {
    expect(formatDeliveryRange('2026-09-23', '2026-09-25')).toBe('Wed, 23 Sept - Fri, 25 Sept')
    expect(formatDeliveryRange('2026-09-23', '2026-09-23')).toBe('Wed, 23 Sept')
  })

  it('builds a bounded track marking working days', () => {
    const t = buildTrack('2026-09-25', '2026-09-28', policy)
    expect(t.map((d) => d.w)).toEqual([true, true, false, true])
    expect(buildTrack('2026-09-28', '2026-09-25', policy)).toEqual([])
  })
})
