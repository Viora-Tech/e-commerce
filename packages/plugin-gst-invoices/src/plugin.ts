import { DocumentSnapshotSchema } from '@commerce/invoices'
import type { Attachment } from '@commerce/notifications'
import { type AppHookContext, definePlugin } from '@commerce/plugins'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { InvoiceError, issueCreditNote, issueDocument, liveDocuments, loadSettings } from './issue'
import { orderLinks } from './links'
import { enqueueOrderParcels, isPreorder, issueDrafts, removeFromQueue } from './queue'
import { pdfBytes, pdfFilename, renderAndStore } from './render'
import { documentsByIds } from './reports'
import { invoiceBatch } from './schema'
import { issueReceiptVoucher, issueRefundVoucher } from './vouchers'

export const GST_INVOICES_ID = 'gst-invoices'

const RenderJob = z.object({ invoiceId: z.uuid() })
const EmailJob = z.object({ batchId: z.uuid(), ids: z.array(z.uuid()).max(500) })

const DOCUMENT_LABELS = {
  tax_invoice: 'tax invoice',
  credit_note: 'credit note',
  packing_slip: 'packing slip',
  order_confirmation: 'order confirmation',
  receipt_voucher: 'receipt voucher',
  refund_voucher: 'refund voucher',
} as const

/**
 * An order was paid or dispatched: put it in the invoice queue when the rule
 * says so, issue it straight away if the store auto-issues, and give a paid
 * pre-order its receipt voucher. The number is only ever taken at issue.
 */
async function onOrderEvent(ctx: AppHookContext, orderId: string, event: 'paid' | 'fulfilled') {
  const now = new Date()
  const settings = await ctx.inStore((tx) => loadSettings(tx, ctx.storeId))
  // One draft per parcel: an order shipped from two warehouses is billed by both GSTINs.
  const queued = await ctx.inStore((tx) =>
    enqueueOrderParcels(tx, ctx.storeId, orderId, event, now),
  )
  for (const q of queued) {
    ctx.log(`order ${orderId} ${q.created ? 'queued' : 'already queued'}`)
    if (q.row.status !== 'draft' || !settings.autoIssue) continue
    try {
      const [issued] = await ctx.inStore((tx) =>
        issueDrafts(tx, ctx.storeId, [{ id: q.row.id, invoiceDate: now }], {
          commit: true,
          now,
        }),
      )
      if (issued) {
        await renderAndStore(ctx, issued.id)
        ctx.log(`issued ${issued.number}`)
      }
    } catch (err) {
      // A closed period or a missing B2C detail leaves the draft in the queue for review.
      if (!(err instanceof InvoiceError)) throw err
      ctx.log(`left in queue: ${err.message}`)
    }
  }
  if (event === 'paid' && !settings.preorderInvoiceAtPayment) {
    const pre = await ctx.inStore((tx) => isPreorder(tx, orderId, settings.preorderTag))
    if (pre) {
      const rv = await ctx.inStore((tx) => issueReceiptVoucher(tx, ctx.storeId, orderId, now))
      if (rv?.created) {
        await renderAndStore(ctx, rv.row.id)
        ctx.log(`receipt voucher ${rv.row.number}`)
      }
    }
  }
  // Slips are ready before packing starts: issued on payment when switched on.
  if (event === 'paid' && settings.documents.packing_slip.enabled) {
    const { row, created } = await ctx.inStore((tx) =>
      issueDocument(tx, ctx.storeId, orderId, 'packing_slip'),
    )
    if (created || row.pdfStatus !== 'ready') await renderAndStore(ctx, row.id)
  }
}

/** Money back: a credit note against the invoice, or a refund voucher for an undispatched advance. */
async function onRefund(ctx: AppHookContext, orderId: string, refundId: string) {
  try {
    const note = await ctx.inStore((tx) => issueCreditNote(tx, ctx.storeId, refundId))
    if (note) {
      if (note.created || note.row.pdfStatus !== 'ready') await renderAndStore(ctx, note.row.id)
      ctx.log(`credit note ${note.row.number} for refund ${refundId}`)
      return
    }
  } catch (err) {
    if (!(err instanceof InvoiceError)) throw err
    ctx.log(`no credit note: ${err.message}`)
    return
  }
  const voucher = await ctx.inStore((tx) => issueRefundVoucher(tx, ctx.storeId, refundId))
  if (!voucher) return
  if (voucher.created || voucher.row.pdfStatus !== 'ready')
    await renderAndStore(ctx, voucher.row.id)
  // Nothing was supplied: the queued invoices for the cancelled pre-order go too.
  const drafts = (await ctx.inStore((tx) => liveDocuments(tx, orderId, 'tax_invoice'))).filter(
    (d) => d.status === 'draft',
  )
  if (drafts.length) {
    await ctx.inStore((tx) =>
      removeFromQueue(
        tx,
        drafts.map((d) => d.id),
      ),
    )
  }
  ctx.log(`refund voucher ${voucher.row.number} for refund ${refundId}`)
}

/** The PDFs an order email carries: issued documents only, per the "attach to email" switches. */
async function emailAttachments(
  ctx: AppHookContext,
  input: { orderId: string; template: string },
): Promise<Attachment[]> {
  const settings = await ctx.inStore((tx) => loadSettings(tx, ctx.storeId))
  const files: Attachment[] = []
  const inv = settings.documents.tax_invoice
  if (
    inv.enabled &&
    inv.attachToEmail &&
    (input.template === 'payment_received' || input.template === 'order_shipped')
  ) {
    // Every parcel's invoice: a split order has one per GSTIN.
    const rows = await ctx.inStore((tx) => liveDocuments(tx, input.orderId, 'tax_invoice'))
    for (const row of rows.filter((r) => r.status === 'issued')) {
      files.push({
        filename: pdfFilename(row),
        contentType: 'application/pdf',
        content: await pdfBytes(ctx, row.id),
      })
    }
  }
  const conf = settings.documents.order_confirmation
  if (input.template === 'order_placed' && conf.enabled && conf.attachToEmail) {
    const { row } = await ctx.inStore((tx) =>
      issueDocument(tx, ctx.storeId, input.orderId, 'order_confirmation'),
    )
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
  kind: 'builtin',
  category: 'invoicing',
  description:
    'GST tax invoices, credit notes and packing slips with your logo, emailed and downloadable, plus GSTR-1 export.',
  credits: [
    {
      name: 'invoicely',
      url: 'https://github.com/legions-developer/invoicely',
      license: 'MIT',
      note: 'Invoice templates and the live preview editor',
    },
  ],
  provides: {},
  hooks: {
    'order.paid': (ctx, p) => onOrderEvent(ctx, p.orderId, 'paid'),
    'order.fulfilled': (ctx, p) => onOrderEvent(ctx, p.orderId, 'fulfilled'),
    'refund.created': async (ctx, p) => {
      if (p.refundId) await onRefund(ctx, p.orderId, p.refundId)
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
    icon: 'FileText',
    pages: [
      { path: '', title: 'Invoice queue', navLabel: 'Queue', icon: 'Inbox' },
      { path: 'invoices', title: 'Invoices', navLabel: 'Invoices', icon: 'FileText' },
      { path: 'reports', title: 'Returns', navLabel: 'Returns', icon: 'FileBarChart' },
      { path: 'settings', title: 'Settings', navLabel: 'Settings', icon: 'Settings' },
      { path: 'invoices/[id]', title: 'Invoice' },
    ],
    orderDetailCard: true,
  },
})
