/** SOURCE OF TRUTH: recordExternalInvoice — WHAT "Already invoiced" on a queued order: the tax
 * invoice the merchant issued earlier outside Koomerce (by hand or in a previous billing
 * system) recorded under its own number and date / WHY the order must leave the queue without
 * a second invoice, the sale must still count in GSTR-1 and GSTR-3B, and our series must never
 * hand that number out again (rule 46(b): unique per GSTIN per financial year).
 */
import { formatInZone } from '@commerce/dates'
import { orderNote, type StoreTx } from '@commerce/db'
import {
  checkDocumentNumber,
  counterYear,
  DOCUMENT_NUMBER_MAX,
  DocumentSnapshotSchema,
  type FinancialYear,
  financialYear,
  formatSeriesNumber,
  type InvoiceSettings,
  type Series,
} from '@commerce/invoices'
import { and, eq, sql } from 'drizzle-orm'
import {
  InvoiceError,
  type InvoiceRow,
  loadSettings,
  orderSnapshot,
  totalsColumns,
  writeLines,
} from './issue'
import { peekNext } from './next-number'
import { assertPeriodOpen, getPeriod, PeriodError, periodLabel, periodOf } from './periods'
import { isCancelledOrder, isTestOrder } from './queue'
import { gstToken, orderIssuer, sameRegistration } from './registration'
import { invoice, invoiceSequence } from './schema'

/** A recorded invoice has no PDF here: nothing to draw, download, print or email. */
export const hasPdf = (row: Pick<InvoiceRow, 'source'>) => row.source !== 'external'

/** The running number at the end of a document number (`VI/26-27/642` → 642), or null. */
const trailingSeq = (number: string): number | null => {
  const digits = /(\d+)$/.exec(number)?.[1]
  if (!digits) return null
  const n = Number(digits)
  return Number.isSafeInteger(n) && n <= 2_147_483_647 ? n : null
}

/**
 * The series a document counts under in Table 13 and the sales register: its own series, or for
 * an invoice recorded from outside Koomerce with a number none of our series prints, the
 * previous system's prefix (`VI/26-27/…`), so those numbers make a range of their own.
 */
export function documentSeriesKey(
  row: Pick<InvoiceRow, 'seriesId' | 'kind' | 'source' | 'number'>,
): string {
  if (row.seriesId) return row.seriesId
  if (row.source === 'external' && row.number) {
    return `${row.number.replace(/\d+$/, '')}… (outside Koomerce)`
  }
  return row.kind
}

/**
 * The tax invoice series of ours that prints exactly `number` in the financial year `fy` for
 * this GSTIN (`{GST}` printing `token`), with its running number; null when none does.
 */
export function ownSeriesNumber(
  series: readonly Series[],
  number: string,
  fy: FinancialYear,
  token: string,
): { series: Series; seq: number } | null {
  const seq = trailingSeq(number)
  if (seq === null || seq < 1) return null
  for (const s of series) {
    if (s.kind !== 'tax_invoice') continue
    if (formatSeriesNumber(s, fy, seq, token) === number) return { series: s, seq }
  }
  return null
}

/** `5 Oct 2026`: an invoice date as the order timeline shows it (IST). */
export const timelineDay = (at: Date) =>
  formatInZone(at, { day: 'numeric', month: 'short', year: 'numeric' })

/** A line on the order's timeline, by the staff member who did it. */
export async function noteOnOrder(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  body: string,
  author: string | null,
): Promise<void> {
  await tx.insert(orderNote).values({ storeId, orderId, body, author })
}

/**
 * Refuse a return month whose GSTR-1 is marked filed (Reports › Mark filed, `invoice_period`
 * `gstr1_filed_at`): what was filed is final here, a change is an amendment on the portal.
 */
export async function assertNotFiled(
  tx: StoreTx,
  storeId: string,
  at: Date,
  gstRegistrationId: string | null,
  what: string,
): Promise<void> {
  const period = periodOf(at)
  const filing = await getPeriod(tx, storeId, period, gstRegistrationId)
  if (filing?.gstr1FiledAt) {
    throw new InvoiceError(
      'locked',
      `GSTR-1 for ${periodLabel(period)} is marked filed, so ${what}. Correct it with an amendment on the GST portal, or unmark the month in Reports if it was not filed yet.`,
    )
  }
}

/** Why `number` cannot be a GST invoice number, or null. */
function numberProblem(number: string): string | null {
  if (!number) return 'Type the invoice number'
  const check = checkDocumentNumber(number)
  if (check.ok) return null
  return check.reason === 'length'
    ? `Invoice numbers can be at most ${DOCUMENT_NUMBER_MAX} characters`
    : 'Invoice numbers use only letters, digits, / and -'
}

/**
 * "Already invoiced": a queued draft becomes the tax invoice the merchant issued outside
 * Koomerce, under the number and date they type. Its taxable value and GST come from the order
 * exactly as issuing works them out (`orderSnapshot`), so GSTR-1 and GSTR-3B count it like any
 * invoice. It is `source` external with no PDF (`pdf_status` none).
 *
 * Refused: a number another document of this GSTIN already has in that financial year, a
 * future date, a closed month, a month whose GSTR-1 is marked filed, a test or cancelled
 * order. A number one of our series would print (`INV/26-27/0042`) is taken out of that
 * series: the counter moves past it, so issuing never hands it out again. One ahead of the
 * counter is refused (owner, 18 Nov 2026): it would leave a gap in the series, and the
 * numbers before it could still be issued here and clash with the other system's.
 * The order's timeline gets a note by `author`.
 */
export async function recordExternalInvoice(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  input: { number: string; invoiceDate: Date },
  opts: { now?: Date; author?: string | null } = {},
): Promise<InvoiceRow> {
  const now = opts.now ?? new Date()
  const number = input.number.trim().toUpperCase()
  const problem = numberProblem(number)
  if (problem) throw new InvoiceError('invalid', problem)
  if (input.invoiceDate.getTime() > now.getTime() + 60_000) {
    throw new InvoiceError('invalid', 'An invoice cannot be dated in the future')
  }

  // The same lock issuing takes: a batch being numbered cannot race past the counter move.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:issue:${storeId}`}))`,
  )
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId))
  if (row?.kind !== 'tax_invoice' || row.status !== 'draft') {
    throw new InvoiceError('invalid', 'Only an order waiting in the queue can be marked invoiced')
  }
  if (await isTestOrder(tx, row.orderId)) {
    throw new InvoiceError('invalid', 'This is a test order; it gets no GST invoice')
  }
  if (await isCancelledOrder(tx, row.orderId)) {
    throw new InvoiceError('invalid', 'This order is cancelled; it gets no GST invoice')
  }

  const issuer = await orderIssuer(tx, row.orderId, row.gstRegistrationId)
  const registrationId = issuer?.id ?? null
  try {
    await assertPeriodOpen(tx, storeId, input.invoiceDate, registrationId)
  } catch (err) {
    if (err instanceof PeriodError) throw new InvoiceError('closed', err.message)
    throw err
  }
  await assertNotFiled(
    tx,
    storeId,
    input.invoiceDate,
    registrationId,
    'an invoice cannot be recorded into it',
  )

  const fy = financialYear(input.invoiceDate)
  const [taken] = await tx
    .select({ id: invoice.id, snapshot: invoice.snapshot })
    .from(invoice)
    .where(
      and(
        sameRegistration(invoice.gstRegistrationId, registrationId),
        eq(invoice.fyStartYear, fy.startYear),
        eq(invoice.number, number),
      ),
    )
    .limit(1)
  if (taken) {
    const other = DocumentSnapshotSchema.safeParse(taken.snapshot)
    const on = other.success ? ` (order ${other.data.order.name})` : ''
    throw new InvoiceError(
      'invalid',
      `${number} is already used by another invoice${on} of this GST number in FY ${fy.label}. Check the number and try again.`,
    )
  }

  const settings: InvoiceSettings = await loadSettings(tx, storeId)
  const draft = DocumentSnapshotSchema.parse(row.snapshot)
  const doc = await orderSnapshot(
    tx,
    storeId,
    row.orderId,
    'tax_invoice',
    number,
    input.invoiceDate,
    settings,
    row.buyerGstin,
    draft.exportSupply,
    issuer,
    row.fulfillmentOrderId,
  )

  // One of our own numbers: the series' counter moves past it so issuing never repeats it.
  const token = gstToken(issuer, settings)
  const own = ownSeriesNumber(settings.series, number, fy, token)
  if (own) {
    const year = counterYear(own.series, fy)
    const next = await peekNext(tx, registrationId, own.series.id, year)
    if (own.seq > next) {
      const nextNumber = formatSeriesNumber(own.series, fy, next, token)
      throw new InvoiceError(
        'invalid',
        `${number} is ahead of your invoice series: the next number Koomerce issues is ${nextNumber}. Recording it would leave a gap, and the numbers in between could clash later. Check the number, or issue this order from the queue.`,
      )
    }
    await tx
      .insert(invoiceSequence)
      .values({
        storeId,
        gstRegistrationId: registrationId,
        kind: 'tax_invoice',
        seriesId: own.series.id,
        fyStartYear: year,
        next: own.seq + 1,
      })
      .onConflictDoUpdate({
        target: [
          invoiceSequence.storeId,
          invoiceSequence.gstRegistrationId,
          invoiceSequence.seriesId,
          invoiceSequence.fyStartYear,
        ],
        set: { next: sql`greatest(${invoiceSequence.next}, ${own.seq + 1})` },
      })
  }

  const [updated] = await tx
    .update(invoice)
    .set({
      status: 'issued',
      source: 'external',
      gstRegistrationId: registrationId,
      number,
      seriesId: own?.series.id ?? null,
      seq: own?.seq ?? trailingSeq(number),
      fyStartYear: fy.startYear,
      invoiceDate: input.invoiceDate,
      issuedAt: now,
      snapshot: doc,
      ...totalsColumns(doc),
      pdfStatus: 'none',
      pdfError: null,
      reportedPeriod: null,
      updatedAt: now,
    })
    .where(eq(invoice.id, row.id))
    .returning()
  if (!updated) throw new InvoiceError('not_found', 'Invoice not found')
  await writeLines(tx, storeId, row.id, doc)
  await noteOnOrder(
    tx,
    storeId,
    row.orderId,
    `Recorded invoice ${number} dated ${timelineDay(input.invoiceDate)} as already invoiced outside Koomerce`,
    opts.author ?? null,
  )
  return updated
}
