import type { AnswerSnapshot, AnswerTable } from '@commerce/api'
import { describe, expect, it } from 'vitest'
import { answerReport, openAsReportHref, snapshotOf } from './answer-report'

const series: AnswerTable = {
  columns: [
    { id: 'day', kind: 'date' },
    { id: 'totalSales', kind: 'money' },
    { id: 'orders', kind: 'count' },
  ],
  rows: [
    { key: '2026-10-01', values: { day: '2026-10-01', totalSales: 10000, orders: 2 } },
    { key: '2026-10-02', values: { day: '2026-10-02', totalSales: 5000, orders: 1 } },
  ],
  chart: { kind: 'line', x: 'day', y: 'totalSales' },
  query: 'FROM sales\n  SHOW total_sales, orders',
  range: { from: '2026-10-01', to: '2026-10-02' },
}

const stock: AnswerTable = {
  columns: [
    { id: 'product', kind: 'text' },
    { id: 'available', kind: 'count' },
  ],
  rows: [{ key: '0', values: { product: 'Glide Mouse', available: 2 } }],
  chart: null,
  query: null,
  range: null,
}

const AT = new Date('2026-10-31T04:30:00Z')

describe('an AI answer as a report (#102)', () => {
  it('opens a table with a query in the query editor, else the snapshot page', () => {
    expect(openAsReportHref(series)).toBe(
      `/analytics/reports/query?q=${encodeURIComponent(series.query ?? '')}`,
    )
    expect(openAsReportHref(stock)).toBe('/analytics/reports/answer')
  })

  it('keeps the question, tool and time with the snapshot', () => {
    const snap = snapshotOf(stock, { tool: 'lowStock', question: 'Running out?', answeredAt: AT })
    expect(snap).toEqual({
      question: 'Running out?',
      tool: 'lowStock',
      answeredAt: '2026-10-31T04:30:00.000Z',
      columns: stock.columns,
      rows: stock.rows,
      chart: null,
      range: null,
    })
  })

  it('maps a series onto a line report with totals and chart points', () => {
    const snap: AnswerSnapshot = snapshotOf(series, {
      tool: 'salesSummary',
      question: 'Sales this month?',
      answeredAt: AT,
    })
    const { report, result } = answerReport(snap, 'AI answer')
    expect(report.chart).toBe('series')
    expect(report.metric).toBe('totalSales')
    expect(report.description).toBe('Sales this month?')
    expect(result.totals).toEqual({ totalSales: 15000, orders: 3 })
    expect(result.chart).toEqual([
      { label: '2026-10-01', value: 10000, previous: null },
      { label: '2026-10-02', value: 5000, previous: null },
    ])
    expect(result.range).toMatchObject({ from: '2026-10-01', to: '2026-10-02' })
    expect(result.previousTotals).toBeNull()
  })

  it('maps a table without a chart to rows only, no totals', () => {
    const snap = snapshotOf(stock, { tool: 'lowStock', question: '', answeredAt: AT })
    const { report, result } = answerReport(snap, 'Low stock')
    expect(report.metric).toBe('available')
    expect(result.totals).toEqual({})
    expect(result.chart).toEqual([])
    expect(result.rows[0]?.values.product).toBe('Glide Mouse')
    expect(result.range).toMatchObject({ from: '2026-10-31', to: '2026-10-31' })
  })
})
