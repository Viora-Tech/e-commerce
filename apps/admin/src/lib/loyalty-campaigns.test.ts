import { describe, expect, it } from 'vitest'
import {
  campaignStatus,
  multiplierBpFrom,
  multiplierLabel,
  nowOffset,
  timelineBars,
  timelineWeeks,
  weekStart,
} from './loyalty-campaigns'

const now = new Date('2026-11-25T06:00:00Z') // Wednesday 25 Nov, 11:30 IST

describe('campaign status', () => {
  const c = (startsAt: string, endsAt: string, active = true) => ({
    id: 'c',
    startsAt,
    endsAt,
    active,
  })

  it('is scheduled, running or ended by its window', () => {
    expect(campaignStatus(c('2026-11-26T00:00:00Z', '2026-11-30T00:00:00Z'), now)).toBe('scheduled')
    expect(campaignStatus(c('2026-11-20T00:00:00Z', '2026-11-30T00:00:00Z'), now)).toBe('running')
    expect(campaignStatus(c('2026-11-01T00:00:00Z', '2026-11-10T00:00:00Z'), now)).toBe('ended')
  })

  it('is ended once switched off', () => {
    expect(campaignStatus(c('2026-11-20T00:00:00Z', '2026-11-30T00:00:00Z', false), now)).toBe(
      'ended',
    )
  })
})

describe('multiplier', () => {
  it('reads and writes basis points', () => {
    expect(multiplierLabel(20_000)).toBe('2x')
    expect(multiplierLabel(12_500)).toBe('1.25x')
    expect(multiplierBpFrom('1.5')).toBe(15_000)
    expect(multiplierBpFrom('2x')).toBe(20_000)
    expect(multiplierBpFrom('0.5')).toBeNull()
    expect(multiplierBpFrom('')).toBeNull()
    expect(multiplierBpFrom('abc')).toBeNull()
  })
})

describe('timeline', () => {
  it('starts weeks on Monday in IST', () => {
    expect(weekStart(now).toISOString()).toBe('2026-11-22T18:30:00.000Z') // Mon 23 Nov IST
    // Sunday 29 Nov 23:00 IST is still that week.
    expect(weekStart(new Date('2026-11-29T17:30:00Z')).toISOString()).toBe(
      '2026-11-22T18:30:00.000Z',
    )
    // Monday 30 Nov 00:10 IST starts the next.
    expect(weekStart(new Date('2026-11-29T18:40:00Z')).toISOString()).toBe(
      '2026-11-29T18:30:00.000Z',
    )
  })

  it('draws weeks around this one', () => {
    const weeks = timelineWeeks(now, 1, 2)
    expect(weeks.map((w) => w.toISOString())).toEqual([
      '2026-11-15T18:30:00.000Z',
      '2026-11-22T18:30:00.000Z',
      '2026-11-29T18:30:00.000Z',
      '2026-12-06T18:30:00.000Z',
    ])
    const at = nowOffset(weeks, now)
    expect(at).toBeGreaterThan(0.25)
    expect(at).toBeLessThan(0.5)
    expect(nowOffset(weeks, new Date('2027-01-01T00:00:00Z'))).toBeNull()
  })

  it('places bars, clips them and stacks overlaps', () => {
    const weeks = timelineWeeks(now, 0, 1) // 23 Nov to 7 Dec IST, two weeks
    const bars = timelineBars(
      [
        { id: 'a', startsAt: '2026-11-22T18:30:00Z', endsAt: '2026-11-29T18:30:00Z', active: true },
        { id: 'b', startsAt: '2026-11-25T00:00:00Z', endsAt: '2026-12-20T00:00:00Z', active: true },
        { id: 'c', startsAt: '2026-11-30T00:00:00Z', endsAt: '2026-12-01T00:00:00Z', active: true },
        {
          id: 'old',
          startsAt: '2026-10-01T00:00:00Z',
          endsAt: '2026-10-02T00:00:00Z',
          active: true,
        },
      ],
      weeks,
    )
    expect(bars.map((b) => b.id)).toEqual(['a', 'b', 'c'])
    const [a, b, c] = bars
    expect(a).toMatchObject({
      left: 0,
      width: 0.5,
      lane: 0,
      clippedStart: false,
      clippedEnd: false,
    })
    expect(b).toMatchObject({ lane: 1, clippedEnd: true })
    expect(c?.lane).toBe(0)
    expect(timelineBars([], [])).toEqual([])
  })
})
