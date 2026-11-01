import { parseQuery } from '@commerce/core/analytics-query'
import { describe, expect, it } from 'vitest'
import {
  ANSWER_TABLE_LIMITS,
  answerTable,
  callInputs,
  daysFrom,
  detachTable,
  fillSeries,
  monthsFrom,
  parseSnapshot,
  salesSeriesQuery,
  TABLE_SHOWN,
  topProductsQuery,
  windowDays,
} from '../src/services/ai/answer-table'

const TZ = 'Asia/Kolkata'

const table = answerTable({
  columns: [
    { id: 'product', kind: 'text' },
    { id: 'units', kind: 'count' },
  ],
  rows: [{ values: { product: 'Glide Mouse', units: 12 } }],
  chart: { kind: 'bar', x: 'product', y: 'units' },
})

describe('AI answer tables (#192)', () => {
  it('cuts a table to the limits and drops a chart over missing columns', () => {
    const big = answerTable({
      columns: Array.from({ length: 12 }, (_, i) => ({ id: `c${i}`, kind: 'count' as const })),
      rows: Array.from({ length: 100 }, (_, i) => ({ values: { c0: i, c1: 'x'.repeat(500) } })),
      chart: { kind: 'line', x: 'day', y: 'c0' },
    })
    expect(big.columns).toHaveLength(ANSWER_TABLE_LIMITS.columns)
    expect(big.rows).toHaveLength(ANSWER_TABLE_LIMITS.rows)
    expect(String(big.rows[0]?.values.c1).length).toBe(ANSWER_TABLE_LIMITS.text)
    expect(big.rows[0]?.values.c2).toBeNull()
    expect(big.chart).toBeNull()
    expect(big.query).toBeNull()
    expect(table.chart).toEqual({ kind: 'bar', x: 'product', y: 'units' })
  })

  it('keeps cells to strings, numbers and null', () => {
    const t = answerTable({
      columns: [{ id: 'a', kind: 'text' }],
      rows: [{ values: { a: { evil: true } as unknown as string } }],
    })
    expect(t.rows[0]?.values.a).toBeNull()
  })

  it('takes the table off what the model reads and leaves a ref and a note', () => {
    const { modelOutput, table: kept } = detachTable(
      { facts: [{ label: 'x', value: '1' }], table },
      'abc',
    )
    expect(kept).toEqual(table)
    expect(modelOutput).toEqual({
      facts: [{ label: 'x', value: '1' }],
      table: TABLE_SHOWN,
      ref: 'abc',
    })
    expect(JSON.stringify(modelOutput)).not.toContain('Glide Mouse')
  })

  it('passes outputs without a table through with a ref', () => {
    expect(detachTable({ facts: [] }, 'r')).toEqual({
      modelOutput: { facts: [], ref: 'r' },
      table: null,
    })
    expect(detachTable({ facts: [], table: 'nonsense' }, 'r').table).toBeNull()
    expect(detachTable(null, 'r').modelOutput).toEqual({ result: null, ref: 'r' })
  })

  it('lists the inputs a tool ran with as short text, skipping empty and nested values', () => {
    expect(
      callInputs({
        period: 'this_month',
        days: 30,
        search: '  ',
        limit: 5,
        nested: { a: 1 },
        from: undefined,
      }),
    ).toEqual([
      { key: 'period', value: 'this_month' },
      { key: 'days', value: '30' },
      { key: 'limit', value: '5' },
    ])
    expect(callInputs('x')).toEqual([])
    expect(callInputs({ search: 'y'.repeat(300) })[0]?.value).toHaveLength(100)
  })
})

describe('series helpers', () => {
  it('lists days and months across a month end and a year end', () => {
    expect(daysFrom('2026-10-30', '2026-11-02')).toEqual([
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
      '2026-11-02',
    ])
    expect(monthsFrom('2026-11-15', '2027-02-01')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ])
  })

  it('reads a window as store days with the end exclusive', () => {
    // 1 Oct 00:00 IST to 31 Oct 10:00 IST.
    const days = windowDays(new Date('2026-09-30T18:30:00Z'), new Date('2026-10-31T04:30:00Z'), TZ)
    expect(days).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    // A whole month ends the day before the next one starts.
    const last = windowDays(new Date('2026-08-31T18:30:00Z'), new Date('2026-09-30T18:30:00Z'), TZ)
    expect(last).toEqual({ from: '2026-09-01', to: '2026-09-30' })
  })

  it('fills empty days with zero, in order', () => {
    const rows = fillSeries(
      'day',
      ['2026-10-01', '2026-10-02', '2026-10-03'],
      [{ bucket: '2026-10-02', values: { totalSales: 5000, orders: 2 } }],
      ['totalSales', 'orders'],
    )
    expect(rows.map((r) => r.values)).toEqual([
      { day: '2026-10-01', totalSales: 0, orders: 0 },
      { day: '2026-10-02', totalSales: 5000, orders: 2 },
      { day: '2026-10-03', totalSales: 0, orders: 0 },
    ])
  })
})

describe('the same numbers as a custom query (#102)', () => {
  it('writes sales by day as a query the parser accepts', () => {
    const parsed = parseQuery(salesSeriesQuery({ from: '2026-10-01', to: '2026-10-31' }, 'day'))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.query.table).toBe('sales')
    expect(parsed.query.show).toEqual(['total_sales', 'orders'])
    expect(parsed.query.groupBy).toBe('day')
    expect(parsed.query.since).toEqual({ kind: 'date', iso: '2026-10-01' })
    expect(parsed.query.until).toEqual({ kind: 'date', iso: '2026-10-31' })
    expect(parsed.query.compare).toBe('previous_period')
  })

  it('writes sales by month as a query the parser accepts', () => {
    const parsed = parseQuery(salesSeriesQuery({ from: '2026-01-01', to: '2026-10-31' }, 'month'))
    expect(parsed.ok && parsed.query.groupBy).toBe('month')
  })

  it('writes top products as a query the parser accepts', () => {
    const parsed = parseQuery(topProductsQuery({ from: '2026-10-01', to: '2026-10-31' }, 5))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.query.table).toBe('products')
    expect(parsed.query.groupBy).toBe('product_title')
    expect(parsed.query.orderBy).toEqual({ field: 'net_quantity', dir: 'desc' })
    expect(parsed.query.limit).toBe(5)
  })
})

describe('answer snapshots', () => {
  const snapshot = {
    question: 'What is running out?',
    tool: 'lowStock',
    answeredAt: '2026-10-31T04:30:00.000Z',
    columns: table.columns,
    rows: table.rows,
    chart: null,
    range: null,
  }

  it('reads a saved snapshot back', () => {
    expect(parseSnapshot(JSON.stringify(snapshot))).toEqual(snapshot)
  })

  it('rejects anything that is not a snapshot', () => {
    expect(parseSnapshot(null)).toBeNull()
    expect(parseSnapshot('FROM sales SHOW orders')).toBeNull()
    expect(parseSnapshot(JSON.stringify({ ...snapshot, columns: [] }))).toBeNull()
    expect(
      parseSnapshot(JSON.stringify({ ...snapshot, columns: [{ id: 'a', kind: 'script' }] })),
    ).toBeNull()
  })
})
