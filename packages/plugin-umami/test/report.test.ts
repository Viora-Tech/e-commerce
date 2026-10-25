import { describe, expect, it } from 'vitest'
import { toDailySeries, toRows, toTrend, toUmamiStats, umamiKpis } from '../src/report'

describe('toUmamiStats', () => {
  it('reads Umami 3: plain figures and a comparison object', () => {
    const stats = toUmamiStats({
      pageviews: 300,
      visitors: 100,
      visits: 120,
      bounces: 60,
      totaltime: 6000,
      comparison: { pageviews: 200, visitors: 80, visits: 100, bounces: 40, totaltime: 5000 },
    })
    expect(stats.current).toEqual({
      pageviews: 300,
      visitors: 100,
      visits: 120,
      bounces: 60,
      totaltime: 6000,
    })
    expect(stats.previous?.visitors).toBe(80)
  })

  it('reads Umami 2: { value, prev } per figure', () => {
    const stats = toUmamiStats({
      pageviews: { value: 30, prev: 20 },
      visitors: { value: 10, prev: 0 },
      visits: { value: 12, prev: 9 },
      bounces: { value: 6, prev: 3 },
      totaltime: { value: 600, prev: 300 },
    })
    expect(stats.current.pageviews).toBe(30)
    expect(stats.previous?.pageviews).toBe(20)
  })

  it('has no previous period when Umami sent none, and zeros for junk', () => {
    expect(toUmamiStats({ visitors: 'x', pageviews: -4 })).toEqual({
      current: { pageviews: 0, visitors: 0, visits: 0, bounces: 0, totaltime: 0 },
      previous: null,
    })
    expect(toUmamiStats(null).previous).toBeNull()
  })
})

describe('umamiKpis', () => {
  it('works out bounce rate and average visit time, with change against before', () => {
    const kpis = umamiKpis({
      current: { pageviews: 300, visitors: 100, visits: 120, bounces: 60, totaltime: 6000 },
      previous: { pageviews: 300, visitors: 50, visits: 0, bounces: 0, totaltime: 0 },
    })
    const byId = Object.fromEntries(kpis.map((k) => [k.id, k]))
    expect(byId.visitors).toMatchObject({ value: 100, previous: 50, delta: 1 })
    expect(byId.pageviews?.delta).toBe(0)
    expect(byId.bounceRate?.value).toBe(0.5)
    expect(byId.visitDuration?.value).toBe(50)
    // Nothing to compare a rate with when there were no visits before.
    expect(byId.bounceRate?.delta).toBeNull()
  })
})

describe('daily series', () => {
  const days = ['2026-10-01', '2026-10-02', '2026-10-03']

  it('places each bucket on its day, whichever date format Umami used, zero for gaps', () => {
    expect(
      toDailySeries(
        [
          { x: '2026-10-01 00:00:00', y: 4 },
          { x: '2026-10-03T00:00:00Z', y: 7 },
          { x: '2026-09-30 00:00:00', y: 99 },
        ],
        days,
      ),
    ).toEqual([4, 0, 7])
  })

  it('takes visitors from sessions and page views from pageviews', () => {
    expect(
      toTrend(
        {
          pageviews: [{ x: '2026-10-02 00:00:00', y: 9 }],
          sessions: [{ x: '2026-10-02 00:00:00', y: 3 }],
        },
        days,
      ),
    ).toEqual({ visitors: [0, 3, 0], pageviews: [0, 9, 0] })
    expect(toTrend('nonsense', days)).toEqual({ visitors: [0, 0, 0], pageviews: [0, 0, 0] })
  })
})

describe('toRows', () => {
  it('ranks, caps and shares the rows, keeping the empty bucket as null', () => {
    const rows = toRows(
      [
        { x: '/b', y: 10 },
        { x: '', y: 30 },
        { x: '/a', y: 60 },
        { x: '/zero', y: 0 },
      ],
      2,
    )
    expect(rows).toEqual([
      { label: '/a', count: 60, share: 60 / 90 },
      { label: null, count: 30, share: 30 / 90 },
    ])
  })

  it('reads anything that is not a list as no rows', () => {
    expect(toRows({ error: 'nope' })).toEqual([])
  })
})
