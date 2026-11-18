/** SOURCE OF TRUTH: GST invoice PDF procedures — WHAT: one PDF, a zip of PDFs and one merged PDF for the printer; each marks the invoices printed / WHY: kept out of gst-invoices.ts (500-line cap) and spread into `gstInvoicesRouter`, so the paths stay `gstInvoices.download`, `bulkDownload` and `bulkPrint`; the Invoices list shows "Not printed" until one of these ran (owner, 18 Nov 2026) */
import { permissions } from '@commerce/core'
import { mergePdfs, zipFiles } from '@commerce/invoices/render'
import {
  documentsByIds,
  hasPdf,
  InvoiceError,
  markPrinted,
  pdfBytes,
  pdfFilename,
} from '@commerce/plugin-gst-invoices/server'
import { z } from 'zod'
import { can, heavy } from '../procedures'
import { asOrpc, renderDeps, requireInstalled } from './gst-invoices-context'
import { Selection, selectedIds } from './gst-invoices-selection'

const file = (bytes: Uint8Array, name: string, type = 'application/pdf') =>
  new File([bytes as Uint8Array<ArrayBuffer>], name, { type })

export const fileProcedures = {
  /** One document's PDF. */
  download: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      try {
        const [row] = await documentsByIds(context.tx, [input.id])
        if (!row) throw new InvoiceError('not_found', 'Document not found')
        const pdf = await pdfBytes(renderDeps(context), row.id)
        await markPrinted(context.tx, [row.id])
        return file(pdf, pdfFilename(row))
      } catch (err) {
        asOrpc(err)
      }
    }),

  /** A zip of PDFs, one per selected document. */
  bulkDownload: can(permissions.ORDERS_READ)
    .use(heavy('bulk'))
    .input(Selection)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const rows = await documentsByIds(context.tx, await selectedIds(context, input))
      const deps = renderDeps(context)
      const files = []
      // Invoices recorded from outside Koomerce have no PDF and are left out.
      const withPdf = rows.filter(hasPdf)
      for (const row of withPdf)
        files.push({ name: pdfFilename(row), bytes: await pdfBytes(deps, row.id) })
      await markPrinted(
        context.tx,
        withPdf.map((r) => r.id),
      )
      return file(zipFiles(files), 'invoices.zip', 'application/zip')
    }),

  /** One merged PDF for the printer. */
  bulkPrint: can(permissions.ORDERS_READ)
    .use(heavy('bulk'))
    .input(Selection)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const rows = await documentsByIds(context.tx, await selectedIds(context, input))
      const deps = renderDeps(context)
      const files = []
      const withPdf = rows.filter(hasPdf)
      for (const row of withPdf) files.push(await pdfBytes(deps, row.id))
      await markPrinted(
        context.tx,
        withPdf.map((r) => r.id),
      )
      return file(await mergePdfs(files), 'invoices-print.pdf')
    }),
}
