import { enqueueAppJob, listGstNumbers, permissions } from '@commerce/core'
import { DOCUMENT_KINDS, DocumentSnapshotSchema, InvoiceSettingsSchema } from '@commerce/invoices'
import { mergePdfs, zipFiles } from '@commerce/invoices/render'
import {
  cancelInvoice,
  defaultInvoiceDate,
  documentIds,
  documentIssuer,
  documentsByIds,
  documentsForOrder,
  enqueueOrderParcels,
  GST_INVOICES_ID,
  gstr1ForPeriod,
  InvoiceError,
  issueCreditNotes,
  issueDocument,
  issueDrafts,
  listDocuments,
  listPeriods,
  listQueue,
  loadSettings,
  markFiled,
  pdfBytes,
  pdfFilename,
  regenerateDocument,
  removeFromQueue,
  renderAndStore,
  saveSettings,
  setClosed,
} from '@commerce/plugin-gst-invoices/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can, heavy } from '../procedures'
import {
  createEmailBatch,
  emailBatch,
  mediaUrls,
  orderIdsByNumber,
  orderRefunds,
  storeName,
} from '../services/gst-invoices.service'
import {
  asOrpc,
  type Ctx,
  Gst,
  gstScope,
  nextNumbers,
  Period,
  renderDeps,
  requireInstalled,
} from './gst-invoices-context'

const IssueBatch = z.object({
  items: z
    .array(z.object({ id: z.uuid(), invoiceDate: z.coerce.date() }))
    .min(1)
    .max(200),
})

const Filter = z.object({
  q: z.string().max(100).optional(),
  kind: z.enum(DOCUMENT_KINDS).optional(),
  status: z.enum(['issued', 'cancelled']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  /** One GST number's documents; omitted lists every GST number's. */
  gstRegistrationId: Gst,
})

/** Rows or "everything matching the filter", capped so one click cannot render the year. */
const Selection = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) }),
  z.object({ filter: Filter }),
])

async function selectedIds(context: Ctx, input: z.infer<typeof Selection>) {
  return 'ids' in input ? input.ids : documentIds(context.tx, input.filter, 200)
}

const file = (bytes: Uint8Array, name: string, type = 'application/pdf') =>
  new File([bytes as Uint8Array<ArrayBuffer>], name, { type })

export const gstInvoicesRouter = {
  /** The store's GST numbers for the picker at the top of the app, and which one is the default. */
  gstNumbers: can(permissions.ORDERS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    const numbers = await listGstNumbers(context.tx)
    return { numbers, defaultId: numbers.find((n) => n.isDefault)?.id ?? null }
  }),

  settings: {
    get: can(permissions.SETTINGS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      const settings = await loadSettings(context.tx, context.scope.storeId)
      const urls = await mediaUrls(context.tx, [settings.logoMediaId, settings.signatureMediaId])
      const urlOf = (id: string | null) => (id ? (urls.get(id) ?? null) : null)
      return {
        settings,
        storeName: await storeName(context.tx, context.scope.storeId),
        media: { logo: urlOf(settings.logoMediaId), signature: urlOf(settings.signatureMediaId) },
      }
    }),
    save: can(permissions.SETTINGS_MANAGE)
      .input(z.unknown())
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const parsed = InvoiceSettingsSchema.safeParse(input)
        if (!parsed.success) {
          throw new ORPCError('BAD_REQUEST', {
            message: parsed.error.issues[0]?.message ?? 'Invalid settings',
            data: {
              issues: parsed.error.issues.map((i) => ({
                path: i.path.join('.'),
                message: i.message,
              })),
            },
          })
        }
        return saveSettings(context.tx, context.scope.storeId, parsed.data)
      }),
  },

  /** Documents and refunds for the order card. */
  forOrder: can(permissions.ORDERS_READ)
    .input(z.object({ orderId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const docs = await documentsForOrder(context.tx, input.orderId)
      const refunds = await orderRefunds(context.tx, input.orderId)
      const settings = await loadSettings(context.tx, context.scope.storeId)
      return {
        documents: docs.map((d) => ({
          id: d.id,
          kind: d.kind,
          number: d.number,
          status: d.status,
          reportedPeriod: d.reportedPeriod,
          refundId: d.refundId,
          totalPaise: d.totalPaise,
          buyerGstin: d.buyerGstin,
          pdfStatus: d.pdfStatus,
          pdfError: d.pdfError,
          issuedAt: d.issuedAt,
          invoiceDate: d.invoiceDate,
        })),
        refunds,
        enabled: {
          tax_invoice: settings.documents.tax_invoice.enabled,
          credit_note: settings.documents.credit_note.enabled,
          packing_slip: settings.documents.packing_slip.enabled,
          order_confirmation: settings.documents.order_confirmation.enabled,
        },
      }
    }),

  /** Packing slips and order confirmations: unnumbered, issued on the spot. */
  issue: can(permissions.ORDERS_WRITE)
    .input(z.object({ orderId: z.uuid(), kind: z.enum(['packing_slip', 'order_confirmation']) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      try {
        const { row } = await issueDocument(
          context.tx,
          context.scope.storeId,
          input.orderId,
          input.kind,
        )
        const done = await renderAndStore(renderDeps(context), row.id)
        return { id: done.id, number: done.number }
      } catch (err) {
        asOrpc(err)
      }
    }),

  queue: {
    list: can(permissions.ORDERS_READ)
      .input(
        z.object({
          from: z.coerce.date().optional(),
          to: z.coerce.date().optional(),
          /** One GST number's drafts; omitted lists every GST number's. */
          gstRegistrationId: Gst,
        }),
      )
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const rows = await listQueue(context.tx, input)
        return rows.map((r) => {
          const doc = DocumentSnapshotSchema.parse(r.snapshot)
          return {
            id: r.id,
            orderId: r.orderId,
            orderName: doc.order.name,
            placedAt: doc.order.placedAt,
            buyerName: r.buyerName,
            buyerGstin: r.buyerGstin,
            export: doc.exportSupply?.countryName ?? null,
            totalPaise: r.totalPaise,
            eligibleAt: r.eligibleAt,
            dispatchedAt: r.dispatchedAt,
            defaultDate: defaultInvoiceDate(r),
          }
        })
      }),
    /** Add orders by hand, e.g. a pre-order the merchant wants invoiced now. */
    add: can(permissions.ORDERS_WRITE)
      .input(
        z.object({
          orderIds: z.array(z.uuid()).max(100).default([]),
          orderNumbers: z.array(z.number().int().positive()).max(100).default([]),
        }),
      )
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        try {
          const byNumber = await orderIdsByNumber(context.tx, input.orderNumbers)
          let added = 0
          for (const orderId of [...input.orderIds, ...byNumber.ids]) {
            const queued = await enqueueOrderParcels(
              context.tx,
              context.scope.storeId,
              orderId,
              'manual',
            )
            // One draft per parcel; a split order adds one per GSTIN.
            added += queued.filter((q) => q.created).length
          }
          return { added, missing: byNumber.missing }
        } catch (err) {
          asOrpc(err)
        }
      }),
    remove: can(permissions.ORDERS_WRITE)
      .input(z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return { removed: await removeFromQueue(context.tx, input.ids) }
      }),
    /** The numbers a batch would get, in the order it would get them. Nothing is written. */
    preview: can(permissions.ORDERS_READ)
      .input(IssueBatch)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        try {
          return await issueDrafts(context.tx, context.scope.storeId, input.items, {
            commit: false,
          })
        } catch (err) {
          asOrpc(err)
        }
      }),
    /** Review, Issue: numbers are assigned here and never change afterwards. */
    issue: can(permissions.ORDERS_WRITE)
      .input(IssueBatch)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        try {
          const plan = await issueDrafts(context.tx, context.scope.storeId, input.items, {
            commit: true,
          })
          // PDFs render in the worker so a large batch returns at once.
          if (context.appJobs) {
            for (const p of plan) {
              await enqueueAppJob(
                context.appJobs,
                {
                  storeId: context.scope.storeId,
                  pluginId: GST_INVOICES_ID,
                  name: 'render',
                  data: { invoiceId: p.id },
                },
                `render:${p.id}`,
              )
            }
          }
          return plan
        } catch (err) {
          asOrpc(err)
        }
      }),
  },

  /** Cancel an issued invoice that has not been reported in a filed GSTR-1. */
  cancel: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), reason: z.string().trim().min(3).max(200) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      try {
        const row = await cancelInvoice(context.tx, input.id, input.reason)
        return { id: row.id, number: row.number }
      } catch (err) {
        asOrpc(err)
      }
    }),

  /** GST return months, filed and closed per GST number (GSTR-1 is filed per GSTIN). */
  periods: {
    list: can(permissions.ORDERS_READ)
      .input(z.object({ gstRegistrationId: Gst }).optional())
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const gst = await gstScope(context, input?.gstRegistrationId)
        return listPeriods(context.tx, context.scope.storeId, gst)
      }),
    setFiled: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ period: Period, filed: z.boolean(), gstRegistrationId: Gst }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const gst = await gstScope(context, input.gstRegistrationId)
        await markFiled(context.tx, context.scope.storeId, input.period, input.filed, gst)
        return { ok: true }
      }),
    setClosed: can(permissions.SETTINGS_MANAGE)
      .input(z.object({ period: Period, closed: z.boolean(), gstRegistrationId: Gst }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const gst = await gstScope(context, input.gstRegistrationId)
        await setClosed(context.tx, context.scope.storeId, input.period, input.closed, gst)
        return { ok: true }
      }),
  },

  /** The next number each series will print this financial year, for the settings preview. */
  seriesNext: can(permissions.SETTINGS_READ)
    .input(z.object({ gstRegistrationId: Gst }).optional())
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const settings = await loadSettings(context.tx, context.scope.storeId)
      return nextNumbers(context, settings, await gstScope(context, input?.gstRegistrationId))
    }),

  regenerate: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        buyerGstin: z.string().trim().max(15).nullable().optional(),
        exportDetails: z
          .object({
            portCode: z.string().trim().max(10).nullable().optional(),
            shippingBillNumber: z.string().trim().max(20).nullable().optional(),
            shippingBillDate: z.iso.date().nullable().optional(),
            currency: z.string().trim().length(3).nullable().optional(),
            exchangeRate: z.number().positive().nullable().optional(),
          })
          .optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      try {
        const row = await regenerateDocument(context.tx, context.scope.storeId, input.id, {
          buyerGstin: input.buyerGstin,
          exportDetails: input.exportDetails
            ? Object.fromEntries(
                Object.entries(input.exportDetails).filter(([, v]) => v !== undefined),
              )
            : undefined,
        })
        if (row.status === 'draft') return { id: row.id, number: row.number }
        const done = await renderAndStore(renderDeps(context), row.id)
        return { id: done.id, number: done.number }
      } catch (err) {
        asOrpc(err)
      }
    }),

  creditNote: can(permissions.ORDERS_REFUND)
    .input(z.object({ refundId: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const issued =
        (await issueCreditNotes(context.tx, context.scope.storeId, input.refundId).catch(asOrpc)) ??
        []
      if (issued.length === 0) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Issue the tax invoice first; a credit note reverses an invoice.',
        })
      }
      // A refund on an order billed in parcels makes one credit note per GST number.
      const done = []
      for (const note of issued) done.push(await renderAndStore(renderDeps(context), note.row.id))
      const [first] = done
      return { id: first?.id ?? '', number: first?.number ?? null }
    }),

  list: can(permissions.ORDERS_READ)
    .input(Filter.extend({ page: z.number().int().min(1).max(1000).default(1) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const limit = 25
      return listDocuments(context.tx, { ...input, limit, offset: (input.page - 1) * limit })
    }),

  download: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      try {
        const [row] = await documentsByIds(context.tx, [input.id])
        if (!row) throw new InvoiceError('not_found', 'Document not found')
        return file(await pdfBytes(renderDeps(context), row.id), pdfFilename(row))
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
      for (const row of rows)
        files.push({ name: pdfFilename(row), bytes: await pdfBytes(deps, row.id) })
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
      for (const row of rows) files.push(await pdfBytes(deps, row.id))
      return file(await mergePdfs(files), 'invoices-print.pdf')
    }),

  /** Queue an email of each document to its buyer; poll `batch` for progress. */
  bulkEmail: can(permissions.ORDERS_WRITE)
    .use(heavy('bulk'))
    .input(Selection)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      if (!context.appJobs)
        throw new ORPCError('SERVICE_UNAVAILABLE', {
          message: 'The worker queue is not configured',
        })
      const ids = await selectedIds(context, input)
      const batch = await createEmailBatch(context.tx, context.scope.storeId, ids.length)
      // One job per 20 documents so progress moves and a failure retries a small slice.
      for (let i = 0; i < ids.length; i += 20) {
        await enqueueAppJob(context.appJobs, {
          storeId: context.scope.storeId,
          pluginId: GST_INVOICES_ID,
          name: 'email',
          data: { batchId: batch.id, ids: ids.slice(i, i + 20) },
        })
      }
      return { batchId: batch.id, total: ids.length }
    }),

  batch: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const b = await emailBatch(context.tx, input.id)
      if (!b) throw new ORPCError('NOT_FOUND', { message: 'Batch not found' })
      return {
        total: b.total,
        sent: b.sent,
        failed: b.failed,
        errors: (b.errors as string[]).slice(-5),
      }
    }),

  /** One GST number's GSTR-1 CSVs for [from, to) as a zip, one file per table. */
  gstr1: can(permissions.ORDERS_READ)
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date(), gstRegistrationId: Gst }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const gst = await gstScope(context, input.gstRegistrationId)
      const out = await gstr1ForPeriod(context.tx, input.from, input.to, gst)
      const enc = new TextEncoder()
      const files = Object.entries(out).map(([name, body]) => ({
        name: `${name}.csv`,
        bytes: enc.encode(body),
      }))
      // Named after the GSTIN it is for: a store with several files one GSTR-1 each.
      const issuer = await documentIssuer(context.tx, gst)
      const name = issuer ? `gstr1-${issuer.gstin}.zip` : 'gstr1.zip'
      return file(zipFiles(files), name, 'application/zip')
    }),

  /** One document with its status, for the invoice page. */
  get: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const [row] = await documentsByIds(context.tx, [input.id])
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
      return {
        id: row.id,
        orderId: row.orderId,
        kind: row.kind,
        status: row.status,
        number: row.number,
        seriesId: row.seriesId,
        invoiceDate: row.invoiceDate,
        reportedPeriod: row.reportedPeriod,
        cancelReason: row.cancelReason,
        pdfStatus: row.pdfStatus,
        snapshot: DocumentSnapshotSchema.parse(row.snapshot),
      }
    }),

  /** Snapshot of a document, for the admin to show what was printed. */
  snapshot: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const [row] = await documentsByIds(context.tx, [input.id])
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'Document not found' })
      return DocumentSnapshotSchema.parse(row.snapshot)
    }),
}
