import { DocumentSnapshotSchema, shouldAutoIssue } from '@commerce/invoices'
import type { Attachment } from '@commerce/notifications'
import { type AppHookContext, definePlugin } from '@commerce/plugins'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { issueCreditNote, issueDocument, loadSettings } from './issue'
import { orderLinks } from './links'
import { pdfBytes, pdfFilename, renderAndStore } from './render'
import { documentsByIds } from './reports'
import { invoiceBatch } from './schema'

export const GST_INVOICES_ID = 'gst-invoices'

const RenderJob = z.object({ invoiceId: z.uuid() })
const EmailJob = z.object({ batchId: z.uuid(), ids: z.array(z.uuid()).max(500) })

const DOCUMENT_LABELS = {
  tax_invoice: 'tax invoice',
  credit_note: 'credit note',
  packing_slip: 'packing slip',
  order_confirmation: 'order confirmation',
} as const

async function issueOn(ctx: AppHookContext, orderId: string, event: 'paid' | 'fulfilled') {
  const settings = await ctx.inStore((tx) => loadSettings(tx, ctx.storeId))
  const kinds: ('tax_invoice' | 'packing_slip')[] = []
  if (shouldAutoIssue(settings, event)) kinds.push('tax_invoice')
  // Slips are ready before packing starts: issued on payment when switched on.
  if (event === 'paid' && settings.documents.packing_slip.enabled) kinds.push('packing_slip')
  for (const kind of kinds) {
    const { row, created } = await ctx.inStore((tx) =>
      issueDocument(tx, ctx.storeId, orderId, kind),
    )
    if (created || row.pdfStatus !== 'ready') await renderAndStore(ctx, row.id)
    ctx.log(`${kind} ${row.number ?? row.id} for order ${orderId}${created ? '' : ' (existing)'}`)
  }
}

/** The PDFs an order email carries, per the per-document "attach to email" switches. */
async function emailAttachments(
  ctx: AppHookContext,
  input: { orderId: string; template: string },
): Promise<Attachment[]> {
  const settings = await ctx.inStore((tx) => loadSettings(tx, ctx.storeId))
  const wants: ('tax_invoice' | 'order_confirmation')[] = []
  const invoiceTemplate = settings.issueOn === 'fulfilment' ? 'order_shipped' : 'payment_received'
  const inv = settings.documents.tax_invoice
  if (
    input.template === invoiceTemplate &&
    inv.enabled &&
    inv.attachToEmail &&
    settings.issueOn !== 'manual'
  ) {
    wants.push('tax_invoice')
  }
  const conf = settings.documents.order_confirmation
  if (input.template === 'order_placed' && conf.enabled && conf.attachToEmail) {
    wants.push('order_confirmation')
  }
  const files: Attachment[] = []
  for (const kind of wants) {
    // Issued here too, idempotently: the email may run before the order.paid hook.
    const { row } = await ctx.inStore((tx) => issueDocument(tx, ctx.storeId, input.orderId, kind))
    files.push({
      filename: pdfFilename(row),
      contentType: 'application/pdf',
      content: await pdfBytes(ctx, row.id),
    })
  }
  return files
}

/**
 * GST invoices. Tax invoices on payment or fulfilment, credit notes on
 * refunds, packing slips and order confirmations, GSTR-1 export. Templates
 * adapted from invoicely (MIT); see packages/invoices/THIRD_PARTY_LICENSES.md.
 */
export const gstInvoicesPlugin = definePlugin({
  id: GST_INVOICES_ID,
  name: 'GST invoices',
  version: '1.0.0',
  category: 'invoicing',
  description:
    'GST tax invoices, credit notes and packing slips with your logo, emailed and downloadable, plus GSTR-1 export.',
  provides: {},
  hooks: {
    'order.paid': (ctx, p) => issueOn(ctx, p.orderId, 'paid'),
    'order.fulfilled': (ctx, p) => issueOn(ctx, p.orderId, 'fulfilled'),
    'refund.created': async (ctx, p) => {
      if (!p.refundId) return
      const refundId = p.refundId
      const issued = await ctx.inStore((tx) => issueCreditNote(tx, ctx.storeId, refundId))
      if (!issued) return
      if (issued.created || issued.row.pdfStatus !== 'ready')
        await renderAndStore(ctx, issued.row.id)
      ctx.log(`credit note ${issued.row.number} for refund ${refundId}`)
    },
  },
  jobs: {
    render: async (ctx, data) => {
      await renderAndStore(ctx, RenderJob.parse(data).invoiceId)
    },
    email: async (ctx, data) => {
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
        await ctx.inStore((tx) =>
          tx
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
            .where(eq(invoiceBatch.id, job.batchId)),
        )
      }
    },
  },
  orderLinks,
  emailAttachments,
  productFields: [
    { key: 'hsCode', label: 'HSN code', help: '4 digits up to ₹5 crore turnover, 6 above.' },
    { key: 'gstRatePercent', label: 'GST rate (%)', help: 'Leave blank to use the store rate.' },
  ],
  admin: {
    settingsPage: {
      label: 'GST invoices',
      description: 'Invoice numbering, template, documents and GSTR-1 export.',
    },
    orderCard: true,
  },
})
