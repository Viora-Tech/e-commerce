/** SOURCE OF TRUTH: custom analytics query control tests — WHAT: control edits and ranges / WHY: a control must only ever produce a query the parser accepts */
import { describe, expect, test } from 'vitest'
import {
  queryDay,
  rangeKeyOf,
  rangeTimes,
  setCompare,
  setGroupBy,
  setLimit,
  setOrderBy,
  setRange,
  setShow,
  setTable,
  toggleMetric,
} from './controls'
import { formatQuery, type ParsedQuery, parseQuery } from './parse'
import { queryLanguageReference } from './reference'
import { STARTER_QUERY } from './schema'

const starter = (): ParsedQuery => {
  const r = parseQuery(STARTER_QUERY)
  if (!r.ok) throw new Error('starter query does not parse')
  return r.query
}

/** Every edit must survive format → parse unchanged. */
const roundTrips = (q: ParsedQuery) => {
  const again = parseQuery(formatQuery(q))
  expect(again.ok && again.query).toEqual(q)
}

describe('query controls', () => {
  test('switching table keeps shared fields and drops the rest', () => {
    const q = setTable(starter(), 'products')
    expect(q.table).toBe('products')
    expect(q.show).toEqual(['orders'])
    expect(q.groupBy).toBe('state')
    expect(q.orderBy).toBeNull()
    roundTrips(q)
  })

  test('switching table falls back to the first metric', () => {
    const q = setTable({ ...starter(), show: ['net_sales'], orderBy: null }, 'products')
    expect(q.show).toEqual(['net_quantity'])
  })

  test('metrics keep the table order, never empty, and a dropped sort field clears the sort', () => {
    const q = setShow(starter(), ['orders', 'net_sales'])
    expect(q.show).toEqual(['net_sales', 'orders'])
    expect(setShow(starter(), [])).toEqual(starter())
    const without = toggleMetric(starter(), 'net_sales')
    expect(without.show).toEqual(['orders', 'average_order_value'])
    expect(without.orderBy).toBeNull()
    roundTrips(without)
    expect(toggleMetric(without, 'taxes').show).toContain('taxes')
  })

  test('dimension, sort, limit and compare', () => {
    expect(setGroupBy(starter(), 'orders').groupBy).toBe('state')
    const daily = setOrderBy(setGroupBy(starter(), 'day'), 'day', 'asc')
    expect(daily.orderBy).toEqual({ field: 'day', dir: 'asc' })
    roundTrips(daily)
    expect(setGroupBy(daily, null).orderBy).toBeNull()
    expect(setOrderBy(starter(), 'taxes').orderBy).toBeNull()
    expect(setLimit(starter(), 0).limit).toBe(1)
    expect(setLimit(starter(), 9999).limit).toBe(1000)
    expect(setCompare(starter(), null).compare).toBeNull()
    roundTrips(setLimit(setCompare(starter(), 'previous_year'), 25))
  })

  test('quick ranges map to SINCE / UNTIL and back', () => {
    for (const key of ['today', '7d', '30d', '90d'] as const) {
      const { since, until } = rangeTimes(key)
      const q = setRange(starter(), since, until)
      expect(rangeKeyOf(q)).toBe(key)
      roundTrips(q)
    }
    expect(
      rangeKeyOf(setRange(starter(), rangeTimes('7d').since, { kind: 'word', word: 'yesterday' })),
    ).toBeNull()
    expect(
      rangeKeyOf({ ...starter(), since: { kind: 'relative', amount: 3, unit: 'm' } }),
    ).toBeNull()
  })

  test('reads times as IST days', () => {
    const now = new Date('2026-10-22T20:00:00Z') // 23 Oct, 01:30 IST
    expect(queryDay({ kind: 'word', word: 'today' }, now)).toBe('2026-10-23')
    expect(queryDay({ kind: 'word', word: 'yesterday' }, now)).toBe('2026-10-22')
    expect(queryDay({ kind: 'relative', amount: 7, unit: 'd' }, now)).toBe('2026-10-16')
    expect(queryDay({ kind: 'date', iso: '2026-01-05' }, now)).toBe('2026-01-05')
  })
})

describe('queryLanguageReference', () => {
  test('lists every table and field, and its examples parse', () => {
    const text = queryLanguageReference()
    expect(text).toContain('Table products')
    expect(text).toContain('average_order_value (metric, money)')
    const examples = text.split('Examples:')[1] ?? ''
    for (const block of examples.split(/\n"[^"]+":\n/).filter((b) => b.trim().startsWith('FROM'))) {
      expect(parseQuery(block).ok).toBe(true)
    }
  })
})
