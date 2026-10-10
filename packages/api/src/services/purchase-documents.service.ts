import { parseExtracted } from '@commerce/ai/client'
import {
  type DocumentLineKey,
  loadPurchaseDocument,
  type MatchCandidate,
  matchDocumentLines,
  normaliseSupplierCode,
  type PurchaseDocumentQueue,
  queuePurchaseDocumentRead,
} from '@commerce/core'
import { readPurchaseDocument } from '@commerce/core/ai-runtime'
import {
  type Db,
  inboundShipment,
  purchaseOrder,
  purchaseOrderLine,
  type StoreTx,
  variant,
  withStore,
} from '@commerce/db'
import { and, asc, eq, inArray, ne, sql } from 'drizzle-orm'
import type { StoreScope } from '../procedures'
import { lineDetails } from './purchase-order.service'

// Services are the only code that runs queries. They receive a store-scoped tx.

const title = (d: { productTitle: string; variantTitle: string } | undefined) =>
  d
    ? d.variantTitle && d.variantTitle !== 'Default'
      ? `${d.productTitle} / ${d.variantTitle}`
      : d.productTitle
    : ''

/** The orders a document can change: its own order, or every live order in its shipment. */
async function ordersFor(
  tx: StoreTx,
  doc: { purchaseOrderId: string | null; inboundShipmentId: string | null },
) {
  return tx
    .select({
      id: purchaseOrder.id,
      number: purchaseOrder.number,
      status: purchaseOrder.status,
      supplierName: purchaseOrder.supplierName,
      currency: purchaseOrder.currency,
      fxRate: purchaseOrder.fxRate,
    })
    .from(purchaseOrder)
    .where(
      doc.purchaseOrderId
        ? eq(purchaseOrder.id, doc.purchaseOrderId)
        : and(
            eq(purchaseOrder.inboundShipmentId, doc.inboundShipmentId as string),
            ne(purchaseOrder.status, 'cancelled'),
          ),
    )
    .orderBy(asc(purchaseOrder.number))
}

/** How each line of a read document prints its code, words and HSN, for matching. */
function documentLineKeys(extracted: ReturnType<typeof parseExtracted>): DocumentLineKey[] {
  if (extracted?.shape === 'supplier_invoice') {
    return extracted.data.lines.map((l) => ({
      sku: l.supplierSku.value,
      description: l.description.value,
      hsnCode: l.hsnCode.value,
    }))
  }
  if (extracted?.shape === 'bill_of_entry') {
    return extracted.data.lines.map((l) => ({
      sku: null,
      description: l.description.value,
      hsnCode: l.hsnCode.value,
    }))
  }
  return []
}

/** Store variants whose SKU equals one of `codes`, ignoring case, spaces and dashes. */
async function variantsBySku(tx: StoreTx, codes: string[]) {
  if (codes.length === 0) return []
  return tx
    .select({ id: variant.id, sku: variant.sku })
    .from(variant)
    .where(
      inArray(
        sql<string>`upper(regexp_replace(coalesce(${variant.sku}, ''), '[^A-Za-z0-9]', '', 'g'))`,
        codes,
      ),
    )
    .limit(50)
}

/**
 * Everything the review screen needs for one document: what the AI read, the orders and
 * lines it can change, and the proposed match for every document line (recomputed on each
 * open, so a line added to the order since the read is matched too). No writes.
 */
export async function purchaseDocumentReview(tx: StoreTx, storeId: string, id: string) {
  const doc = await loadPurchaseDocument(tx, storeId, id)
  const extracted = parseExtracted(doc.extracted)
  const orders = await ordersFor(tx, doc)
  const [shipment] = doc.inboundShipmentId
    ? await tx
        .select({
          id: inboundShipment.id,
          number: inboundShipment.number,
          billOfEntryNo: inboundShipment.billOfEntryNo,
          billOfEntryDate: inboundShipment.billOfEntryDate,
          port: inboundShipment.port,
        })
        .from(inboundShipment)
        .where(eq(inboundShipment.id, doc.inboundShipmentId))
    : []
  const lineRows = orders.length
    ? await tx
        .select()
        .from(purchaseOrderLine)
        .where(
          inArray(
            purchaseOrderLine.purchaseOrderId,
            orders.map((o) => o.id),
          ),
        )
        .orderBy(asc(purchaseOrderLine.id))
    : []

  const keys = documentLineKeys(extracted)
  const codes = [...new Set(keys.map((k) => normaliseSupplierCode(k.sku)))].filter((c) => c !== '')
  const onOrder = new Set(lineRows.map((l) => l.variantId))
  // New products by SKU only make sense on one draft order; a shipment adds no lines.
  const extra =
    doc.purchaseOrderId && orders[0]?.status === 'draft'
      ? (await variantsBySku(tx, codes)).filter((v) => !onOrder.has(v.id))
      : []
  const details = await lineDetails(tx, [...onOrder, ...extra.map((v) => v.id)])

  const lines = lineRows.map((l) => {
    const d = details.get(l.variantId)
    return {
      lineId: l.id,
      purchaseOrderId: l.purchaseOrderId,
      variantId: l.variantId,
      quantity: l.quantity,
      received: l.received,
      rejected: l.rejected,
      unitPriceMinor: l.unitPriceMinor,
      hsnCode: l.hsnCode,
      productTitle: d?.productTitle ?? '',
      variantTitle: d?.variantTitle ?? '',
      sku: d?.sku ?? null,
      imageUrl: d?.imageUrl ?? null,
    }
  })
  const extraVariants = extra.map((v) => ({
    variantId: v.id,
    productTitle: details.get(v.id)?.productTitle ?? '',
    variantTitle: details.get(v.id)?.variantTitle ?? '',
    sku: v.sku,
    imageUrl: details.get(v.id)?.imageUrl ?? null,
  }))
  const candidates: MatchCandidate[] = [
    ...lines.map((l) => ({
      lineId: l.lineId,
      variantId: l.variantId,
      sku: l.sku,
      title: title(l),
      hsnCode: l.hsnCode,
    })),
    ...extraVariants.map((v) => ({
      lineId: null,
      variantId: v.variantId,
      sku: v.sku,
      title: title(v),
      hsnCode: null,
    })),
  ]

  return {
    document: {
      id: doc.id,
      kind: doc.kind,
      status: doc.status,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      error: doc.error,
      appliedAt: doc.appliedAt,
      createdAt: doc.createdAt,
      purchaseOrderId: doc.purchaseOrderId,
      inboundShipmentId: doc.inboundShipmentId,
    },
    extracted,
    orders,
    shipment: shipment ?? null,
    lines,
    extraVariants,
    matches: matchDocumentLines(keys, candidates),
  }
}

type ReadContext = {
  db: Db
  scope: StoreScope
  purchaseDocuments?: PurchaseDocumentQueue | undefined
}

/**
 * Queue the AI read once the status change is committed, so the worker never claims a
 * document whose status it cannot see yet. Without a queue (tests) it reads in the request.
 */
export async function startDocumentRead(context: ReadContext, id: string) {
  const { storeId } = context.scope
  await withStore(context.db, storeId, (tx) => queuePurchaseDocumentRead(tx, storeId, id))
  if (context.purchaseDocuments) {
    // BullMQ refuses a custom id with one ':' in it; the time keeps a re-read from being deduplicated.
    await context.purchaseDocuments.add(
      'read',
      { storeId, documentId: id },
      { jobId: `purchase-document-${id}-${Date.now()}`, attempts: 1, removeOnComplete: true },
    )
  } else {
    await readPurchaseDocument({ db: context.db, storeId, documentId: id })
  }
  return withStore(context.db, storeId, async (tx) => {
    const review = await purchaseDocumentReview(tx, storeId, id)
    return review.document
  })
}
