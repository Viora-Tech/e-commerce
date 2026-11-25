import { describe, expect, it } from 'vitest'
import {
  aovPaise,
  exportFileName,
  fillDays,
  memberSortInput,
  memberSortParam,
  parseMemberSort,
  peekPointsCsv,
  rangeInstants,
} from './loyalty-insights'

describe('loyalty insights range', () => {
  it('turns store days into IST midnights, the end day counted', () => {
    const r = rangeInstants({ from: '2026-11-01', to: '2026-11-30' })
    expect(r.from.toISOString()).toBe('2026-10-31T18:30:00.000Z')
    expect(r.to.toISOString()).toBe('2026-11-30T18:30:00.000Z')
  })

  it('fills the days the API had no row for with 0', () => {
    const days = fillDays(
      { from: '2026-11-01', to: '2026-11-03' },
      [{ day: '2026-11-02', v: 500 }],
      (r) => r.v,
    )
    expect(days).toEqual([
      { day: '2026-11-01', value: 0 },
      { day: '2026-11-02', value: 500 },
      { day: '2026-11-03', value: 0 },
    ])
  })
})

describe('average order value', () => {
  it('is null without orders', () => {
    expect(aovPaise(0, 0)).toBeNull()
    expect(aovPaise(100_001, 2)).toBe(50_001)
  })
})

describe('import file peek', () => {
  it('needs email and points columns, in any order and case', () => {
    expect(peekPointsCsv('﻿Points,"Email"\n10,a@b.in\n\n20,c@d.in\n')).toEqual({
      ok: true,
      rows: 2,
      missing: [],
    })
    expect(peekPointsCsv('email,balance\na@b.in,10')).toEqual({
      ok: false,
      rows: 1,
      missing: ['points'],
    })
    expect(peekPointsCsv('')).toEqual({ ok: false, rows: 0, missing: ['email', 'points'] })
  })
})

describe('members sort', () => {
  it('reads and writes the URL value', () => {
    expect(parseMemberSort('lifetime.desc')).toEqual({ id: 'lifetime', desc: true })
    expect(parseMemberSort('points.desc')).toBeNull()
    expect(parseMemberSort('name')).toBeNull()
    expect(memberSortParam({ id: 'spent', desc: false })).toBe('spent.asc')
    expect(memberSortParam(null)).toBe('')
  })

  it('maps to the API, newest first by default', () => {
    expect(memberSortInput('')).toEqual({ sort: 'joined', dir: 'desc' })
    expect(memberSortInput('spent.asc')).toEqual({ sort: 'total_spent', dir: 'asc' })
  })

  it('dates the export in the store day', () => {
    expect(exportFileName(new Date('2026-11-24T20:00:00Z'))).toBe('loyalty-members-2026-11-25.csv')
  })
})
