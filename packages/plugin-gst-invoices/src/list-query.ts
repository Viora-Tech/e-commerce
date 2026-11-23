/**
 * SOURCE OF TRUTH: the GST invoices lists' search, payment filter and sort (Queue and Invoices
 * pages, owner 23 Nov 2026). The SQL pieces here are what `listQueue` and `listDocuments` add to
 * their WHERE and ORDER BY; the keys (`documentDateKey`, `documentNumberKey`) are the same order
 * as numbers, so the admin table's sort of a loaded page agrees with the server's.
 */
import { order } from '@commerce/db'
import { asc, desc, ilike, or, type SQL, sql } from 'drizzle-orm'
import { invoice } from './schema'

/** Cash on delivery, or paid before shipping (every other stored payment method). */
export const PAYMENT_FILTERS = ['cod', 'prepaid'] as const
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]

/** Where a document came from: issued here, or recorded as invoiced outside Koomerce. */
export const DOCUMENT_SOURCES = ['koomerce', 'external'] as const
export type DocumentSource = (typeof DOCUMENT_SOURCES)[number]

/** The Invoices list's sortable columns: invoice date, number and amount (total). */
export const DOCUMENT_SORTS = ['date', 'number', 'total'] as const
export type DocumentSort = { by: (typeof DOCUMENT_SORTS)[number]; desc: boolean }

/** Today's Invoices order: newest invoice date first. */
const DEFAULT_DOCUMENT_SORT: DocumentSort = { by: 'date', desc: true }

/** Search as typed. "#1042" or "1042" also matches order number 1042 exactly. */
export function searchTerms(q: string | undefined): { text: string; number: number | null } | null {
  const text = q?.trim() ?? ''
  if (!text) return null
  const digits = /^#?\s*(\d{1,9})$/.exec(text)
  return { text, number: digits?.[1] ? Number(digits[1]) : null }
}

/** `%text%` for ILIKE, with the user's own `%`, `_` and `\` matched literally. */
const containsPattern = (text: string) => `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`

const orderNumberIs = (n: number) =>
  sql`exists (select 1 from ${order} where ${order.id} = ${invoice.orderId} and ${order.number} = ${n})`

const orderNameLike = (pattern: string) =>
  sql`${invoice.snapshot}->'order'->>'name' ilike ${pattern}`

/** The Queue's search: the order number (or its printed name) or the customer's name. */
export function queueSearch(q: string | undefined): SQL | undefined {
  const t = searchTerms(q)
  if (!t) return undefined
  const pattern = containsPattern(t.text)
  return or(
    ilike(invoice.buyerName, pattern),
    orderNameLike(pattern),
    t.number === null ? undefined : orderNumberIs(t.number),
  )
}

/** The Invoices search: the invoice number, the order number or name, the buyer or their GSTIN. */
export function documentSearch(q: string | undefined): SQL | undefined {
  const t = searchTerms(q)
  if (!t) return undefined
  const pattern = containsPattern(t.text)
  return or(
    ilike(invoice.number, pattern),
    ilike(invoice.buyerName, pattern),
    ilike(invoice.buyerGstin, pattern),
    orderNameLike(pattern),
    t.number === null ? undefined : orderNumberIs(t.number),
  )
}

/** The order was paid cash on delivery (`cod`) or before it shipped (`prepaid`). */
export function paymentCondition(payment: PaymentFilter | undefined): SQL | undefined {
  if (!payment) return undefined
  const method =
    payment === 'cod'
      ? sql`${order.paymentMethod} = 'cod'`
      : sql`coalesce(${order.paymentMethod}, '') <> 'cod'`
  return sql`exists (select 1 from ${order} where ${order.id} = ${invoice.orderId} and ${method})`
}

/** The invoice date as a number; 0 when there is none (recorded without details). */
export const documentDateKey = (r: { invoiceDate: Date | null }) => r.invoiceDate?.getTime() ?? 0

/**
 * The number's place in its financial year as one number (2026 and seq 12: 2026000012); 0 for
 * documents without a number (packing slips, recorded without details).
 */
export const documentNumberKey = (r: { fyStartYear: number | null; seq: number | null }) =>
  r.fyStartYear !== null && r.seq !== null ? r.fyStartYear * 1_000_000 + r.seq : 0

const NUMBER_KEY = sql`coalesce(${invoice.fyStartYear}::bigint * 1000000 + ${invoice.seq}, 0)`
const DATE_KEY = sql`coalesce(${invoice.invoiceDate}, 'epoch'::timestamptz)`

/**
 * ORDER BY for the Invoices list. A missing date or number sorts as the smallest (0 in the keys
 * above): last when newest first, first when oldest first. Ties fall back to the number, then id.
 */
export function documentOrderBy(sort: DocumentSort = DEFAULT_DOCUMENT_SORT): SQL[] {
  const dir = (s: SQL) => (sort.desc ? desc(s) : asc(s))
  const id = dir(sql`${invoice.id}`)
  if (sort.by === 'number') return [dir(NUMBER_KEY), dir(DATE_KEY), id]
  if (sort.by === 'total') return [dir(sql`${invoice.totalPaise}`), dir(DATE_KEY), id]
  return [dir(DATE_KEY), dir(NUMBER_KEY), id]
}
