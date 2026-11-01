/** SOURCE OF TRUTH: search boost tests — WHAT: boost/bury rules compiled to SQL and the same order in TypeScript / WHY: guard Search & discovery ranking */
import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import { boostClauses } from './boost-sql'
import {
  BOOST_TIERS,
  boostFlags,
  boostsEmpty,
  comparePinned,
  compileBoosts,
  MAX_PINS_PER_TERM,
  NO_BOOSTS,
  searchRank,
} from './boosts'

const dialect = new PgDialect()

describe('compileBoosts', () => {
  it('groups values by field and action, trimmed and without repeats', () => {
    const b = compileBoosts([
      { field: 'vendor', value: ' Waimers ', action: 'boost' },
      { field: 'vendor', value: 'Waimers', action: 'boost' },
      { field: 'tag', value: 'sale', action: 'boost' },
      { field: 'type', value: 'Gift Card', action: 'bury' },
      { field: 'tag', value: '  ', action: 'boost' },
    ])
    expect(b.boost).toEqual({ tag: ['sale'], type: [], vendor: ['Waimers'] })
    expect(b.bury).toEqual({ tag: [], type: ['Gift Card'], vendor: [] })
  })

  it('reads a value both boosted and buried as buried', () => {
    const b = compileBoosts([
      { field: 'tag', value: 'old', action: 'boost' },
      { field: 'tag', value: 'old', action: 'bury' },
    ])
    expect(b.boost.tag).toEqual([])
    expect(b.bury.tag).toEqual(['old'])
  })

  it('keeps pin order, drops repeats and caps the pins', () => {
    const ids = Array.from({ length: 15 }, (_, i) => `p${i}`)
    const b = compileBoosts([], ['p2', 'p1', 'p2', ...ids])
    expect(b.pins.slice(0, 3)).toEqual(['p2', 'p1', 'p0'])
    expect(b.pins).toHaveLength(MAX_PINS_PER_TERM)
  })

  it('knows when nothing changes', () => {
    expect(boostsEmpty(NO_BOOSTS)).toBe(true)
    expect(boostsEmpty(compileBoosts([], ['p1']))).toBe(false)
  })
})

describe('ranking', () => {
  const b = compileBoosts([
    { field: 'vendor', value: 'Waimers', action: 'boost' },
    { field: 'tag', value: 'discontinued', action: 'bury' },
  ])

  it('flags products from their tags, type and vendor', () => {
    expect(boostFlags(b, { tags: [], productType: null, vendor: 'Waimers' })).toEqual({
      boosted: true,
      buried: false,
    })
    expect(boostFlags(b, { tags: ['discontinued'], productType: null, vendor: null })).toEqual({
      boosted: false,
      buried: true,
    })
    // Exact values only: a vendor rule is not a substring match.
    expect(boostFlags(b, { tags: [], productType: null, vendor: 'Waimers India' }).boosted).toBe(
      false,
    )
  })

  it('moves a boosted product up two tiers and a buried one after everything', () => {
    expect(searchRank(4, true, false)).toBe(4 - BOOST_TIERS)
    expect(searchRank(0, false, true)).toBeGreaterThan(searchRank(9, false, false))
    expect(searchRank(3, true, true)).toBeGreaterThan(searchRank(5, false, false))
  })

  it('orders pins first, in pin order, then by rank', () => {
    const rows = [
      { id: 'plain-title', pin: null, rank: searchRank(0, false, false) },
      { id: 'boosted-tag', pin: null, rank: searchRank(4, true, false) },
      { id: 'pinned-2', pin: 2, rank: searchRank(5, false, false) },
      { id: 'buried-title', pin: null, rank: searchRank(0, false, true) },
      { id: 'pinned-1', pin: 1, rank: searchRank(5, false, true) },
    ]
    expect([...rows].sort(comparePinned).map((r) => r.id)).toEqual([
      'pinned-1',
      'pinned-2',
      'plain-title',
      'boosted-tag',
      'buried-title',
    ])
  })
})

describe('boostClauses', () => {
  it('adds nothing without boosts', () => {
    const c = boostClauses(NO_BOOSTS)
    expect(c.pinned).toBeNull()
    expect(c.adjust).toBeNull()
    expect(dialect.sqlToQuery(c.pin).sql).toBe('null::int')
  })

  it('reads only the product row: no subquery per row', () => {
    const c = boostClauses(
      compileBoosts(
        [
          { field: 'tag', value: 'sale', action: 'boost' },
          { field: 'type', value: 'Mat', action: 'boost' },
          { field: 'vendor', value: 'Old Co', action: 'bury' },
        ],
        ['0190f6b4-0000-7000-8000-000000000001'],
      ),
    )
    const adjust = dialect.sqlToQuery(c.adjust ?? NO_SQL)
    expect(adjust.sql).not.toMatch(/select/i)
    expect(adjust.sql).toContain('p.tags && array[')
    expect(adjust.sql).toContain('p.product_type = any(array[')
    expect(adjust.sql).toContain('p.vendor = any(array[')
    expect(adjust.sql).toContain(`then ${-BOOST_TIERS} else 0`)
    expect(adjust.params).toEqual(['sale', 'Mat', 'Old Co'])
    const pin = dialect.sqlToQuery(c.pin)
    expect(pin.sql).toContain('array_position(array[')
    expect(pin.params).toEqual(['0190f6b4-0000-7000-8000-000000000001'])
    expect(dialect.sqlToQuery(c.pinned ?? NO_SQL).sql).toContain('p.id = any(')
  })

  it('pins alone change only the order and the matches', () => {
    const c = boostClauses(compileBoosts([], ['0190f6b4-0000-7000-8000-000000000002']))
    expect(c.adjust).toBeNull()
    expect(c.pinned).not.toBeNull()
  })
})

const NO_SQL = boostClauses(NO_BOOSTS).pin
