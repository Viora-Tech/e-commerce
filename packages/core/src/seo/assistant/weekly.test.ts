/** SOURCE OF TRUTH: tests for the weekly SEO email's figures (weekly.ts) — WHAT: movers against last week's snapshot or the 28 days before, the noise floor, and the suggestions / WHY: the email must name real moves only */
import { describe, expect, it } from 'vitest'
import type { SeoAssistantRow } from './opportunity'
import { seoSnapshot, seoWeekly, weeklyHasNews } from './weekly'

const row = (
  id: string,
  position: number,
  before: number,
  extra: Partial<SeoAssistantRow> = {},
): SeoAssistantRow => ({
  resource: 'product',
  id,
  title: id,
  handle: id,
  path: `/products/${id}`,
  seoTitle: null,
  seoDescription: null,
  current: { clicks: 5, impressions: 200, ctr: 0.025, position },
  previous: { clicks: 4, impressions: 180, ctr: 0.02, position: before },
  queries: [{ query: `${id} price`, clicks: 1, impressions: 50, ctr: 0.02, position }],
  gaps: [],
  gapDetails: [],
  opportunity: 100,
  inBand: true,
  ...extra,
})

describe('seoWeekly', () => {
  it('uses the 28 days before in the first week', () => {
    const w = seoWeekly([row('a', 6, 11), row('b', 9, 5)], null)
    expect(w.sinceLastWeek).toBe(false)
    expect(w.up).toEqual([
      { resource: 'product', id: 'a', title: 'a', path: '/products/a', from: 11, to: 6 },
    ])
    expect(w.down.map((m) => m.id)).toEqual(['b'])
  })
  it('compares with last week once there is a snapshot', () => {
    const last = seoSnapshot([row('a', 4, 4)])
    const w = seoWeekly([row('a', 8, 20)], last)
    expect(w.sinceLastWeek).toBe(true)
    expect(w.up).toEqual([])
    expect(w.down[0]).toMatchObject({ from: 4, to: 8 })
  })
  it('ignores small moves and pages seen too rarely', () => {
    const rare = row('rare', 3, 20, {
      current: { clicks: 0, impressions: 10, ctr: 0, position: 3 },
    })
    const w = seoWeekly([row('flat', 7.2, 7.6), rare], null)
    expect(w.up).toEqual([])
    expect(w.down).toEqual([])
  })
  it('suggests the top three with what to rewrite', () => {
    const w = seoWeekly(
      [
        row('a', 6, 6, { gaps: ['title_long'] }),
        row('b', 6, 6, { gaps: ['description_missing'] }),
        row('c', 6, 6),
        row('d', 6, 6),
      ],
      null,
    )
    expect(w.suggestions.map((s) => [s.id, s.kind, s.topQuery])).toEqual([
      ['a', 'title', 'a price'],
      ['b', 'description', 'b price'],
      ['c', 'snippet', 'c price'],
    ])
    expect(weeklyHasNews(w)).toBe(true)
    expect(w.impressions).toBe(800)
  })
})
