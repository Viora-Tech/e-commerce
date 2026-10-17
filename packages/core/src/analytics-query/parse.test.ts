import { describe, expect, test } from 'vitest'
import { formatQuery, parseQuery } from './parse'
import { STARTER_QUERY } from './schema'
import { suggest } from './suggest'

describe('parseQuery', () => {
  test('reads the starter query', () => {
    const r = parseQuery(STARTER_QUERY)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.query).toMatchObject({
      table: 'sales',
      show: ['net_sales', 'orders', 'average_order_value'],
      groupBy: 'state',
      compare: 'previous_period',
      orderBy: { field: 'net_sales', dir: 'desc' },
      limit: 10,
    })
  })

  test('points at the line and suggests the field', () => {
    const r = parseQuery('FROM sales\n  SHOW net_sale, orders')
    expect(r).toEqual({
      ok: false,
      error: { line: 2, message: 'Unknown field “net_sale”.', suggestion: 'net_sales' },
    })
  })

  test('refuses a dimension in SHOW and a number in GROUP BY', () => {
    expect(parseQuery('FROM sales SHOW state').ok).toBe(false)
    expect(parseQuery('FROM sales SHOW orders GROUP BY orders').ok).toBe(false)
  })

  test('only sorts by a field the query has', () => {
    expect(parseQuery('FROM sales SHOW orders ORDER BY net_sales').ok).toBe(false)
  })

  test('caps LIMIT', () => {
    expect(parseQuery('FROM sales SHOW orders LIMIT 5000').ok).toBe(false)
  })

  test('format round-trips', () => {
    const r = parseQuery('from products show net_quantity group by product_title limit 5')
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const again = parseQuery(formatQuery(r.query))
    expect(again.ok && again.query).toEqual(r.query)
  })
})

describe('suggest', () => {
  test('offers metrics after SHOW, filtered by what is typed', () => {
    const src = 'FROM sales SHOW net'
    expect(suggest(src, src.length).map((s) => s.value)).toEqual(['net_sales'])
  })

  test('offers dimensions after GROUP BY', () => {
    const src = 'FROM sales SHOW orders GROUP BY '
    expect(suggest(src, src.length).map((s) => s.value)).toContain('state')
  })
})
