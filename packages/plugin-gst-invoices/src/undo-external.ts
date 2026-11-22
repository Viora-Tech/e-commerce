/** SOURCE OF TRUTH: undoExternalInvoice — WHAT undoing "Already invoiced": an invoice recorded
 * from outside Koomerce goes back to a queued draft, so staff can issue the order here or record
 * it again under the right number / WHY owner, 18 Nov 2026: a typo in the recorded number or date
 * must be fixable while the month is not filed. The series counter is never moved back: a number
 * our series skipped stays skipped, so nothing issued here can repeat (rule 46(b)).
 */
import type { StoreTx } from '@commerce/db'
import { DocumentSnapshotSchema } from '@commerce/invoices'
import { eq, sql } from 'drizzle-orm'
import {
  InvoiceError,
  type InvoiceRow,
  liveDocuments,
  loadSettings,
  orderSnapshot,
  totalsColumns,
  writeLines,
} from './issue'
import { assertPeriodOpen, PeriodError } from './periods'
import { isCancelledOrder } from './queue'
import { assertNotFiled, noteOnOrder, timelineDay } from './record-external'
import { orderIssuer } from './registration'
import { invoice } from './schema'

/**
 * Undo "Already invoiced" on one recorded invoice (`source` external), with or without its
 * number and date (`recordWithoutDetails`): it becomes the queued draft it was, with its tax
 * worked out from the order again, and leaves GSTR-1 and GSTR-3B.
 *
 * Refused: anything not recorded from outside Koomerce, an invoice reported in a filed GSTR-1
 * (or dated in a month marked filed or closed), one with a live credit note on its order, and
 * a cancelled order. The order's timeline gets a note by `author`.
 */
export async function undoExternalInvoice(
  tx: StoreTx,
  storeId: string,
  invoiceId: string,
  opts: { now?: Date; author?: string | null } = {},
): Promise<InvoiceRow> {
  const now = opts.now ?? new Date()
  // The lock issuing and recording take, so this cannot cross a batch being numbered.
  await tx.execute(
    sql`select pg_advisory_xact_lock(hashtext(${`gst-invoices:issue:${storeId}`}))`,
  )
  const [row] = await tx.select().from(invoice).where(eq(invoice.id, invoiceId))
  if (!row) throw new InvoiceError('not_found', 'Invoice not found')
  if (row.kind !== 'tax_invoice' || row.status !== 'issued' || row.source !== 'external') {
    throw new InvoiceError(
      'invalid',
      'Only an invoice recorded with "Already invoiced" can be undone',
    )
  }
  if (row.reportedPeriod) {
    throw new InvoiceError(
      'locked',
      `${row.number} is reported in GSTR-1 for ${row.reportedPeriod}, so it cannot be undone`,
    )
  }
  if (row.invoiceDate) {
    const gst = row.gstRegistrationId
    await assertNotFiled(tx, storeId, row.invoiceDate, gst, 'it cannot be undone')
    try {
      await assertPeriodOpen(tx, storeId, row.invoiceDate, gst)
    } catch (err) {
      if (err instanceof PeriodError) throw new InvoiceError('closed', err.message)
      throw err
    }
  }
  if ((await liveDocuments(tx, row.orderId, 'credit_note')).length) {
    throw new InvoiceError(
      'locked',
      `${row.number ?? 'This order'} has credit notes against its order, so it cannot be undone`,
    )
  }
  if (await isCancelledOrder(tx, row.orderId)) {
    throw new InvoiceError(
      'invalid',
      'This order is cancelled, so it cannot go back to the queue. Cancel the invoice instead.',
    )
  }

  const settings = await loadSettings(tx, storeId)
  const recorded = DocumentSnapshotSchema.parse(row.snapshot)
  const issuer = await orderIssuer(tx, row.orderId, row.gstRegistrationId)
  const draft = await orderSnapshot(
    tx,
    storeId,
    row.orderId,
    'tax_invoice',
    null,
    now,
    settings,
    row.buyerGstin,
    recorded.exportSupply,
    issuer,
    row.fulfillmentOrderId,
  )
  const [updated] = await tx
    .update(invoice)
    .set({
      status: 'draft',
      source: 'koomerce',
      number: null,
      seriesId: null,
      seq: null,
      fyStartYear: null,
      invoiceDate: null,
      issuedAt: now,
      snapshot: draft,
      ...totalsColumns(draft),
      pdfStatus: 'pending',
      pdfError: null,
      reportedPeriod: null,
      updatedAt: now,
    })
    .where(eq(invoice.id, row.id))
    .returning()
  if (!updated) throw new InvoiceError('not_found', 'Invoice not found')
  await writeLines(tx, storeId, row.id, draft)
  const dated = row.invoiceDate ? ` dated ${timelineDay(row.invoiceDate)}` : ''
  const what = row.number ? `invoice ${row.number}${dated}` : 'this order (no invoice details)'
  await noteOnOrder(
    tx,
    storeId,
    row.orderId,
    `Undid "Already invoiced" for ${what}; the order is back in the GST invoices queue`,
    opts.author ?? null,
  )
  return updated
}
