import { describe, expect, it } from 'vitest'
import { DATE_CUSTOM } from '@/components/table/filter-panel'
import { dateFilterBounds, hasDateFilter, NO_DATE_FILTER, parseAsDateFilter } from './date-filter'

const parser = parseAsDateFilter(['today', '7d'])
const start = (preset: string, now: Date) =>
  preset === '7d' ? new Date(now.getTime() - 7 * 86_400_000) : null

describe('date filter', () => {
  it('reads and writes presets and custom ranges in the URL', () => {
    expect(parser.parse('7d')).toEqual({ preset: '7d', from: '', to: '' })
    expect(parser.parse('custom:2026-10-01..2026-10-28')).toEqual({
      preset: DATE_CUSTOM,
      from: '2026-10-01',
      to: '2026-10-28',
    })
    expect(parser.parse('custom:..2026-10-28')).toEqual({
      preset: DATE_CUSTOM,
      from: '',
      to: '2026-10-28',
    })
    expect(parser.parse('yesterday')).toBeNull()
    expect(parser.serialize({ preset: '7d', from: '', to: '' })).toBe('7d')
    expect(parser.serialize({ preset: DATE_CUSTOM, from: '2026-10-01', to: '' })).toBe(
      'custom:2026-10-01..',
    )
  })

  it('filters only with a preset or a custom range with an end', () => {
    expect(hasDateFilter(NO_DATE_FILTER)).toBe(false)
    expect(hasDateFilter({ preset: DATE_CUSTOM, from: '', to: '' })).toBe(false)
    expect(hasDateFilter({ preset: DATE_CUSTOM, from: '2026-10-01', to: '' })).toBe(true)
    expect(hasDateFilter({ preset: '7d', from: '', to: '' })).toBe(true)
  })

  it('turns a custom range into whole days, the last day included', () => {
    const b = dateFilterBounds({ preset: DATE_CUSTOM, from: '2026-10-01', to: '2026-10-28' }, start)
    const from = new Date(b.from as string)
    const to = new Date(b.to as string)
    expect([from.getFullYear(), from.getMonth(), from.getDate(), from.getHours()]).toEqual([
      2026, 9, 1, 0,
    ])
    // Up to midnight after the 28th: the whole last day counts.
    expect([to.getMonth(), to.getDate(), to.getHours()]).toEqual([9, 29, 0])
  })

  it('turns a preset into its start, and nothing for no filter', () => {
    const now = new Date('2026-10-28T12:00:00.000Z')
    expect(dateFilterBounds({ preset: '7d', from: '', to: '' }, start, now)).toEqual({
      from: '2026-10-21T12:00:00.000Z',
    })
    expect(dateFilterBounds(NO_DATE_FILTER, start, now)).toEqual({})
  })
})
