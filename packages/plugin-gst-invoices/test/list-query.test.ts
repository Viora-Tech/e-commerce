import { PgDialect } from 'drizzle-orm/pg-core'
import { describe, expect, it } from 'vitest'
import {
  documentDateKey,
  documentNumberKey,
  documentOrderBy,
  documentSearch,
  paymentCondition,
  queueSearch,
  searchTerms,
} from '../src/list-query'
import { arrangeQueue, type QueueSortable, queueDateKey } from '../src/queue-arrange'

const dialect = new PgDialect()
const compile = (s: Parameters<PgDialect['sqlToQuery']>[0]) => dialect.sqlToQuery(s)

describe('list search', () => {
  it('reads an order number with or without #', () => {
    expect(searchTerms('#1042')).toEqual({ text: '#1042', number: 1042 })
    expect(searchTerms(' 1042 ')).toEqual({ text: '1042', number: 1042 })
    expect(searchTerms('Asha')).toEqual({ text: 'Asha', number: null })
    expect(searchTerms('   ')).toBeNull()
    expect(searchTerms(undefined)).toBeNull()
  })

  it('matches the user’s % and _ literally', () => {
    expect(compile(queueSearch('50%_off') as never).params[0]).toBe('%50\\%\\_off%')
  })

  it('queue search: customer name, order name and the exact order number', () => {
    expect(queueSearch('')).toBeUndefined()
    const byName = compile(queueSearch('Asha') as never)
    expect(byName.sql).toContain('"buyer_name" ilike')
    expect(byName.sql).toContain(`->'order'->>'name' ilike`)
    expect(byName.sql).not.toContain('"number" =')
    expect(byName.params).toEqual(['%Asha%', '%Asha%'])
    const byNumber = compile(queueSearch('#1042') as never)
    expect(byNumber.sql).toContain('"order"."number" =')
    expect(byNumber.params).toContain(1042)
  })

  it('invoice search adds the invoice number and the buyer GSTIN', () => {
    const q = compile(documentSearch('INV/12') as never)
    expect(q.sql).toContain('"invoice"."number" ilike')
    expect(q.sql).toContain('"buyer_gstin" ilike')
    expect(q.params.filter((p) => p === '%INV/12%')).toHaveLength(4)
  })
})

describe('payment filter', () => {
  it('splits cash on delivery from every other method', () => {
    expect(paymentCondition(undefined)).toBeUndefined()
    expect(compile(paymentCondition('cod') as never).sql).toContain(`"payment_method" = 'cod'`)
    expect(compile(paymentCondition('prepaid') as never).sql).toContain(
      `coalesce("order"."payment_method", '') <> 'cod'`,
    )
  })
})

describe('invoice sort', () => {
  const orderSql = (sort?: Parameters<typeof documentOrderBy>[0]) =>
    documentOrderBy(sort).map((s) => compile(s).sql)

  it('defaults to newest invoice date first, then number', () => {
    const [date, number, id] = orderSql()
    expect(date).toMatch(/coalesce\("invoice"\."invoice_date", 'epoch'::timestamptz\) desc/)
    expect(number).toMatch(/fy_start_year.*desc/)
    expect(id).toMatch(/"invoice"\."id" desc/)
  })

  it('sorts by number or total in the asked direction', () => {
    expect(orderSql({ by: 'number', desc: false })[0]).toMatch(/fy_start_year.*seq.* asc/)
    expect(orderSql({ by: 'total', desc: true })[0]).toMatch(/"total_paise" desc/)
  })

  it('keys: a missing date or number is 0, the smallest, as in the SQL', () => {
    expect(documentDateKey({ invoiceDate: null })).toBe(0)
    expect(documentDateKey({ invoiceDate: new Date(5) })).toBe(5)
    expect(documentNumberKey({ fyStartYear: 2026, seq: 12 })).toBe(2026000012)
    expect(documentNumberKey({ fyStartYear: 2026, seq: null })).toBe(0)
    expect(documentNumberKey({ fyStartYear: 2025, seq: 999 })).toBeLessThan(
      documentNumberKey({ fyStartYear: 2026, seq: 1 }),
    )
  })
})

describe('queue arrange', () => {
  const row = (over: Partial<QueueSortable> & { id: string }) => ({
    status: 'ready' as QueueSortable['status'],
    orderNumber: 1,
    dueAt: new Date('2026-11-20T10:00:00+05:30'),
    taxablePaise: 100,
    gstPaise: 18,
    ...over,
  })
  const items = [
    row({ id: 'a', orderNumber: 1043, dueAt: new Date('2026-11-20T09:00:00+05:30') }),
    row({ id: 'b', orderNumber: 1042, dueAt: new Date('2026-11-20T18:00:00+05:30') }),
    row({
      id: 'c',
      orderNumber: 1040,
      dueAt: new Date('2026-11-21T00:30:00+05:30'),
      status: 'hsn_missing',
      taxablePaise: 900,
    }),
    row({ id: 'd', orderNumber: 1041, status: 'buyer_details', taxablePaise: 50, gstPaise: 90 }),
  ]
  const ids = (opts: Parameters<typeof arrangeQueue>[2]) =>
    arrangeQueue(items, (r) => r, opts).rows.map((r) => r.id)

  it('defaults to the numbering order: India day, then order number', () => {
    // b (1042) before a (1043) on the 20th whatever the hour; c is the 21st in India.
    expect(ids({ page: 1, perPage: 10 })).toEqual(['d', 'b', 'a', 'c'])
    expect(queueDateKey({ dueAt: null, orderNumber: 7 })).toBe(7)
  })

  it('sorts by number, taxable or GST either way', () => {
    expect(ids({ sort: { by: 'number', desc: true }, page: 1, perPage: 10 })).toEqual([
      'a',
      'b',
      'd',
      'c',
    ])
    expect(ids({ sort: { by: 'taxable', desc: true }, page: 1, perPage: 10 })[0]).toBe('c')
    expect(ids({ sort: { by: 'gst', desc: false }, page: 1, perPage: 10 }).at(-1)).toBe('d')
  })

  it('keeps one view and one page, with counts over every view', () => {
    const fix = arrangeQueue(items, (r) => r, { view: 'fix', page: 1, perPage: 1 })
    expect(fix.rows.map((r) => r.id)).toEqual(['d'])
    expect(fix.total).toBe(2)
    expect(fix.counts).toEqual({ all: 4, ready: 2, fix: 2, hsnMissing: 1 })
    expect(ids({ view: 'ready', page: 1, perPage: 10 })).toEqual(['b', 'a'])
    expect(ids({ page: 3, perPage: 2 })).toEqual([])
  })
})
