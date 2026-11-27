/**
 * SOURCE OF TRUTH: GST invoice edit procedures — WHAT: `getEdit` (may it be edited now, the
 * form's values and the version history), `saveEdit` (correct an issued tax invoice in place and
 * redraw its PDF) and `getVersionPdf` (an earlier version as a PDF) / WHY: kept out of
 * gst-invoices.ts (500-line cap) and spread into `gstInvoicesRouter`; editing is allowed until the
 * month's GSTR-1 is filed or due (owner, 28 Nov 2026), the rules live in the plugin's
 * edit-invoice.ts
 */
import { permissions } from '@commerce/core'
import { DocumentSnapshotSchema, editableOf, InvoiceEditSchema } from '@commerce/invoices'
import {
  documentsByIds,
  editInvoice,
  InvoiceError,
  invoiceEditLock,
  invoiceVersionSnapshot,
  invoiceVersions,
  pdfFilename,
  renderAndStore,
  renderSnapshot,
} from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { can } from '../procedures'
import { asOrpc, queueChanged, renderDeps, requireInstalled } from './gst-invoices-context'

/** Whether an invoice may be edited now, the edit form's values, and every earlier version. */
const getEdit = can(permissions.ORDERS_READ)
  .input(z.object({ id: z.uuid() }))
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    const [row] = await documentsByIds(context.tx, [input.id])
    if (!row) asOrpc(new InvoiceError('not_found', 'Document not found'))
    const doc = DocumentSnapshotSchema.parse(row.snapshot)
    return {
      lock: await invoiceEditLock(context.tx, context.scope.storeId, row),
      form: editableOf(doc),
      versions: await invoiceVersions(context.tx, row.id),
    }
  })

/**
 * Correct an issued tax invoice in place: quantities, prices, discounts, charges and the
 * buyer; taxes and totals are worked out again, the number and date stay, the old version is
 * kept and the PDF is drawn again.
 */
const saveEdit = can(permissions.ORDERS_WRITE)
  .input(
    z.object({
      id: z.uuid(),
      edit: InvoiceEditSchema,
      reason: z.string().trim().max(200).nullable().optional(),
    }),
  )
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    queueChanged(context)
    try {
      const saved = await editInvoice(context.tx, context.scope.storeId, input.id, {
        edit: input.edit,
        reason: input.reason ?? null,
        author: context.session.user.email,
      })
      context.activity.note({
        resourceId: saved.row.id,
        label: saved.row.number,
        before: { totalPaise: saved.before.totalPaise, taxablePaise: saved.before.taxablePaise },
        after: { totalPaise: saved.after.totalPaise, taxablePaise: saved.after.taxablePaise },
      })
      const done = await renderAndStore(renderDeps(context), saved.row.id)
      return { id: done.id, number: done.number, version: saved.version, changes: saved.changes }
    } catch (err) {
      asOrpc(err)
    }
  })

/** One earlier version of an invoice as a PDF, drawn now with the store's current look. */
const getVersionPdf = can(permissions.ORDERS_READ)
  .input(z.object({ id: z.uuid(), version: z.number().int().min(1).max(10_000) }))
  .handler(async ({ context, input }) => {
    await requireInstalled(context)
    try {
      const [row] = await documentsByIds(context.tx, [input.id])
      if (!row) throw new InvoiceError('not_found', 'Document not found')
      const doc = await invoiceVersionSnapshot(context.tx, row.id, input.version)
      const bytes = await renderSnapshot(renderDeps(context), doc)
      const name = pdfFilename(row).replace(/\.pdf$/, `-v${input.version}.pdf`)
      return new File([bytes as Uint8Array<ArrayBuffer>], name, { type: 'application/pdf' })
    } catch (err) {
      asOrpc(err)
    }
  })

/** Mounted on `gstInvoices` in one line, so that router stays within the file-size sweep. */
export const invoiceEditProcedures = { getEdit, saveEdit, getVersionPdf }
