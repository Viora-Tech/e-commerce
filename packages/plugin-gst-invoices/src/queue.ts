import { order, orderLine, type StoreTx } from '@commerce/db'
import {
  counterYear,
  type DocumentSnapshot,
  DocumentSnapshotSchema,
  financialYear,
  formatSeriesNumber,
  isEligible,
  nextNumberProblem,
  pickSeries,
  type Series,
} from '@commerce/invoices'
import { and, asc, desc, eq, gte, inArray, lt, type SQL, sql } from 'drizzle-orm'
import {
  existing,
  InvoiceError,
  type InvoiceRow,
  insertDocument,
  loadSettings,
  orderSnapshot,
  seriesContextOf,
  takeNumber,
  totalsColumns,
  writeLines,
} from './issue'
import { assertPeriodOpen, PeriodError } from './periods'
import { invoice, invoiceSequence } from './schema'

/**
 * The invoice queue. Orders wait here as unnumbered drafts; a GST number is
 * assigned only when the merchant issues, in the order of the invoice dates
 * they confirm. Nothing ties a number to the order id or the order date, so
 * pre-orders and late dispatches never force renumbering.
 */

export type QueueReason = 'paid' | 'fulfilled' | 'manual'

/**
 * Gift card sales are vouchers under GST: no supply of goods at issue, tax is
 * due on redemption (on the order that spends the card). Checkout keeps gift
 * cards in orders of their own, so such an order is never invoiced.
 */
export async function soldOnlyGiftCards(tx: StoreTx, orderId: string): Promise<boolean> {
  const lines = await tx
    .select({ giftCard: orderLine.giftCard })
    .from(orderLine)
    .where(eq(orderLine.orderId, orderId))
  return lines.length > 0 && lines.every((l) => l.giftCard)
}

/** Orders tagged as pre-orders (tag set in settings) are invoiced at dispatch. */
export async function isPreorder(tx: StoreTx, orderId: string, tag: string): Promise<boolean> {
  const [o] = await tx.select({ tags: order.tags }).from(order).where(eq(order.id, orderId))
  return (o?.tags ?? []).some((t) => t.trim().toLowerCase() === tag)
}

/**
 * Put an order in the queue when the rule says it is due (or when the
 * merchant adds it by hand). Idempotent: an order has at most one live tax
 * invoice, draft or issued. A dispatch on an existing draft records the
 * dispatch date, which becomes the default invoice date.
 */
export async function enqueueOrder(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  reason: QueueReason,
  at: Date = new Date(),
): Promise<{ row: InvoiceRow; created: boolean } | null> {
  const settings = await loadSettings(tx, storeId)
  if (await soldOnlyGiftCards(tx, orderId)) {
    if (reason === 'manual') {
      throw new InvoiceError(
        'invalid',
        'This order only sold gift cards. A gift card is a voucher: GST is charged when it is redeemed, so there is no tax invoice at sale.',
      )
    }
    return null
  }
  const prior = await existing(tx, orderId, 'tax_invoice')
  if (prior) {
    if (reason === 'fulfilled' && prior.status === 'draft' && !prior.dispatchedAt) {
      const [row] = await tx
        .update(invoice)
        .set({ dispatchedAt: at, eligibleAt: prior.eligibleAt ?? at, updatedAt: new Date() })
        .where(eq(invoice.id, prior.id))
        .returning()
      return { row: row ?? prior, created: false }
    }
    return { row: prior, created: false }
  }
  if (reason !== 'manual') {
    if (reason === 'paid' || reason === 'fulfilled') {
      const pre = await isPreorder(tx, orderId, settings.preorderTag)
      if (!isEligible(settings, reason, pre)) return null
    }
  } else if (!settings.documents.tax_invoice.enabled) {
    throw new InvoiceError('disabled', 'Tax invoices are switched off in the GST invoices settings')
  }
  const draft = await orderSnapshot(
    tx,
    storeId,
    orderId,
    'tax_invoice',
    null,
    at,
    settings,
    undefined,
  )
  const row = await insertDocument(tx, storeId, draft, {
    status: 'draft',
    eligibleAt: at,
    dispatchedAt: reason === 'fulfilled' ? at : null,
  })
  if (!row) {
    const raced = await existing(tx, orderId, 'tax_invoice')
    return raced ? { row: raced, created: false } : null
  }
  return { row, created: true }
}

/** Take an order out of the queue. Only drafts: an issued number is never deleted. */
export async function removeFromQueue(tx: StoreTx, ids: readonly string[]): Promise<number> {
  if (ids.length === 0) return 0
  const gone = await tx
    .delete(invoice)
    .where(and(inArray(invoice.id, [...ids]), eq(invoice.status, 'draft')))
    .returning({ id: invoice.id })
  return gone.length
}

export type QueueFilter = { from?: Date | undefined; to?: Date | undefined; q?: string | undefined }

export async function listQueue(tx: StoreTx, filter: QueueFilter) {
  const conds: (SQL | undefined)[] = [
    eq(invoice.kind, 'tax_invoice'),
    eq(invoice.status, 'draft'),
    filter.from ? gte(invoice.eligibleAt, filter.from) : undefined,
    filter.to ? lt(invoice.eligibleAt, filter.to) : undefined,
  ]
  return tx
    .select()
    .from(invoice)
    .where(and(...conds))
    .orderBy(asc(invoice.eligibleAt), asc(invoice.createdAt))
}

/** The default date for a draft: when the goods left, else today. */
export const defaultInvoiceDate = (row: Pick<InvoiceRow, 'dispatchedAt'>, now = new Date()) =>
  row.dispatchedAt ?? now

export type IssueItem = { id: string; invoiceDate: Date }
export type IssuePlan = { id: string; number: string; invoiceDate: Date }[]

/**
 * Number a batch of drafts. Items are sorted by invoice date; items on the
 * same date keep the order the merchant arranged them in (the only reshuffle
 * allowed, since none of them has a number yet). A date before the latest
 * issued invoice in its series is refused: numbers must run in date order.
 * With `commit` false nothing is written and the numbers are a preview.
 */
export async function issueDrafts(
  tx: StoreTx,
  storeId: string,
  items: readonly IssueItem[],
  opts: { commit: boolean; now?: Date },
): Promise<IssuePlan> {
  const now = opts.now ?? new Date()
  const rows = items.length
    ? await tx
        .select()
        .from(invoice)
        .where(
          inArray(
            invoice.id,
            items.map((i) => i.id),
          ),
        )
    : []
  const byId = new Map(rows.map((r) => [r.id, r]))
  const ordered = items
    .map((item, index) => ({ ...item, index }))
    .sort((a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime() || a.index - b.index)
  const settings = await loadSettings(tx, storeId)

  // Serialise batches per store so two reviewers never interleave numbers.
  if (opts.commit) {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:issue:${storeId}`}))`,
    )
  }
  // Keyed by series id and financial year: each series runs on its own.
  const lastDate = new Map<string, Date | null>()
  const peek = new Map<string, number>()
  const plan: IssuePlan = []
  for (const item of ordered) {
    const row = byId.get(item.id)
    if (row?.kind !== 'tax_invoice' || row.status !== 'draft') {
      throw new InvoiceError('invalid', 'Only queued drafts can be issued')
    }
    if (item.invoiceDate.getTime() > now.getTime() + 60_000) {
      throw new InvoiceError('invalid', 'An invoice cannot be dated in the future')
    }
    try {
      await assertPeriodOpen(tx, storeId, item.invoiceDate)
    } catch (err) {
      if (err instanceof PeriodError) throw new InvoiceError('closed', err.message)
      throw err
    }
    const draft = DocumentSnapshotSchema.parse(row.snapshot)
    checkRule46(draft)
    const doc = opts.commit
      ? await orderSnapshot(
          tx,
          storeId,
          row.orderId,
          'tax_invoice',
          null,
          item.invoiceDate,
          settings,
          row.buyerGstin,
          draft.exportSupply,
        )
      : draft
    const series = pickSeries(settings.series, 'tax_invoice', seriesContextOf(doc))
    if (!series)
      throw new InvoiceError('invalid', `No invoice series matches order ${doc.order.name}`)
    const fy = financialYear(item.invoiceDate).startYear
    const key = `${series.id}:${fy}`
    if (!lastDate.has(key)) lastDate.set(key, await latestIssuedDate(tx, series.id, fy))
    const latest = lastDate.get(key)
    if (latest && item.invoiceDate.getTime() < startOfIstDay(latest).getTime()) {
      throw new InvoiceError(
        'backdated',
        `Invoice dates must not go back past the last issued invoice (${latest.toISOString().slice(0, 10)})`,
      )
    }
    if (opts.commit) {
      const n = await takeNumber(
        tx,
        storeId,
        'tax_invoice',
        item.invoiceDate,
        settings,
        seriesContextOf(doc),
      )
      const issued = { ...doc, number: n.number }
      await tx
        .update(invoice)
        .set({
          status: 'issued',
          number: n.number,
          seriesId: n.seriesId,
          seq: n.seq,
          fyStartYear: n.fyStartYear,
          invoiceDate: item.invoiceDate,
          issuedAt: now,
          snapshot: issued,
          ...totalsColumns(issued),
          pdfStatus: 'pending',
          updatedAt: now,
        })
        .where(eq(invoice.id, row.id))
      await writeLines(tx, storeId, row.id, issued)
      plan.push({ id: row.id, number: n.number, invoiceDate: item.invoiceDate })
    } else {
      const year = counterYear(series, financialYear(item.invoiceDate))
      const counter = `${series.id}:${year}`
      const next = peek.get(counter) ?? (await peekNext(tx, series.id, year))
      peek.set(counter, next + 1)
      plan.push({
        id: row.id,
        number: formatSeriesNumber(series, financialYear(item.invoiceDate), next),
        invoiceDate: item.invoiceDate,
      })
    }
    lastDate.set(key, item.invoiceDate)
  }
  return plan
}

/** Rule 46 proviso: B2C invoices of ₹50,000 or more need the buyer's name, delivery address and state. */
export const B2C_DETAIL_THRESHOLD_PAISE = 50_000_00

export function checkRule46(doc: DocumentSnapshot): void {
  if (doc.buyer.gstin || doc.totals.totalPaise < B2C_DETAIL_THRESHOLD_PAISE) return
  const missing = [
    !doc.buyer.name.trim() || doc.buyer.name === 'Customer' ? 'name' : null,
    doc.buyer.address.length === 0 ? 'delivery address' : null,
    doc.buyer.state ? null : 'state',
  ].filter(Boolean)
  if (missing.length) {
    throw new InvoiceError(
      'invalid',
      `Order ${doc.order.name} is ₹50,000 or more to an unregistered buyer; add the buyer's ${missing.join(', ')} first`,
    )
  }
}

/** The number a series' counter hands out next, without taking it; `fyStartYear` is its {@link counterYear}. */
export async function peekNext(
  tx: StoreTx,
  seriesId: string,
  fyStartYear: number,
): Promise<number> {
  const [row] = await tx
    .select({ next: invoiceSequence.next })
    .from(invoiceSequence)
    .where(
      and(eq(invoiceSequence.seriesId, seriesId), eq(invoiceSequence.fyStartYear, fyStartYear)),
    )
  return row?.next ?? 1
}

/**
 * The lowest next number a series may take in the financial year of `at`:
 * the higher of its yearly counter and its never-resetting one, so switching
 * "start again every April" on or off can never hand out a number twice.
 */
export async function nextNumberFloor(
  tx: StoreTx,
  series: Pick<Series, 'id'>,
  at: Date,
): Promise<number> {
  const fy = financialYear(at)
  return Math.max(await peekNext(tx, series.id, fy.startYear), await peekNext(tx, series.id, 0))
}

/**
 * Move a series' counter so its next document takes `wanted` (Settings ›
 * Taxes & GST). Refuses numbers below {@link nextNumberFloor}; the counter
 * row is upserted under the same lock issuing takes.
 */
export async function setNextNumber(
  tx: StoreTx,
  storeId: string,
  series: Series,
  wanted: number,
  at = new Date(),
): Promise<number> {
  const floor = await nextNumberFloor(tx, series, at)
  const problem = nextNumberProblem(floor, wanted)
  if (problem) throw new InvoiceError('invalid', problem)
  const fyStartYear = counterYear(series, financialYear(at))
  await tx
    .insert(invoiceSequence)
    .values({ storeId, kind: series.kind, seriesId: series.id, fyStartYear, next: wanted })
    .onConflictDoUpdate({
      target: [invoiceSequence.storeId, invoiceSequence.seriesId, invoiceSequence.fyStartYear],
      set: { next: sql`greatest(${invoiceSequence.next}, ${wanted})` },
    })
  return wanted
}

async function latestIssuedDate(
  tx: StoreTx,
  seriesId: string,
  fyStartYear: number,
): Promise<Date | null> {
  const [row] = await tx
    .select({ at: invoice.invoiceDate })
    .from(invoice)
    .where(
      and(
        eq(invoice.seriesId, seriesId),
        inArray(invoice.status, ['issued', 'cancelled']),
        eq(invoice.fyStartYear, fyStartYear),
      ),
    )
    .orderBy(desc(invoice.seq))
    .limit(1)
  return row?.at ?? null
}

const IST_OFFSET_MS = 330 * 60 * 1000
function startOfIstDay(at: Date): Date {
  const ist = new Date(at.getTime() + IST_OFFSET_MS)
  return new Date(
    Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS,
  )
}

/**
 * Cancel an issued invoice. Allowed only until its month's GSTR-1 is marked
 * filed; after that the correction is a credit note. The number stays used
 * and shows as cancelled in Table 13.
 */
export async function cancelInvoice(
  tx: StoreTx,
  invoiceId: string,
  reason: string,
): Promise<InvoiceRow> {
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId))
  if (!row) throw new InvoiceError('not_found', 'Invoice not found')
  if (row.kind !== 'tax_invoice' || row.status !== 'issued') {
    throw new InvoiceError('invalid', 'Only an issued tax invoice can be cancelled')
  }
  if (row.reportedPeriod) {
    throw new InvoiceError(
      'locked',
      `${row.number} is reported in GSTR-1 for ${row.reportedPeriod}. Issue a credit note instead.`,
    )
  }
  const notes = await tx
    .select({ id: invoice.id })
    .from(invoice)
    .where(and(eq(invoice.orderId, row.orderId), eq(invoice.kind, 'credit_note')))
  if (notes.length) {
    throw new InvoiceError(
      'locked',
      `${row.number} has credit notes against it and cannot be cancelled`,
    )
  }
  const [updated] = await tx
    .update(invoice)
    .set({
      status: 'cancelled',
      cancelledAt: new Date(),
      cancelReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(invoice.id, invoiceId))
    .returning()
  if (!updated) throw new InvoiceError('not_found', 'Invoice not found')
  return updated
}
