import { describe, expect, it } from 'vitest'
import {
  averageOrderValue,
  bucketByDay,
  buildFunnel,
  conversionRate,
  delta,
  istIsoDate,
  resolveRange,
  returningRate,
  toWeeklyPoints,
} from '../src/services/analytics-buckets'

/* 22 Sept 2026, 02:00 UTC = 07:30 IST, so the IST day is the 22nd. */
const now = new Date('2026-09-22T02:00:00.000Z')
/* 21 Sept 2026, 20:00 UTC = 01:30 IST on the 22nd: the same IST day, a different UTC one. */
const lateNight = new Date('2026-09-21T20:00:00.000Z')

describe('resolveRange', () => {
  it('covers the requested number of IST days, ending today', () => {
    const r = resolveRange({ key: '7d' }, now)
    expect(r.days).toHaveLength(7)
    expect(r.days.at(-1)).toBe('2026-09-22')
    expect(r.days[0]).toBe('2026-09-16')
    expect(istIsoDate(r.from)).toBe('2026-09-16')
  })

  it('puts the previous period immediately before, with the same length', () => {
    const r = resolveRange({ key: '30d' }, now)
    expect(r.previousTo.getTime()).toBe(r.from.getTime())
    expect(r.from.getTime() - r.previousFrom.getTime()).toBe(r.to.getTime() - r.from.getTime())
  })

  it('reads today as a single day', () => {
    expect(resolveRange({ key: 'today' }, now).days).toEqual(['2026-09-22'])
  })

  it('takes both ends of a custom range inclusively', () => {
    const r = resolveRange({ key: 'custom', from: '2026-09-01', to: '2026-09-05' }, now)
    expect(r.days).toEqual(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05'])
  })

  it('falls back to the default when a custom range has no dates', () => {
    expect(resolveRange({ key: 'custom' }, now).days).toHaveLength(30)
  })
})

describe('bucketByDay', () => {
  it('buckets by IST day, not UTC day', () => {
    const days = ['2026-09-21', '2026-09-22']
    const out = bucketByDay([{ at: lateNight }], days)
    expect(out).toEqual([0, 1])
  })

  it('sums weights and ignores instants outside the range', () => {
    const days = ['2026-09-21', '2026-09-22']
    const out = bucketByDay(
      [
        { at: new Date('2026-09-22T06:00:00.000Z'), weight: 1500 },
        { at: new Date('2026-09-22T07:00:00.000Z'), weight: 500 },
        { at: new Date('2026-08-01T06:00:00.000Z'), weight: 999 },
      ],
      days,
    )
    expect(out).toEqual([0, 2000])
  })
})

describe('toWeeklyPoints', () => {
  it('folds days into 7-day buckets labelled by the first day', () => {
    const days = Array.from({ length: 9 }, (_, i) => `2026-09-${String(i + 1).padStart(2, '0')}`)
    const points = toWeeklyPoints(days, [1, 1, 1, 1, 1, 1, 1, 5, 5])
    expect(points).toEqual([
      { label: '2026-09-01', value: 7 },
      { label: '2026-09-08', value: 10 },
    ])
  })
})

describe('rates', () => {
  it('divides orders by sessions and survives an empty period', () => {
    expect(conversionRate(3, 120)).toBeCloseTo(0.025)
    expect(conversionRate(3, 0)).toBe(0)
  })

  it('rounds the average order value to the paisa', () => {
    expect(averageOrderValue(10_000, 3)).toBe(3333)
    expect(averageOrderValue(0, 0)).toBe(0)
  })

  it('reports the returning share of orders', () => {
    expect(returningRate(2, 8)).toBe(0.25)
    expect(returningRate(0, 0)).toBe(0)
  })

  it('leaves the change unknown when there is nothing to compare', () => {
    expect(delta(10, 5)).toBe(1)
    expect(delta(5, 10)).toBe(-0.5)
    expect(delta(4, 0)).toBeNull()
    expect(delta(0, 0)).toBe(0)
  })
})

describe('buildFunnel', () => {
  it('shares each step against sessions and against the step before', () => {
    const steps = buildFunnel({ sessions: 1000, carts: 200, checkouts: 80, orders: 40 })
    expect(steps.map((s) => s.value)).toEqual([1000, 200, 80, 40])
    expect(steps[1]?.share).toBe(0.2)
    expect(steps[2]?.stepRate).toBeCloseTo(0.4)
    expect(steps[3]?.stepRate).toBe(0.5)
    expect(steps[0]?.stepRate).toBeNull()
  })

  it('reports true counts and leaves the rate unknown when a step outgrows the one before', () => {
    // Carts can outnumber recorded sessions when the beacon was blocked.
    const steps = buildFunnel({ sessions: 10, carts: 50, checkouts: 30, orders: 5 })
    expect(steps.map((s) => s.value)).toEqual([10, 50, 30, 5])
    expect(steps.every((s) => s.share <= 1)).toBe(true)
    expect(steps[1]?.stepRate).toBeNull()
    expect(steps[2]?.stepRate).toBeCloseTo(0.6)
  })

  it('reads zeros without dividing by zero', () => {
    const steps = buildFunnel({ sessions: 0, carts: 0, checkouts: 0, orders: 0 })
    expect(steps.every((s) => s.share === 0)).toBe(true)
    expect(steps[1]?.stepRate).toBeNull()
  })

  it('still reports carts and orders when sessions are not being measured yet', () => {
    const steps = buildFunnel({ sessions: 0, carts: 12, checkouts: 8, orders: 5 })
    expect(steps.map((s) => s.value)).toEqual([0, 12, 8, 5])
    expect(steps[1]?.share).toBe(1)
    expect(steps[3]?.stepRate).toBeCloseTo(5 / 8)
  })
})
