/** SOURCE OF TRUTH: recordAlreadyInvoiced, recordWithoutDetails, recordManyWithoutDetails,
 * detailsMissing — WHAT "Already invoiced" without a number and date: an order invoiced long
 * ago in a previous system (Shopify-era orders such as #2073 on Waimers) whose invoice number
 * and date the merchant no longer has / WHY owner, 23 Nov 2026: such an order must leave the
 * queue for good and count as invoiced, but it was reported in the previous system's returns,
 * so it is never counted in Koomerce's GSTR-1 or GSTR-3B (no invoice date puts it in no month)
 * and no credit note is made against it here. With a number and date it is
 * `recordExternalInvoice` as before.
 */
import type { StoreTx } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { InvoiceError, type InvoiceRow } from './issue'
import { isCancelledOrder, isTestOrder } from './queue'
import { noteOnOrder, recordExternalInvoice } from './record-external'
import { invoice } from './schema'

/** Most queue rows one bulk "Mark as already invoiced" takes. */
export const RECORD_MANY_MAX = 500

/**
 * An invoice recorded with "Already invoiced" but no number or date: invoiced in a previous
 * system, reported in its returns, not in Koomerce's. No credit note, cancel or GST change here.
 */
export const detailsMissing = (row: Pick<InvoiceRow, 'source' | 'number'>) =>
  row.source === 'external' && !row.number

type Opts = { now?: Date; author?: string | null }

/**
 * "Already invoiced" on a queued order, with or without the invoice's details: both number and
 * date go to `recordExternalInvoice` (counted in GSTR-1, number kept used); both blank to
 * `recordWithoutDetails`. Only one of them is refused.
 */
export async function recordAlreadyInvoiced(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  input: { number?: string | null | undefined; invoiceDate?: Date | null | undefined },
  opts: Opts = {},
): Promise<InvoiceRow> {
  const number = input.number?.trim() ?? ''
  const date = input.invoiceDate ?? null
  if (number && date) {
    return recordExternalInvoice(tx, storeId, invoiceId, { number, invoiceDate: date }, opts)
  }
  if (number || date) {
    throw new InvoiceError(
      'invalid',
      number
        ? 'Add the invoice date too, or leave both the number and the date blank'
        : 'Add the invoice number too, or leave both the number and the date blank',
    )
  }
  return recordWithoutDetails(tx, storeId, invoiceId, opts)
}

/**
 * A queued draft becomes an invoice issued outside Koomerce with no number and no date. It
 * keeps the draft's figures (so the invoice page still shows what was sold), has no PDF, and
 * stays live, so the paid and fulfilled rules never queue the order again (one live tax invoice
 * per parcel). Refused: anything but a queued draft, a test or a cancelled order. No period
 * check: with no date it belongs to no return month. The order's timeline gets a note.
 */
export async function recordWithoutDetails(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  opts: Opts = {},
): Promise<InvoiceRow> {
  const now = opts.now ?? new Date()
  // The lock issuing takes, so a batch being numbered cannot issue this draft meanwhile.
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
  const [updated] = await tx
    .update(invoice)
    .set({
      status: 'issued',
      source: 'external',
      number: null,
      seriesId: null,
      seq: null,
      fyStartYear: null,
      invoiceDate: null,
      issuedAt: now,
      pdfStatus: 'none',
      pdfError: null,
      reportedPeriod: null,
      updatedAt: now,
    })
    .where(eq(invoice.id, row.id))
    .returning()
  if (!updated) throw new InvoiceError('not_found', 'Invoice not found')
  await noteOnOrder(
    tx,
    storeId,
    row.orderId,
    "Marked as already invoiced outside Koomerce, without the invoice's number or date. Reported in the previous system's GST returns, not in Koomerce's.",
    opts.author ?? null,
  )
  return updated
}

export type RecordManyResult = {
  recorded: number
  /** Rows left in the queue, with why (a test or cancelled order, already gone). */
  skipped: { id: string; reason: string }[]
}

/**
 * The Queue's bulk "Mark as already invoiced": every ticked draft recorded without details, in
 * one transaction. A row that cannot be recorded is skipped with its reason (checks run before
 * any write for that row, so nothing half-done is left), the rest go through.
 */
export async function recordManyWithoutDetails(
  tx: StoreTx,
  storeId: string,
  invoiceIds: readonly string[],
  opts: Opts = {},
): Promise<RecordManyResult> {
  const out: RecordManyResult = { recorded: 0, skipped: [] }
  for (const id of new Set(invoiceIds)) {
    try {
      await recordWithoutDetails(tx, storeId, id, opts)
      out.recorded++
    } catch (err) {
      if (!(err instanceof InvoiceError)) throw err
      out.skipped.push({ id, reason: err.message })
    }
  }
  return out
}
