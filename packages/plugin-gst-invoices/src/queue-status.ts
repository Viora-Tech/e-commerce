/**
 * SOURCE OF TRUTH: queueStatus, queueRows, queueStats — WHAT the Queue page's per-row status
 * (Ready, Ready · B2B, HSN missing, …) and its four figures / WHY the page (Figma 928:10728)
 * shows what blocks each invoice before the merchant presses Issue, and the month at a glance.
 */
import { orderLine, product, type StoreTx, variant } from '@commerce/db'
import {
  counterYear,
  type DocumentSnapshot,
  DocumentSnapshotSchema,
  financialYear,
  formatSeriesNumber,
  hsnFor,
  type InvoiceSettings,
  pickSeries,
} from '@commerce/invoices'
import { and, eq, gte, inArray, lt, type SQL, sql } from 'drizzle-orm'
import { loadSettings } from './issue'
import { peekNext } from './next-number'
import { periodOf, periodRange } from './periods'
import { listQueue, type QueueFilter, rule46Missing } from './queue'
import { documentIssuer, gstToken, sameRegistration } from './registration'
import { invoice } from './schema'

/**
 * Ready ones can be issued as they are; the rest need fixing first. Order matters: the first
 * problem found is the one shown.
 */
const QUEUE_STATUSES = [
  'ready',
  'ready_b2b',
  'ready_export',
  'hsn_missing',
  'buyer_details',
] as const
export type QueueStatus = (typeof QUEUE_STATUSES)[number]

/** Where a row's problem is fixed: one product's page, or the order (buyer details). */
export type QueueFix = { kind: 'product'; productId: string } | { kind: 'order' } | null

export type QueueStatusInput = {
  /** The goods lines this draft bills, with today's HSN (order line, else variant, else product). */
  lines: readonly { hsn: string | null; productId: string | null }[]
  /** Settings › Default HSN: printed on lines without their own, so they are not missing. */
  defaultHsn: string
  hsnDigits: number
  buyerGstin: string | null
  /** An export (shipped outside India). */
  exported: boolean
  /** What rule 46 still needs from the buyer (≥ ₹50,000 to an unregistered buyer). */
  buyerMissing: readonly string[]
}

/** A queued draft's status and where to fix it. Pure: the rules, tested on their own. */
export function queueStatus(input: QueueStatusInput): { status: QueueStatus; fix: QueueFix } {
  const noHsn = input.lines.find((l) => !hsnFor(l.hsn, input.defaultHsn, input.hsnDigits))
  if (noHsn) {
    return {
      status: 'hsn_missing',
      fix: noHsn.productId ? { kind: 'product', productId: noHsn.productId } : { kind: 'order' },
    }
  }
  if (input.buyerMissing.length) return { status: 'buyer_details', fix: { kind: 'order' } }
  if (input.exported) return { status: 'ready_export', fix: null }
  if (input.buyerGstin) return { status: 'ready_b2b', fix: null }
  return { status: 'ready', fix: null }
}

/** "Mumbai, Maharashtra": the city and state of the place the goods go, without the PIN. */
export function buyerPlace(doc: DocumentSnapshot): string {
  const party = doc.shipTo ?? doc.buyer
  const last = party.address.at(-1) ?? ''
  const parts = last
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p && !/^\d{6}$/.test(p))
  if (parts.length) return parts.join(', ')
  return party.state?.name ?? ''
}

type LineHsn = {
  orderId: string
  orderLineId: string
  hsn: string | null
  productId: string | null
}

/** Today's HSN of every line of these orders: the line's own, else its variant's, else its product's. */
async function currentLineHsn(tx: StoreTx, orderIds: readonly string[]): Promise<LineHsn[]> {
  if (orderIds.length === 0) return []
  return tx
    .select({
      orderId: orderLine.orderId,
      orderLineId: orderLine.id,
      hsn: sql<
        string | null
      >`coalesce(nullif(${orderLine.hsCode}, ''), nullif(${variant.hsCode}, ''), nullif(${product.hsCode}, ''))`,
      productId: product.id,
    })
    .from(orderLine)
    .leftJoin(variant, eq(variant.id, orderLine.variantId))
    .leftJoin(product, eq(product.id, variant.productId))
    .where(and(inArray(orderLine.orderId, [...orderIds]), eq(orderLine.giftCard, false)))
}

/** The queue with each draft's taxable value, GST and status (Figma 928:10728). */
export async function queueRows(tx: StoreTx, storeId: string, filter: QueueFilter) {
  const rows = await listQueue(tx, filter)
  const settings = await loadSettings(tx, storeId)
  const lines = await currentLineHsn(tx, [...new Set(rows.map((r) => r.orderId))])
  const byOrder = new Map<string, LineHsn[]>()
  for (const l of lines) byOrder.set(l.orderId, [...(byOrder.get(l.orderId) ?? []), l])
  return rows.map((r) => {
    const doc = DocumentSnapshotSchema.parse(r.snapshot)
    // A parcel's draft bills only its own lines; older drafts without line ids bill them all.
    const billed = new Set(doc.lines.flatMap((l) => (l.orderLineId ? [l.orderLineId] : [])))
    const own = (byOrder.get(r.orderId) ?? []).filter(
      (l) => billed.size === 0 || billed.has(l.orderLineId),
    )
    const { status, fix } = queueStatus({
      lines: own,
      defaultHsn: settings.defaultHsn,
      hsnDigits: settings.hsnDigits,
      buyerGstin: r.buyerGstin,
      exported: doc.exportSupply !== null && doc.exportSupply !== undefined,
      buyerMissing: rule46Missing(doc),
    })
    return { row: r, doc, status, fix }
  })
}

/** One GSTIN when picked (null: a store without one); every GSTIN when undefined. */
const gstFilter = (gst: string | null | undefined): SQL | undefined =>
  gst === undefined ? undefined : sameRegistration(invoice.gstRegistrationId, gst)

/** The domestic tax invoice series: what an ordinary order is numbered from. */
function mainInvoiceSeries(settings: InvoiceSettings) {
  return pickSeries(settings.series, 'tax_invoice', { export: false, b2b: false })
}

/** 1 April after `now` (midnight IST), when a yearly series starts again at 1. */
export function nextReset(now: Date): Date {
  const fy = financialYear(now)
  return periodRange(`${fy.startYear + 1}-04`).from
}

export type QueueStats = {
  issued: { count: number; taxablePaise: number }
  creditNotes: { count: number; totalPaise: number }
  /** What the next ordinary tax invoice will print, and when its series starts again (null: never). */
  next: { number: string; resetsAt: Date | null } | null
}

/**
 * The Queue page's figures for this IST month: tax invoices issued (cancelled ones left out)
 * and their taxable value, credit notes and their value, and the next number. `gst` undefined
 * counts every GSTIN; `numberGst` is the GSTIN whose next number shows (the picked or default).
 */
export async function queueStats(
  tx: StoreTx,
  storeId: string,
  gst: string | null | undefined,
  numberGst: string | null,
  now = new Date(),
): Promise<QueueStats> {
  const { from, to } = periodRange(periodOf(now))
  const month = (kind: 'tax_invoice' | 'credit_note') =>
    and(
      eq(invoice.kind, kind),
      eq(invoice.status, 'issued'),
      gte(invoice.invoiceDate, from),
      lt(invoice.invoiceDate, to),
      gstFilter(gst),
    )
  const [issued] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      taxable: sql<number>`coalesce(sum(${invoice.taxablePaise}), 0)::bigint`,
    })
    .from(invoice)
    .where(month('tax_invoice'))
  const [notes] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      total: sql<number>`coalesce(sum(abs(${invoice.totalPaise})), 0)::bigint`,
    })
    .from(invoice)
    .where(month('credit_note'))
  const settings = await loadSettings(tx, storeId)
  const series = mainInvoiceSeries(settings)
  let next: QueueStats['next'] = null
  if (series) {
    const fy = financialYear(now)
    const issuer = await documentIssuer(tx, numberGst)
    const seq = await peekNext(tx, numberGst, series.id, counterYear(series, fy))
    next = {
      number: formatSeriesNumber(series, fy, seq, gstToken(issuer, settings)),
      resetsAt: series.resetEachYear === false ? null : nextReset(now),
    }
  }
  return {
    issued: { count: Number(issued?.count ?? 0), taxablePaise: Number(issued?.taxable ?? 0) },
    creditNotes: { count: Number(notes?.count ?? 0), totalPaise: Number(notes?.total ?? 0) },
    next,
  }
}
