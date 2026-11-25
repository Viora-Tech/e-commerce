import { parseAsInteger, parseAsString, parseAsStringLiteral } from 'nuqs'
import {
  DATE_CUSTOM,
  type DateFilterValue,
  type FilterGroup,
  type SelectGroup,
} from '@/components/table/filter-panel'
import type { TableSort } from '@/components/table/resource-table'
import type { filterPanelContent } from '@/data/filter-panel'
import type { gstListFiltersContent } from '@/data/gst-list-filters'
import { hasDateFilter, parseAsDateFilter } from '@/lib/date-filter'

/*
 * The GST invoices Queue and Invoices lists' state in the URL (search, view, filters, sort,
 * page), and how it becomes the API's input. The lists are filtered, sorted and paged on the
 * server (`gstInvoices.queue.list`, `gstInvoices.list`). GST days are India days, so date
 * filters are cut at midnight IST whatever the browser's clock says.
 */

/** The Date presets: GST is filed month by month, so this and last month come first. */
export const GST_DATE_PRESETS = ['this_month', 'last_month', '7d', '30d', '90d'] as const
type GstDatePreset = (typeof GST_DATE_PRESETS)[number]

export const QUEUE_VIEWS = ['ready', 'fix'] as const
export type QueueView = (typeof QUEUE_VIEWS)[number]
export const PAYMENTS = ['prepaid', 'cod'] as const
export const SOURCES = ['koomerce', 'external'] as const
export const DOC_STATUSES = ['issued', 'cancelled'] as const

/** The Invoices list's document type views (GST returns treat each apart). */
export const INVOICE_TABS = ['tax_invoice', 'credit_note', 'vouchers', 'exports', 'all'] as const
export type InvoiceTab = (typeof INVOICE_TABS)[number]

const QUEUE_SORT_IDS = ['date', 'number', 'taxable', 'gst'] as const
const INVOICE_SORT_IDS = ['date', 'number', 'total'] as const

/** Oldest due first, by day then order number: the order a batch is numbered in. */
export const QUEUE_DEFAULT_SORT: TableSort = { id: 'date', desc: false }
/** Newest invoice date first. */
export const INVOICE_DEFAULT_SORT: TableSort = { id: 'date', desc: true }

const DAY_MS = 86_400_000
const IST_MS = 330 * 60_000

/* Module scope, so the defaults keep one identity and the list effect runs once per change. */
const common = {
  query: parseAsString.withDefault(''),
  page: parseAsInteger.withDefault(1),
  gst: parseAsString,
  sort: parseAsString,
}

export const QUEUE_PARAMS = {
  ...common,
  view: parseAsStringLiteral(QUEUE_VIEWS),
  due: parseAsDateFilter(GST_DATE_PRESETS),
  payment: parseAsStringLiteral(PAYMENTS),
}

export const INVOICE_PARAMS = {
  ...common,
  tab: parseAsStringLiteral(INVOICE_TABS).withDefault('tax_invoice'),
  date: parseAsDateFilter(GST_DATE_PRESETS),
  source: parseAsStringLiteral(SOURCES),
  status: parseAsStringLiteral(DOC_STATUSES),
}

export type QueueQuery = {
  query: string
  page: number
  gst: string | null
  sort: string | null
  view: QueueView | null
  due: DateFilterValue
  payment: (typeof PAYMENTS)[number] | null
}

export type InvoiceQuery = {
  query: string
  page: number
  gst: string | null
  sort: string | null
  tab: InvoiceTab
  date: DateFilterValue
  source: (typeof SOURCES)[number] | null
  status: (typeof DOC_STATUSES)[number] | null
}

/** Every filter cleared, as URL patches (`null` drops the param). */
export const CLEAR_QUEUE_FILTERS = { due: null, gst: null, payment: null } as const
export const CLEAR_INVOICE_FILTERS = { date: null, gst: null, source: null, status: null } as const

/** Midnight IST at the start of a yyyy-mm-dd. */
const istDay = (day: string) => new Date(`${day}T00:00:00+05:30`)

/** Midnight IST on the first of the month `shift` months from the IST month of `now`. */
function istMonthStart(now: Date, shift: number): Date {
  const ist = new Date(now.getTime() + IST_MS)
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + shift, 1) - IST_MS)
}

const LOOK_BACK: Partial<Record<GstDatePreset, number>> = { '7d': 7, '30d': 30, '90d': 90 }

/** A date filter as an API window in IST: inclusive `from`, exclusive `to`, either open. */
export function istDateBounds(d: DateFilterValue, now = new Date()): { from?: Date; to?: Date } {
  if (!hasDateFilter(d) || d.preset === null) return {}
  if (d.preset === DATE_CUSTOM) {
    return {
      ...(d.from ? { from: istDay(d.from) } : {}),
      ...(d.to ? { to: new Date(istDay(d.to).getTime() + DAY_MS) } : {}),
    }
  }
  if (d.preset === 'this_month') return { from: istMonthStart(now, 0), to: istMonthStart(now, 1) }
  if (d.preset === 'last_month') return { from: istMonthStart(now, -1), to: istMonthStart(now, 0) }
  const days = LOOK_BACK[d.preset as GstDatePreset]
  return days ? { from: new Date(now.getTime() - days * DAY_MS) } : {}
}

/** `?sort=taxable.desc` as the table's sort, for these columns only; else null (the default). */
export function parseSort(param: string | null, ids: readonly string[]): TableSort | null {
  const match = /^([a-z]+)\.(asc|desc)$/.exec(param ?? '')
  return match?.[1] && ids.includes(match[1]) ? { id: match[1], desc: match[2] === 'desc' } : null
}

/** The table's sort as `?sort=`; the default sort leaves the URL clean. */
export function sortParam(sort: TableSort | null, fallback: TableSort): string | null {
  if (!sort || (sort.id === fallback.id && sort.desc === fallback.desc)) return null
  return `${sort.id}.${sort.desc ? 'desc' : 'asc'}`
}

export const parseQueueSort = (param: string | null) => parseSort(param, QUEUE_SORT_IDS)
export const parseInvoiceSort = (param: string | null) => parseSort(param, INVOICE_SORT_IDS)

/** The sort as the API takes it; the default is left out. */
function apiSort<I extends string>(sort: TableSort | null) {
  return sort ? { sort: { by: sort.id as I, desc: sort.desc } } : {}
}

/** The URL as `gstInvoices.queue.list` input. */
export function queueInput(q: QueueQuery, perPage: number, now = new Date()) {
  const window = istDateBounds(q.due, now)
  return {
    page: q.page,
    perPage,
    ...(q.query.trim() ? { q: q.query.trim() } : {}),
    ...(q.view ? { view: q.view } : {}),
    ...(q.gst ? { gstRegistrationId: q.gst } : {}),
    ...(q.payment ? { payment: q.payment } : {}),
    ...window,
    ...apiSort<(typeof QUEUE_SORT_IDS)[number]>(parseQueueSort(q.sort)),
  }
}

/** Which kinds each Invoices view lists; Exports and All list every kind. */
const TAB_KINDS = {
  tax_invoice: ['tax_invoice'],
  credit_note: ['credit_note'],
  vouchers: ['receipt_voucher', 'refund_voucher'],
  exports: undefined,
  all: undefined,
} as const

/** The Invoices list's filter (also what "select all matching" bulk actions work on). */
export function invoiceFilter(q: InvoiceQuery, now = new Date()) {
  const kinds = TAB_KINDS[q.tab]
  return {
    ...(q.query.trim() ? { q: q.query.trim() } : {}),
    ...(kinds ? { kind: [...kinds] } : {}),
    ...(q.tab === 'exports' ? { exportsOnly: true } : {}),
    ...(q.gst ? { gstRegistrationId: q.gst } : {}),
    ...(q.source ? { source: q.source } : {}),
    ...(q.status ? { status: q.status } : {}),
    ...istDateBounds(q.date, now),
  }
}

/** The URL as `gstInvoices.list` input. */
export function invoiceInput(q: InvoiceQuery, perPage: number, now = new Date()) {
  return {
    ...invoiceFilter(q, now),
    page: q.page,
    perPage,
    ...apiSort<(typeof INVOICE_SORT_IDS)[number]>(parseInvoiceSort(q.sort)),
  }
}

type Copy = typeof gstListFiltersContent
type Panel = typeof filterPanelContent

/** A store GST number, as the GSTIN filter lists it. */
export type GstNumberOption = { id: string; gstin: string; stateName: string | null }

function dateFilter(
  key: string,
  label: string,
  value: DateFilterValue,
  onChange: (next: DateFilterValue) => void,
  copy: Copy,
  panel: Panel,
): FilterGroup {
  return {
    key,
    label,
    type: 'date',
    presets: GST_DATE_PRESETS.map((p) => ({ value: p, label: copy.presets[p] })),
    value,
    onChange,
    anyLabel: panel.anyDate,
  }
}

/** The GST number filter: only for a store with more than one. */
function gstFilter(
  value: string | null,
  numbers: GstNumberOption[],
  onChange: (gst: string | null) => void,
  copy: Copy,
): SelectGroup[] {
  if (numbers.length < 2) return []
  return [
    {
      key: 'gst',
      label: copy.filters.gstin,
      type: 'select',
      options: numbers.map((n) => ({
        value: n.id,
        label: copy.filters.gstOption(n.stateName ?? '', n.gstin),
      })),
      value,
      onChange,
      anyLabel: copy.filters.anyGstin,
    },
  ]
}

function selectFilter<V extends string>(
  key: string,
  label: string,
  values: readonly V[],
  labels: Record<V, string>,
  value: V | null,
  onChange: (next: V | null) => void,
  anyLabel: string,
): SelectGroup {
  return {
    key,
    label,
    type: 'select',
    options: values.map((v) => ({ value: v, label: labels[v] })),
    value,
    onChange: (next) => onChange(values.find((v) => v === next) ?? null),
    anyLabel,
  }
}

/** The Queue's Filter menu: order date, GST number (several only) and payment. */
export function queueFilterGroups(
  q: QueueQuery,
  copy: Copy,
  panel: Panel,
  numbers: GstNumberOption[],
  onChange: (patch: Partial<Pick<QueueQuery, 'due' | 'gst' | 'payment'>>) => void,
): FilterGroup[] {
  const f = copy.filters
  return [
    dateFilter('due', f.due, q.due, (due) => onChange({ due }), copy, panel),
    ...gstFilter(q.gst, numbers, (gst) => onChange({ gst }), copy),
    selectFilter(
      'payment',
      f.payment,
      PAYMENTS,
      f.payments,
      q.payment,
      (payment) => onChange({ payment }),
      f.anyPayment,
    ),
  ]
}

/** The Invoices Filter menu: invoice date, GST number (several only), source and status. */
export function invoiceFilterGroups(
  q: InvoiceQuery,
  copy: Copy,
  panel: Panel,
  numbers: GstNumberOption[],
  onChange: (patch: Partial<Pick<InvoiceQuery, 'date' | 'gst' | 'source' | 'status'>>) => void,
): FilterGroup[] {
  const f = copy.filters
  return [
    dateFilter('date', f.invoiceDate, q.date, (date) => onChange({ date }), copy, panel),
    ...gstFilter(q.gst, numbers, (gst) => onChange({ gst }), copy),
    selectFilter(
      'source',
      f.source,
      SOURCES,
      f.sources,
      q.source,
      (source) => onChange({ source }),
      f.anySource,
    ),
    selectFilter(
      'status',
      f.status,
      DOC_STATUSES,
      f.statuses,
      q.status,
      (status) => onChange({ status }),
      f.anyStatus,
    ),
  ]
}
