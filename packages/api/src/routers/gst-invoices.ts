import { loadEnv } from '@commerce/config'
import { enqueueAppJob, permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { DOCUMENT_KINDS, DocumentSnapshotSchema, InvoiceSettingsSchema } from '@commerce/invoices'
import { mergePdfs, zipFiles } from '@commerce/invoices/render'
import {
  documentIds,
  documentsByIds,
  documentsForOrder,
  GST_INVOICES_ID,
  gstr1ForPeriod,
  InvoiceError,
  issueCreditNote,
  issueDocument,
  listDocuments,
  loadSettings,
  pdfBytes,
  pdfFilename,
  type RenderDeps,
  regenerateDocument,
  renderAndStore,
  saveSettings,
} from '@commerce/plugin-gst-invoices/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import { getStoreApps, storeRegistries } from '../services/apps.service'
import {
  createEmailBatch,
  emailBatch,
  mediaUrls,
  orderRefunds,
  storeName,
} from '../services/gst-invoices.service'
import { storageProviderFor } from '../services/media.service'

const secret = () => loadEnv(process.env).SETTINGS_SECRET

type Ctx = { tx: StoreTx; scope: { storeId: string } }

/** Every procedure here needs the store to have installed the app. */
async function requireInstalled(context: Ctx) {
  const apps = await getStoreApps(context.tx, context.scope.storeId)
  if (!apps.installed.includes(GST_INVOICES_ID)) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the GST invoices app first' })
  }
}

/** Render deps bound to the request's own store-scoped transaction. */
function renderDeps(context: Ctx): RenderDeps {
  return {
    storeId: context.scope.storeId,
    inStore: (fn) => fn(context.tx),
    storage: async () => {
      const { storage } = await storeRegistries(context.tx, context.scope.storeId)
      return storageProviderFor(context.tx, context.scope.storeId, storage, secret())
    },
  }
}

function asOrpc(err: unknown): never {
  if (err instanceof InvoiceError) {
    const code =
      err.code === 'not_found' || err.code === 'order_not_found' ? 'NOT_FOUND' : 'BAD_REQUEST'
    throw new ORPCError(code, { message: err.message })
  }
  if (err instanceof z.ZodError) {
    throw new ORPCError('BAD_REQUEST', { message: err.issues[0]?.message ?? 'Invalid settings' })
  }
  throw err
}

const Filter = z.object({
  q: z.string().max(100).optional(),
  kind: z.enum(DOCUMENT_KINDS).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
})

/** Rows or "everything matching the filter", capped so one click cannot render the year. */
const Selection = z.union([
  z.object({ ids: z.array(z.uuid()).min(1).max(200) }),
  z.object({ filter: Filter }),
])

async function selectedIds(context: Ctx, input: z.infer<typeof Selection>) {
  return 'ids' in input ? input.ids : documentIds(context.tx, input.filter, 200)
}

const file = (bytes: Uint8Array, name: string, type = 'application/pdf') =>
  new File([bytes as Uint8Array<ArrayBuffer>], name, { type })

export const gstInvoicesRouter = {
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
          refundId: d.refundId,
          totalPaise: d.totalPaise,
          buyerGstin: d.buyerGstin,
          pdfStatus: d.pdfStatus,
          pdfError: d.pdfError,
          issuedAt: d.issuedAt,
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

  issue: can(permissions.ORDERS_WRITE)
    .input(
      z.object({
        orderId: z.uuid(),
        kind: z.enum(['tax_invoice', 'packing_slip', 'order_confirmation']),
        buyerGstin: z.string().trim().max(15).nullable().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      try {
        const { row } = await issueDocument(
          context.tx,
          context.scope.storeId,
          input.orderId,
          input.kind,
          {
            buyerGstin: input.buyerGstin ?? null,
          },
        )
        return renderAndStore(renderDeps(context), row.id).then((r) => ({
          id: r.id,
          number: r.number,
        }))
      } catch (err) {
        asOrpc(err)
      }
    }),

  regenerate: can(permissions.ORDERS_WRITE)
    .input(z.object({ id: z.uuid(), buyerGstin: z.string().trim().max(15).nullable().optional() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      try {
        const row = await regenerateDocument(context.tx, context.scope.storeId, input.id, {
          buyerGstin: input.buyerGstin,
        })
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
      const issued = await issueCreditNote(context.tx, context.scope.storeId, input.refundId)
      if (!issued) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Issue the tax invoice first; a credit note reverses an invoice.',
        })
      }
      const done = await renderAndStore(renderDeps(context), issued.row.id)
      return { id: done.id, number: done.number }
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

  /** GSTR-1 CSVs for [from, to) as a zip, one file per table. */
  gstr1: can(permissions.ORDERS_READ)
    .input(z.object({ from: z.coerce.date(), to: z.coerce.date() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const out = await gstr1ForPeriod(context.tx, input.from, input.to)
      const enc = new TextEncoder()
      const files = Object.entries(out).map(([name, body]) => ({
        name: `${name}.csv`,
        bytes: enc.encode(body),
      }))
      return file(zipFiles(files), 'gstr1.zip', 'application/zip')
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
