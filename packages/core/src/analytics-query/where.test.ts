/** SOURCE OF TRUTH: custom analytics query filter and range tests — WHAT: WHERE, HAVING, multi GROUP BY, DURING and range limits / WHY: filters are checked before the server binds them, and a range is refused rather than cut short */
import { describe, expect, test } from 'vitest'
import { setTable } from './controls'
import { formatQuery, type ParsedQuery, parseQuery } from './parse'
import { periodDays, queryDays, rangeProblem } from './period'
import { QUERY_EXAMPLES, queryLanguageReference } from './reference'
import { suggest } from './suggest'

// 15 Nov 2026, 10:00 IST (a Sunday).
const NOW = new Date('2026-11-15T04:30:00Z')

const parsed = (source: string): ParsedQuery => {
  const r = parseQuery(source, NOW)
  if (!r.ok) throw new Error(`${r.error.line}: ${r.error.message}`)
  return r.query
}
const problem = (source: string) => {
  const r = parseQuery(source, NOW)
  return r.ok ? null : r.error
}
const roundTrips = (source: string) => {
  const q = parsed(source)
  expect(parsed(formatQuery(q))).toEqual(q)
}

describe('WHERE', () => {
  test('reads a product filter with quotes and any case', () => {
    const q = parsed(
      "from products show net_quantity where product_title contains 'Waizowl TRIAINA' during all_time",
    )
    expect(q.where).toEqual({
      kind: 'compare',
      field: 'product_title',
      op: 'contains',
      values: ['Waizowl TRIAINA'],
    })
    expect(q.during).toBe('all_time')
    expect(q.groupBy).toEqual([])
  })

  test('AND binds tighter than OR, NOT tightest, brackets group', () => {
    const q = parsed(
      "FROM sales SHOW orders WHERE state = 'MH' OR state = 'KA' AND NOT channel = 'direct'",
    )
    expect(q.where).toEqual({
      kind: 'or',
      items: [
        { kind: 'compare', field: 'state', op: '=', values: ['MH'] },
        {
          kind: 'and',
          items: [
            { kind: 'compare', field: 'state', op: '=', values: ['KA'] },
            {
              kind: 'not',
              item: { kind: 'compare', field: 'channel', op: '=', values: ['direct'] },
            },
          ],
        },
      ],
    })
    const grouped = parsed(
      "FROM sales SHOW orders WHERE (state = 'MH' OR state = 'KA') AND payment_method != 'cod'",
    )
    expect(grouped.where?.kind).toBe('and')
  })

  test('IN, NOT IN, STARTS WITH, ENDS WITH and NOT CONTAINS', () => {
    const q = parsed(
      "FROM products SHOW net_quantity WHERE vendor IN ('Waizowl', 'Logitech') AND sku NOT IN ('A-1') AND variant_title STARTS WITH 'black' AND product_title ENDS WITH 'mouse' AND product_title NOT CONTAINS 'pad'",
    )
    expect(q.where?.kind).toBe('and')
    roundTrips(formatQuery(q))
  })

  test('round-trips through Format, quotes inside values included', () => {
    roundTrips(
      "FROM sales SHOW orders, net_sales WHERE customer_name = 'O''Brien' AND (source = 'instagram' OR NOT (channel IN ('social', 'paid_social') AND city CONTAINS 'pune')) GROUP BY state, channel HAVING orders >= 2 AND net_sales > 1500.5 DURING last_month ORDER BY orders DESC LIMIT 5",
    )
  })

  test('filter-only fields filter but never group', () => {
    expect(parsed("FROM products SHOW net_quantity WHERE collection = 'Mice'").where).toBeTruthy()
    expect(problem('FROM products SHOW net_quantity GROUP BY collection')?.message).toContain(
      'only filter',
    )
  })

  test('helpful errors: unknown field, metric in WHERE, bare text, unclosed quote', () => {
    expect(problem("FROM products SHOW net_quantity\n  WHERE product_titel = 'x'")).toEqual({
      line: 2,
      message: 'Unknown field “product_titel”.',
      suggestion: 'product_title',
    })
    expect(problem('FROM products SHOW net_quantity WHERE net_quantity > 5')?.message).toContain(
      'HAVING',
    )
    expect(problem('FROM products SHOW net_quantity WHERE vendor = Waizowl')?.message).toBe(
      "Put text in quotes, e.g. 'Waizowl'.",
    )
    expect(problem("FROM products SHOW net_quantity WHERE vendor = 'Waizowl")?.message).toContain(
      'Close the quote',
    )
    expect(problem("FROM sales SHOW orders WHERE state = 'MH' state = 'KA'")?.message).toContain(
      'AND or OR',
    )
    expect(
      problem("FROM sales SHOW orders WHERE state = 'MH' WHERE city = 'x'")?.message,
    ).toContain('twice')
  })

  test('SQL in a value stays a value', () => {
    const q = parsed(
      "FROM products SHOW net_quantity WHERE product_title = 'x''; DROP TABLE \"order\"; --'",
    )
    expect(q.where).toEqual({
      kind: 'compare',
      field: 'product_title',
      op: '=',
      values: [`x'; DROP TABLE "order"; --`],
    })
    // Anything outside quotes must be a known word, so it can never reach SQL.
    expect(problem('FROM products SHOW net_quantity WHERE 1=1')).not.toBeNull()
    expect(problem('FROM products; DROP TABLE x SHOW net_quantity')).not.toBeNull()
  })

  test('limits how big a condition can get', () => {
    const many = Array.from({ length: 21 }, (_, i) => `city = 'c${i}'`).join(' OR ')
    expect(problem(`FROM sales SHOW orders WHERE ${many}`)?.message).toContain('at most 20')
  })
})

describe('HAVING and GROUP BY', () => {
  test('groups by up to three fields', () => {
    expect(
      parsed('FROM products SHOW net_quantity GROUP BY product_title, variant_title').groupBy,
    ).toEqual(['product_title', 'variant_title'])
    expect(
      problem('FROM products SHOW net_quantity GROUP BY product_title, variant_title, sku, vendor')
        ?.message,
    ).toContain('at most 3')
  })

  test('HAVING takes metrics and numbers, and needs GROUP BY', () => {
    expect(parsed('FROM sales SHOW orders GROUP BY state HAVING orders > 3').having).toEqual({
      kind: 'compare',
      field: 'orders',
      op: '>',
      values: [3],
    })
    expect(problem('FROM sales SHOW orders HAVING orders > 3')?.message).toContain('GROUP BY')
    expect(problem("FROM sales SHOW orders GROUP BY state HAVING orders > 'x'")?.message).toContain(
      'number',
    )
    expect(problem("FROM sales SHOW orders GROUP BY state HAVING state = 'MH'")?.message).toContain(
      'WHERE',
    )
  })

  test('ORDER BY may name any grouped field', () => {
    expect(
      parsed('FROM products SHOW net_quantity GROUP BY product_title, month ORDER BY month ASC')
        .orderBy,
    ).toEqual({ field: 'month', dir: 'asc' })
  })

  test('switching table drops a filter the other table cannot read', () => {
    const q = parsed("FROM products SHOW orders WHERE collection = 'Mice' GROUP BY state")
    const sales = setTable(q, 'sales')
    expect(sales.where).toBeNull()
    expect(sales.groupBy).toEqual(['state'])
    const kept = setTable(parsed("FROM products SHOW orders WHERE state = 'MH'"), 'sales')
    expect(kept.where).toEqual({ kind: 'compare', field: 'state', op: '=', values: ['MH'] })
  })
})

describe('ranges', () => {
  test('DURING periods are calendar ranges in IST', () => {
    expect(periodDays('last_month', NOW)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodDays('this_month', NOW)).toEqual({ from: '2026-11-01', to: '2026-11-15' })
    expect(periodDays('this_week', NOW)).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(periodDays('last_week', NOW)).toEqual({ from: '2026-11-02', to: '2026-11-08' })
    expect(periodDays('last_quarter', NOW)).toEqual({ from: '2026-07-01', to: '2026-09-30' })
    expect(periodDays('this_year', NOW)).toEqual({ from: '2026-01-01', to: '2026-11-15' })
    expect(periodDays('last_year', NOW)).toEqual({ from: '2025-01-01', to: '2025-12-31' })
    expect(periodDays('this_financial_year', NOW)).toEqual({ from: '2026-04-01', to: '2026-11-15' })
    expect(periodDays('last_financial_year', NOW)).toEqual({
      from: '2025-04-01',
      to: '2026-03-31',
    })
    expect(periodDays('all_time', NOW, '2021-03-04')).toEqual({
      from: '2021-03-04',
      to: '2026-11-15',
    })
  })

  test('a long range is kept whole, never cut to a year', () => {
    const q = parsed('FROM sales SHOW orders SINCE 2020-01-01 UNTIL today')
    expect(queryDays(q, NOW)).toEqual({ from: '2020-01-01', to: '2026-11-15' })
    expect(queryDays(parsed('FROM sales SHOW orders SINCE -5y UNTIL today'), NOW).from).toBe(
      '2021-11-15',
    )
  })

  test('a backwards or over-long range is refused with a reason', () => {
    expect(problem('FROM sales SHOW orders SINCE 2026-10-01 UNTIL 2026-09-01')?.message).toContain(
      'after UNTIL',
    )
    expect(problem('FROM sales SHOW orders SINCE -21y UNTIL today')?.message).toContain('20 years')
    expect(problem('FROM sales SHOW orders SINCE -20y UNTIL today')).toBeNull()
    expect(rangeProblem({ from: '2026-01-01', to: '2026-01-01' })).toBeNull()
    expect(problem('FROM sales SHOW orders DURING last_month SINCE -3d')?.message).toContain(
      'not both',
    )
    expect(problem('FROM sales SHOW orders SINCE last_month')?.message).toBe(
      'Use DURING last_month for a named range.',
    )
  })
})

describe('reference and suggestions', () => {
  test('every example in the reference parses', () => {
    for (const e of QUERY_EXAMPLES) expect(problem(e.query), e.ask).toBeNull()
    expect(queryLanguageReference()).toContain('DURING all_time')
  })

  test('suggests filters after WHERE and AND, metrics after HAVING, ranges after DURING', () => {
    const w = 'FROM products SHOW net_quantity WHERE col'
    expect(suggest(w, w.length).map((s) => s.value)).toEqual(['collection'])
    const a = "FROM products SHOW net_quantity WHERE vendor = 'x' AND sk"
    expect(suggest(a, a.length).map((s) => s.value)).toEqual(['sku'])
    const h = 'FROM products SHOW net_quantity GROUP BY sku HAVING ret'
    expect(suggest(h, h.length).map((s) => s.value)).toEqual(['returned_quantity'])
    const d = 'FROM sales SHOW orders DURING last_'
    expect(suggest(d, d.length).map((s) => s.value)).toContain('last_month')
  })
})
