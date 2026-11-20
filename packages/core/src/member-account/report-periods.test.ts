/** SOURCE OF TRUTH: team report period tests — WHAT: the days each report covers, the period before, bars and history at month edges and IST midnight / WHY: an off-by-one day here reports the wrong week to every member */
import { describe, expect, it } from 'vitest'
import { dailyPeriod, isoWeek, monthlyPeriod, reportDue, weeklyPeriod } from './report-periods'

/** An IST wall-clock time as an instant: `ist('2026-11-16T09:30')`. */
const ist = (wall: string) => new Date(`${wall}:00.000+05:30`)

describe('weekly period', () => {
  it('covers last Monday to Sunday, against the week before', () => {
    const p = weeklyPeriod(ist('2026-11-16T09:30'))
    expect(p.from).toEqual(ist('2026-11-09T00:00'))
    expect(p.to).toEqual(ist('2026-11-16T00:00'))
    expect(p.previous).toEqual({ from: ist('2026-11-02T00:00'), to: ist('2026-11-09T00:00') })
    expect(p.key).toBe('2026-11-09')
    expect(p.labels.period).toBe('Monday 9 – Sunday 15 November')
    expect(p.labels.kicker).toBe('46')
    expect(p.buckets.map((b) => b.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'])
    expect(p.buckets[5]?.name).toBe('Saturday')
    expect(p.history.map((h) => h.label)).toEqual(['12 Oct', '19 Oct', '26 Oct', '2 Nov', '9 Nov'])
    expect(p.history.at(-1)?.to).toEqual(p.to)
  })

  it('names both months when the week crosses one, and is the same week all Monday', () => {
    const p = weeklyPeriod(ist('2026-11-02T23:59'))
    expect(p.labels.period).toBe('Monday 26 October – Sunday 1 November')
    expect(weeklyPeriod(ist('2026-11-02T09:00')).key).toBe(p.key)
  })
})

describe('monthly period', () => {
  it('covers last month in weeks cut at its edges, against the month before', () => {
    const p = monthlyPeriod(ist('2026-11-01T09:30'))
    expect(p.from).toEqual(ist('2026-10-01T00:00'))
    expect(p.to).toEqual(ist('2026-11-01T00:00'))
    expect(p.previous.from).toEqual(ist('2026-09-01T00:00'))
    expect(p.key).toBe('2026-10')
    expect(p.labels).toMatchObject({
      period: 'Thursday 1 – Saturday 31 October',
      kicker: 'October 2026',
      name: 'October',
      previousName: 'September',
    })
    expect(p.buckets.map((b) => b.label)).toEqual(['1–4 Oct', '5–11', '12–18', '19–25', '26–31'])
    expect(p.buckets[2]?.name).toBe('12–18 October')
    expect(p.buckets.at(-1)?.to).toEqual(p.to)
    expect(p.history.map((h) => h.label)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'October'])
  })
})

describe('daily period', () => {
  it('covers yesterday in the morning, against the same weekday a week before', () => {
    const p = dailyPeriod(ist('2026-11-18T09:30'))
    expect(p.today).toBe(false)
    expect(p.from).toEqual(ist('2026-11-17T00:00'))
    expect(p.to).toEqual(ist('2026-11-18T00:00'))
    expect(p.previous.from).toEqual(ist('2026-11-10T00:00'))
    expect(p.labels.period).toBe('Tuesday 17 November')
    expect(p.buckets.map((b) => b.label)).toEqual([
      '12–6am',
      '6–10am',
      '10am–2pm',
      '2–6pm',
      '6–10pm',
      '10pm–12',
    ])
    expect(p.history.map((h) => h.label)).toEqual(['Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue'])
  })

  it('covers today so far after noon', () => {
    const now = ist('2026-11-18T20:00')
    const p = dailyPeriod(now)
    expect(p.today).toBe(true)
    expect(p.from).toEqual(ist('2026-11-18T00:00'))
    expect(p.to).toEqual(now)
    expect(p.previous.to).toEqual(ist('2026-11-11T20:00'))
    expect(p.history.at(-1)?.to).toEqual(now)
  })
})

describe('when a report is due', () => {
  it('weekly from 9:00 IST on Monday, monthly from 9:00 on the 1st', () => {
    expect(reportDue('weekly', ist('2026-11-16T08:59'))).toBe(false)
    expect(reportDue('weekly', ist('2026-11-16T09:00'))).toBe(true)
    expect(reportDue('weekly', ist('2026-11-17T09:00'))).toBe(false)
    expect(reportDue('monthly', ist('2026-12-01T09:10'))).toBe(true)
    expect(reportDue('monthly', ist('2026-12-02T09:10'))).toBe(false)
  })

  it('numbers weeks the ISO way', () => {
    expect(isoWeek(ist('2026-01-01T12:00'))).toBe(1)
    expect(isoWeek(ist('2026-12-28T12:00'))).toBe(53)
  })
})
