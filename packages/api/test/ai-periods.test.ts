import { describe, expect, it } from 'vitest'
import { resolvePeriod } from '../src/services/ai/periods'

const TZ = 'Asia/Kolkata'
// Friday 31 Oct 2026, 10:00 in India.
const NOW = new Date('2026-10-31T04:30:00Z')
const ist = (d: Date) => new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16)

describe('AI periods (#103)', () => {
  it('this month starts on the 1st in the store time zone and runs to now', () => {
    const p = resolvePeriod({ period: 'this_month', days: 30 }, NOW, TZ)
    expect(ist(p.from)).toBe('2026-10-01T00:00')
    expect(p.to).toEqual(NOW)
    expect(p.label).toContain('this month')
  })

  it('last month is the whole calendar month', () => {
    const p = resolvePeriod({ period: 'last_month', days: 30 }, NOW, TZ)
    expect(ist(p.from)).toBe('2026-09-01T00:00')
    expect(ist(p.to)).toBe('2026-10-01T00:00')
  })

  it('weeks start on Monday', () => {
    const p = resolvePeriod({ period: 'this_week', days: 7 }, NOW, TZ)
    expect(ist(p.from)).toBe('2026-10-26T00:00')
    const last = resolvePeriod({ period: 'last_week', days: 7 }, NOW, TZ)
    expect(ist(last.from)).toBe('2026-10-19T00:00')
    expect(ist(last.to)).toBe('2026-10-26T00:00')
  })

  it('a custom range includes its last day and the window before is as long', () => {
    const p = resolvePeriod(
      { period: 'custom', days: 7, from: '2026-10-10', to: '2026-10-12' },
      NOW,
      TZ,
    )
    expect(ist(p.from)).toBe('2026-10-10T00:00')
    expect(ist(p.to)).toBe('2026-10-13T00:00')
    expect(ist(p.prevFrom)).toBe('2026-10-07T00:00')
  })

  it('N days keeps working as before', () => {
    const p = resolvePeriod({ period: 'days', days: 7 }, NOW, TZ)
    expect(ist(p.from)).toBe('2026-10-25T00:00')
    expect(p.label).toContain('last 7 days')
  })
})
