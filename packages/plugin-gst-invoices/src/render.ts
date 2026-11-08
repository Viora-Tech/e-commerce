import { media, newId, type StoreTx } from '@commerce/db'
import {
  type DocumentSnapshot,
  DocumentSnapshotSchema,
  type InvoiceSettings,
} from '@commerce/invoices'
import type { StorageProvider } from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { getDocument, InvoiceError, type InvoiceRow, loadSettings } from './issue'
import { invoice } from './schema'

export type RenderDeps = {
  storeId: string
  inStore<T>(fn: (tx: StoreTx) => Promise<T>): Promise<T>
  storage(): Promise<StorageProvider>
}

/**
 * Invoices are private: the key is unguessable and lives outside the public
 * media prefix, and it is only ever read back through the storage contract
 * (signed storefront link or the admin), never linked by public URL.
 */
export const pdfKeyFor = (storeId: string) => `stores/${storeId}/private/invoices/${newId()}.pdf`

const EXT_TYPES = ['image/png', 'image/jpeg'] as const

async function mediaDataUri(
  tx: StoreTx,
  storage: StorageProvider,
  mediaId: string | null,
): Promise<string | null> {
  if (!mediaId) return null
  const [m] = await tx.select().from(media).where(eq(media.id, mediaId))
  if (!m?.key || !EXT_TYPES.includes(m.contentType as (typeof EXT_TYPES)[number])) return null
  const bytes = await storage.get(m.key).catch(() => null)
  if (!bytes) return null
  return `data:${m.contentType};base64,${Buffer.from(bytes).toString('base64')}`
}

/** A PDF from a snapshot with the store's current look (logo, colour, template). */
export async function renderSnapshot(
  deps: RenderDeps,
  doc: DocumentSnapshot,
  settings?: InvoiceSettings,
): Promise<Uint8Array> {
  const storage = await deps.storage()
  const { s, logo, signature } = await deps.inStore(async (tx) => {
    const s = settings ?? (await loadSettings(tx, deps.storeId))
    return {
      s,
      logo: await mediaDataUri(tx, storage, s.logoMediaId),
      signature: await mediaDataUri(tx, storage, s.signatureMediaId),
    }
  })
  // The PDF renderer (React PDF, fonts, pdf-lib) loads on the first PDF, not with every process
  // that loads the plugin: it is the biggest library the worker would otherwise keep resident.
  const { renderDocumentToBuffer } = await import('@commerce/invoices/render')
  return renderDocumentToBuffer({ doc, settings: s, assets: { logo, signature } })
}

/** Render a stored document and keep the file; records the failure instead of throwing it away. */
export async function renderAndStore(deps: RenderDeps, invoiceId: string): Promise<InvoiceRow> {
  const row = await deps.inStore((tx) => getDocument(tx, invoiceId))
  if (!row) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  try {
    const bytes = await renderSnapshot(deps, DocumentSnapshotSchema.parse(row.snapshot))
    const storage = await deps.storage()
    const key = row.pdfKey ?? pdfKeyFor(deps.storeId)
    await storage.put({ key, body: bytes, contentType: 'application/pdf' })
    const [updated] = await deps.inStore((tx) =>
      tx
        .update(invoice)
        .set({ pdfKey: key, pdfStatus: 'ready', pdfError: null, updatedAt: new Date() })
        .where(eq(invoice.id, invoiceId))
        .returning(),
    )
    return updated ?? row
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await deps.inStore((tx) =>
      tx
        .update(invoice)
        .set({ pdfStatus: 'failed', pdfError: message.slice(0, 500), updatedAt: new Date() })
        .where(eq(invoice.id, invoiceId)),
    )
    throw err
  }
}

/** The document's PDF: the stored file when current, else rendered (and stored) now. */
export async function pdfBytes(deps: RenderDeps, invoiceId: string): Promise<Uint8Array> {
  let row = await deps.inStore((tx) => getDocument(tx, invoiceId))
  if (!row) throw new InvoiceError('not_found', `invoice ${invoiceId} not found`)
  if (row.pdfStatus === 'ready' && row.pdfKey) {
    const stored = await (await deps.storage()).get(row.pdfKey)
    if (stored) return stored
  }
  row = await renderAndStore(deps, invoiceId)
  const stored = row.pdfKey ? await (await deps.storage()).get(row.pdfKey) : null
  if (!stored) throw new Error(`invoice ${invoiceId} rendered but the file is missing`)
  return stored
}

/** "INV-25-26-0007.pdf", or "Packing-slip-1042.pdf" for unnumbered documents. */
export function pdfFilename(row: Pick<InvoiceRow, 'kind' | 'number' | 'snapshot'>): string {
  if (row.number) return `${row.number.replace(/\//g, '-')}.pdf`
  const doc = DocumentSnapshotSchema.safeParse(row.snapshot)
  const order = doc.success ? doc.data.order.name.replace('#', '') : 'order'
  const label = row.kind === 'packing_slip' ? 'Packing-slip' : 'Order-confirmation'
  return `${label}-${order}.pdf`
}
