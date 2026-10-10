/** SOURCE OF TRUTH: purchase documents (supplier invoices, Bills of Entry, freight, clearing
 * and bank bills) on a purchase order or an inbound shipment — WHAT: upload to private
 * storage, list, read the file back, delete, queue an AI read, reset an applied one, and the
 * queue the worker reads from. WHY: one place decides where the file lives (never a public
 * URL), who owns it (RLS plus an owner check) and which status moves are allowed.
 */
import { settingsSecret } from '@commerce/config'
import { inboundShipment, newId, purchaseDocument, purchaseOrder, type StoreTx } from '@commerce/db'
import type { StorageProvider } from '@commerce/storage'
import { desc, eq } from 'drizzle-orm'
import { storageForStore } from '../media/settings'
import { registriesForStore } from '../plugins/registries'
import {
  isPurchaseDocumentType,
  PURCHASE_DOCUMENT_MAX_BYTES,
  PURCHASE_DOCUMENT_TYPES,
  type PurchaseDocumentKind,
} from './document-rules'
import { InventoryError } from './levels'

/** Queue the worker reads document reads from. Braces keep every key on one slot. */
export const PURCHASE_DOCUMENT_QUEUE = '{ai}-purchase-documents'

export type PurchaseDocumentJob = { storeId: string; documentId: string }

export type PurchaseDocumentQueue = {
  add(
    name: string,
    data: PurchaseDocumentJob,
    opts?: { jobId?: string; attempts?: number; removeOnComplete?: boolean },
  ): Promise<unknown>
}

export type PurchaseDocumentRow = typeof purchaseDocument.$inferSelect

export type DocumentOwner = { purchaseOrderId: string } | { inboundShipmentId: string }

export type UploadedFile = { name: string; type: string; bytes: Uint8Array }

/** The store's storage, where the private files live. */
export async function documentStorage(
  tx: StoreTx,
  storeId: string,
  secret?: string,
): Promise<StorageProvider> {
  const registries = await registriesForStore(tx, storeId)
  return storageForStore(tx, storeId, registries.storage, secret ?? settingsSecret())
}

/** The owner, read under RLS: another store's id is "not found". */
async function assertDocumentOwner(tx: StoreTx, storeId: string, owner: DocumentOwner) {
  if ('purchaseOrderId' in owner) {
    const [po] = await tx
      .select({ id: purchaseOrder.id })
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, owner.purchaseOrderId))
    if (!po) throw new InventoryError('PO_NOT_FOUND', 'Purchase order not found', { storeId })
    return
  }
  const [s] = await tx
    .select({ id: inboundShipment.id })
    .from(inboundShipment)
    .where(eq(inboundShipment.id, owner.inboundShipmentId))
  if (!s) throw new InventoryError('SHIPMENT_NOT_FOUND', 'Inbound shipment not found', { storeId })
}

/** A file name safe to show and to send back as a download name. */
function cleanName(name: string, ext: string): string {
  const base = name
    .replace(/[\\/:*?"<>|\p{Cc}]+/gu, ' ')
    .trim()
    .slice(0, 120)
  return base || `document.${ext}`
}

/**
 * Stores the file privately and records it, waiting to be read. PDF, JPG or PNG, at most
 * 15 MB; the bytes are checked here whatever the browser said.
 */
export async function uploadPurchaseDocument(
  tx: StoreTx,
  storeId: string,
  input: { owner: DocumentOwner; kind: PurchaseDocumentKind; file: UploadedFile; userId: string },
): Promise<PurchaseDocumentRow> {
  const mime = input.file.type.toLowerCase()
  if (!isPurchaseDocumentType(mime)) {
    throw new InventoryError('DOC_TYPE', 'Upload a PDF, JPG or PNG file', { storeId })
  }
  const size = input.file.bytes.byteLength
  if (size === 0 || size > PURCHASE_DOCUMENT_MAX_BYTES) {
    throw new InventoryError('DOC_SIZE', 'The file must be under 15 MB', { storeId })
  }
  await assertDocumentOwner(tx, storeId, input.owner)
  const id = newId()
  const ext = PURCHASE_DOCUMENT_TYPES[mime] as string
  const key = `stores/${storeId}/private/purchase-documents/${id}.${ext}`
  const [row] = await tx
    .insert(purchaseDocument)
    .values({
      id,
      storeId,
      purchaseOrderId: 'purchaseOrderId' in input.owner ? input.owner.purchaseOrderId : null,
      inboundShipmentId: 'inboundShipmentId' in input.owner ? input.owner.inboundShipmentId : null,
      kind: input.kind,
      fileKey: key,
      fileName: cleanName(input.file.name, ext),
      mimeType: mime,
      sizeBytes: size,
      uploadedBy: input.userId,
    })
    .returning()
  // After the insert: a storage failure throws and the row rolls back with it.
  const storage = await documentStorage(tx, storeId)
  await storage.put({ key, body: input.file.bytes, contentType: mime })
  return row as PurchaseDocumentRow
}

/** The documents on an order or a shipment, newest first, without what the AI read. */
export async function listPurchaseDocuments(tx: StoreTx, owner: DocumentOwner) {
  return tx
    .select({
      id: purchaseDocument.id,
      kind: purchaseDocument.kind,
      fileName: purchaseDocument.fileName,
      mimeType: purchaseDocument.mimeType,
      sizeBytes: purchaseDocument.sizeBytes,
      status: purchaseDocument.status,
      error: purchaseDocument.error,
      appliedAt: purchaseDocument.appliedAt,
      createdAt: purchaseDocument.createdAt,
    })
    .from(purchaseDocument)
    .where(
      'purchaseOrderId' in owner
        ? eq(purchaseDocument.purchaseOrderId, owner.purchaseOrderId)
        : eq(purchaseDocument.inboundShipmentId, owner.inboundShipmentId),
    )
    .orderBy(desc(purchaseDocument.createdAt))
}

/** One document row (RLS: another store's id finds nothing). */
export async function loadPurchaseDocument(
  tx: StoreTx,
  storeId: string,
  id: string,
  lock = false,
): Promise<PurchaseDocumentRow> {
  const q = tx.select().from(purchaseDocument).where(eq(purchaseDocument.id, id))
  const [row] = lock ? await q.for('update') : await q
  if (!row) throw new InventoryError('DOC_NOT_FOUND', 'Document not found', { storeId })
  return row
}

/** The file's bytes, for the admin's preview and download. */
export async function purchaseDocumentFile(tx: StoreTx, storeId: string, id: string) {
  const row = await loadPurchaseDocument(tx, storeId, id)
  const bytes = await (await documentStorage(tx, storeId)).get(row.fileKey)
  if (!bytes) throw new InventoryError('DOC_FILE_MISSING', 'The file is missing', { storeId })
  return { bytes, name: row.fileName, type: row.mimeType }
}

/** Removes the record and the file. What was applied from it stays on the order. */
export async function deletePurchaseDocument(tx: StoreTx, storeId: string, id: string) {
  const row = await loadPurchaseDocument(tx, storeId, id, true)
  await tx.delete(purchaseDocument).where(eq(purchaseDocument.id, id))
  const storage = await documentStorage(tx, storeId)
  // The row is gone either way; a file the bucket cannot delete now is only an orphan.
  await storage.delete(row.fileKey).catch(() => undefined)
}

/** Marks a document to be read (again). Refused once applied: reset it first. */
export async function queuePurchaseDocumentRead(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<void> {
  const row = await loadPurchaseDocument(tx, storeId, id, true)
  if (row.status === 'applied') {
    throw new InventoryError('DOC_APPLIED', 'This document was already applied', { storeId })
  }
  if (row.status === 'reading') return
  await tx
    .update(purchaseDocument)
    .set({ status: 'pending', error: null, updatedAt: new Date() })
    .where(eq(purchaseDocument.id, id))
}

/**
 * Lets an applied document be applied again (after the merchant undid or corrected what it
 * changed by hand). Nothing that was applied is undone here.
 */
export async function resetPurchaseDocument(tx: StoreTx, storeId: string, id: string) {
  const row = await loadPurchaseDocument(tx, storeId, id, true)
  if (row.status !== 'applied') {
    throw new InventoryError('DOC_NOT_APPLIED', 'This document has not been applied', { storeId })
  }
  await tx
    .update(purchaseDocument)
    .set({ status: 'ready', appliedAt: null, appliedBy: null, updatedAt: new Date() })
    .where(eq(purchaseDocument.id, id))
}
