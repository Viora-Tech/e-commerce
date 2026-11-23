import { createSerializer } from 'nuqs'
import { describe, expect, it } from 'vitest'
import { DATE_CUSTOM } from '@/components/table/filter-panel'
import { filterPanelContent } from '@/data/filter-panel'
import { gstListFiltersContent } from '@/data/gst-list-filters'
import { NO_DATE_FILTER } from '@/lib/date-filter'
import {
  INVOICE_DEFAULT_SORT,
  INVOICE_PARAMS,
  type InvoiceQuery,
  invoiceFilterGroups,
  invoiceInput,
  istDateBounds,
  parseInvoiceSort,
  parseQueueSort,
  QUEUE_DEFAULT_SORT,
  QUEUE_PARAMS,
  type QueueQuery,
  queueFilterGroups,
  queueInput,
  sortParam,
} from './gst-list-filters'

/* 23 Nov 2026, 02:00 IST is still 22 Nov in UTC: the month and day cuts must follow India. */
const now = new Date('2026-11-22T20:30:00Z')

const queue: QueueQuery = {
  query: '',
  page: 1,
  gst: null,
  sort: null,
  view: null,
  due: NO_DATE_FILTER,
  payment: null,
}
const invoices: InvoiceQuery = {
  query: '',
  page: 1,
  gst: null,
  sort: null,
  tab: 'tax_invoice',
  date: NO_DATE_FILTER,
  source: null,
  status: null,
}

describe('IST date bounds', () => {
  it('this and last month run from midnight IST on the 1st', () => {
    expect(istDateBounds({ preset: 'this_month', from: '', to: '' }, now)).toEqual({
      from: new Date('2026-11-01T00:00:00+05:30'),
      to: new Date('2026-12-01T00:00:00+05:30'),
    })
    expect(istDateBounds({ preset: 'last_month', from: '', to: '' }, now)).toEqual({
      from: new Date('2026-10-01T00:00:00+05:30'),
      to: new Date('2026-11-01T00:00:00+05:30'),
    })
  })

  it('a custom range ends after its last IST day; either end may be open', () => {
    expect(istDateBounds({ preset: DATE_CUSTOM, from: '2026-11-03', to: '2026-11-05' })).toEqual({
      from: new Date('2026-11-03T00:00:00+05:30'),
      to: new Date('2026-11-06T00:00:00+05:30'),
    })
    expect(istDateBounds({ preset: DATE_CUSTOM, from: '', to: '2026-11-05' })).toEqual({
      to: new Date('2026-11-06T00:00:00+05:30'),
    })
    expect(istDateBounds(NO_DATE_FILTER)).toEqual({})
  })

  it('look-back presets start N days ago and stay open', () => {
    expect(istDateBounds({ preset: '7d', from: '', to: '' }, now)).toEqual({
      from: new Date(now.getTime() - 7 * 86_400_000),
    })
  })
})

describe('sort in the URL', () => {
  it('reads only the list’s own columns', () => {
    expect(parseQueueSort('taxable.desc')).toEqual({ id: 'taxable', desc: true })
    expect(parseQueueSort('total.desc')).toBeNull()
    expect(parseInvoiceSort('total.asc')).toEqual({ id: 'total', desc: false })
    expect(parseInvoiceSort('nonsense')).toBeNull()
  })

  it('the default sort leaves the URL clean', () => {
    expect(sortParam(QUEUE_DEFAULT_SORT, QUEUE_DEFAULT_SORT)).toBeNull()
    expect(sortParam({ id: 'date', desc: true }, QUEUE_DEFAULT_SORT)).toBe('date.desc')
    expect(sortParam(null, INVOICE_DEFAULT_SORT)).toBeNull()
  })

  it('the params serialise to a readable query', () => {
    const queueUrl = createSerializer(QUEUE_PARAMS)
    expect(
      queueUrl({
        view: 'fix',
        payment: 'cod',
        sort: 'gst.desc',
        due: { preset: '7d', from: '', to: '' },
      }),
    ).toBe('?sort=gst.desc&view=fix&due=7d&payment=cod')
    const invoiceUrl = createSerializer(INVOICE_PARAMS)
    expect(
      invoiceUrl({
        tab: 'credit_note',
        source: 'external',
        date: { preset: DATE_CUSTOM, from: '2026-11-01', to: '' },
      }),
    ).toBe('?tab=credit_note&date=custom:2026-11-01..&source=external')
  })
})

describe('API input', () => {
  it('queue: only what is set, and the default sort is left out', () => {
    expect(queueInput(queue, 25, now)).toEqual({ page: 1, perPage: 25 })
    expect(
      queueInput(
        {
          ...queue,
          query: ' 1042 ',
          view: 'ready',
          gst: 'g1',
          payment: 'prepaid',
          sort: 'number.desc',
          due: { preset: 'this_month', from: '', to: '' },
        },
        50,
        now,
      ),
    ).toEqual({
      page: 1,
      perPage: 50,
      q: '1042',
      view: 'ready',
      gstRegistrationId: 'g1',
      payment: 'prepaid',
      from: new Date('2026-11-01T00:00:00+05:30'),
      to: new Date('2026-12-01T00:00:00+05:30'),
      sort: { by: 'number', desc: true },
    })
  })

  it('invoices: the tab becomes kinds (Exports: every kind, exports only)', () => {
    expect(invoiceInput(invoices, 25, now)).toEqual({ kind: ['tax_invoice'], page: 1, perPage: 25 })
    expect(invoiceInput({ ...invoices, tab: 'vouchers' }, 25, now).kind).toEqual([
      'receipt_voucher',
      'refund_voucher',
    ])
    expect(
      invoiceInput(
        { ...invoices, tab: 'exports', status: 'cancelled', source: 'koomerce' },
        10,
        now,
      ),
    ).toEqual({ exportsOnly: true, status: 'cancelled', source: 'koomerce', page: 1, perPage: 10 })
  })
})

describe('filter groups', () => {
  const one = [{ id: 'g1', gstin: '27AAAAA0000A1Z5', stateName: 'Maharashtra' }]
  const two = [...one, { id: 'g2', gstin: '29AAAAA0000A1Z5', stateName: 'Karnataka' }]
  const keys = (groups: { key: string }[]) => groups.map((g) => g.key)

  it('shows GST number only for a store with more than one', () => {
    const noop = () => undefined
    const c = gstListFiltersContent
    const p = filterPanelContent
    expect(keys(queueFilterGroups(queue, c, p, one, noop))).toEqual(['due', 'payment'])
    expect(keys(queueFilterGroups(queue, c, p, two, noop))).toEqual(['due', 'gst', 'payment'])
    expect(keys(invoiceFilterGroups(invoices, c, p, two, noop))).toEqual([
      'date',
      'gst',
      'source',
      'status',
    ])
  })

  it('a select change patches the URL field, unknown values clear it', () => {
    const patches: unknown[] = []
    const groups = queueFilterGroups(queue, gstListFiltersContent, filterPanelContent, [], (p) =>
      patches.push(p),
    )
    const payment = groups.find((g) => g.key === 'payment')
    if (payment?.type !== 'select') throw new Error('payment is a select')
    payment.onChange('cod')
    payment.onChange('cheque')
    expect(patches).toEqual([{ payment: 'cod' }, { payment: null }])
  })
})
