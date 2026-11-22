/** SOURCE OF TRUTH: GST invoices `email` job
 * WHAT:  Emails each document's PDF to its order's buyer (`document_copy`), counts the batch's
 *        sent and failed, and notes each send on the order's timeline.
 * WHY:   One job for the Invoices list's bulk Email and the order's "Email invoice to customer"
 *        (`gstInvoices.emailInvoice`), so both send the same email and both are on the timeline,
 *        like "Send order link".
 * WHERE: `jobs.email` on the manifest (plugin.ts); queued by the API's gst-invoices routers.
 */
import { order, type StoreTx } from '@commerce/db'
import { DocumentSnapshotSchema } from '@commerce/invoices'
import type { AppHookContext } from '@commerce/plugins'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { InvoiceError, liveDocuments } from './issue'
import { hasPdf, noteOnOrder } from './record-external'
import { pdfBytes, pdfFilename } from './render'
import { documentsByIds } from './reports'
import { invoiceBatch } from './schema'

const EmailJob = z.object({
  batchId: z.uuid(),
  ids: z.array(z.uuid()).max(500),
  /** Who asked (their email), for the timeline note; absent on older queued jobs. */
  author: z.string().max(320).nullish(),
})

const DOCUMENT_LABELS = {
  tax_invoice: 'tax invoice',
  credit_note: 'credit note',
  packing_slip: 'packing slip',
  order_confirmation: 'order confirmation',
  receipt_voucher: 'receipt voucher',
  refund_voucher: 'refund voucher',
} as const

/** "Tax invoice INV/26-27/0042 emailed to the customer.": the order timeline's line. */
export function emailedNote(kind: keyof typeof DOCUMENT_LABELS, number: string | null): string {
  const label = DOCUMENT_LABELS[kind]
  const name = `${label.charAt(0).toUpperCase()}${label.slice(1)}${number ? ` ${number}` : ''}`
  return `${name} emailed to the customer.`
}

/**
 * "Email invoice to customer": the order's issued tax invoices that have a PDF (one per parcel;
 * a recorded "Already invoiced" one has none). Refused when there is no email address to send
 * to or no PDF to send, so the member hears it now rather than in a failed batch.
 */
export async function invoicesToEmail(tx: StoreTx, orderId: string) {
  const [o] = await tx.select({ email: order.email }).from(order).where(eq(order.id, orderId))
  if (!o) throw new InvoiceError('order_not_found', 'Order not found')
  if (!o.email?.trim()) throw new InvoiceError('invalid', 'This order has no email address')
  const rows = (await liveDocuments(tx, orderId, 'tax_invoice')).filter(
    (r) => r.status === 'issued' && hasPdf(r),
  )
  if (rows.length === 0) {
    throw new InvoiceError(
      'invalid',
      'This order has no invoice PDF to email. An invoice recorded from outside Koomerce has none.',
    )
  }
  return rows
}

/** The `email` job: one email per document, each with its PDF. */
export async function emailDocuments(ctx: AppHookContext, data: unknown): Promise<void> {
  const job = EmailJob.parse(data)
  const rows = await ctx.inStore((tx) => documentsByIds(tx, job.ids))
  for (const row of rows) {
    const doc = DocumentSnapshotSchema.parse(row.snapshot)
    let ok = false
    let error = ''
    try {
      const r = await ctx.notify({
        orderId: row.orderId,
        template: 'document_copy',
        documentLabel: `${DOCUMENT_LABELS[row.kind]}${row.number ? ` ${row.number}` : ''}`,
        document: {
          number: row.number ?? undefined,
          gstin: doc.seller.gstin || undefined,
          fileName: pdfFilename(row),
        },
        attachments: [
          {
            filename: pdfFilename(row),
            contentType: 'application/pdf',
            content: await pdfBytes(ctx, row.id),
          },
        ],
      })
      ok = r.sent > 0
      error = r.errors[0] ?? (ok ? '' : 'no email address on the order or no email channel')
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }
    const note = `${doc.number ?? doc.order.name}: ${error}`
    await ctx.inStore(async (tx) => {
      await tx
        .update(invoiceBatch)
        .set(
          ok
            ? { sent: sql`${invoiceBatch.sent} + 1`, updatedAt: new Date() }
            : {
                failed: sql`${invoiceBatch.failed} + 1`,
                errors: sql`(${invoiceBatch.errors} || ${JSON.stringify([note])}::jsonb)`,
                updatedAt: new Date(),
              },
        )
        .where(eq(invoiceBatch.id, job.batchId))
      if (ok) {
        await noteOnOrder(
          tx,
          ctx.storeId,
          row.orderId,
          emailedNote(row.kind, row.number),
          job.author ?? null,
        )
      }
    })
  }
}
