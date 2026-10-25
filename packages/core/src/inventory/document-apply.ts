/** SOURCE OF TRUTH: applying a reviewed purchase document — WHAT: in one transaction, sets
 * the draft order lines the merchant ticked (quantity, price, HSN, new products found by
 * SKU), the currency and exchange rate (the Bill of Entry's rate onto the shipment's orders),
 * the Bill of Entry details on the shipment, and the charges (duty, freight, clearing,
 * bank, goods adjustment), then marks the document applied. WHY: the AI only proposes;
 * this is the one write path, it refuses a second apply, and every cost change goes through
 * the same order save and charge services so landed cost and stock value follow.
 */
import {
  inboundShipment,
  purchaseDocument,
  purchaseOrder,
  purchaseOrderLine,
  type StoreTx,
} from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import { addPurchaseCharge } from './charges'
import { lockCostingGroup, recost } from './costing'
import { loadPurchaseDocument } from './documents'
import type { PurchaseCurrency } from './landed-cost'
import { InventoryError } from './levels'
import { loadPurchaseOrder, savePurchaseOrder } from './purchase-orders'
import type { ApplyDocument } from './schemas'

export type ApplyDocumentResult = {
  linesChanged: number
  ordersRated: number
  chargesAdded: number
}

type Owner = { purchaseOrderId: string } | { inboundShipmentId: string }
type LineChange = ApplyDocument['lines'][number]

const FINISHED = new Set(['received', 'closed', 'cancelled'])

/** The order each named line is on, read under RLS and limited to the document's owner. */
async function ordersOfLines(tx: StoreTx, storeId: string, owner: Owner, lineIds: string[]) {
  if (lineIds.length === 0) return new Map<string, string>()
  const rows = await tx
    .select({
      id: purchaseOrderLine.id,
      orderId: purchaseOrderLine.purchaseOrderId,
      shipmentId: purchaseOrder.inboundShipmentId,
    })
    .from(purchaseOrderLine)
    .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
    .where(inArray(purchaseOrderLine.id, lineIds))
  const ok = rows.filter((r) =>
    'purchaseOrderId' in owner
      ? r.orderId === owner.purchaseOrderId
      : r.shipmentId === owner.inboundShipmentId,
  )
  if (ok.length !== new Set(lineIds).size) {
    throw new InventoryError('DOC_LINE_NOT_FOUND', 'One of the lines is not on this order', {
      storeId,
    })
  }
  return new Map(ok.map((r) => [r.id, r.orderId]))
}

/**
 * One draft order saved with `changes` merged into its lines (and the currency and rate when
 * given), through the normal order save so line ids stay and the order is recosted.
 */
async function rewriteDraft(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  changes: LineChange[],
  rate: { currency: PurchaseCurrency; fxRate: string | undefined } | null,
) {
  const { po, lines } = await loadPurchaseOrder(tx, storeId, orderId)
  if (po.status !== 'draft') {
    throw new InventoryError(
      'PO_LINES_LOCKED',
      'Quantities and prices can only change on a draft; add a goods adjustment instead',
      { storeId },
    )
  }
  const next = lines.map((l) => ({
    variantId: l.variantId,
    quantity: l.quantity,
    unitPriceMinor: l.unitPriceMinor,
    hsnCode: l.hsnCode ?? '',
  }))
  for (const change of changes) {
    const current = change.lineId ? lines.find((l) => l.id === change.lineId) : undefined
    if (current && current.variantId !== change.variantId) {
      throw new InventoryError('DOC_LINE_MISMATCH', 'That line is for another product', {
        storeId,
      })
    }
    const at = next.findIndex((l) => l.variantId === change.variantId)
    const value = {
      variantId: change.variantId,
      quantity: change.quantity,
      unitPriceMinor: change.unitPriceMinor,
      // A blank HSN on the document keeps the one the order already has.
      hsnCode: change.hsnCode || next[at]?.hsnCode || '',
    }
    if (at >= 0) next[at] = value
    else next.push(value)
  }
  const currency = (rate?.currency ?? po.currency) as PurchaseCurrency
  await savePurchaseOrder(tx, storeId, {
    id: po.id,
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    supplierEmail: po.supplierEmail ?? '',
    supplierPhone: po.supplierPhone ?? undefined,
    locationId: po.locationId,
    expectedAt: po.expectedAt,
    currency,
    fxRate: currency === 'INR' ? '1' : (rate?.fxRate ?? po.fxRate),
    note: po.note ?? undefined,
    lines: next,
  })
}

/**
 * The rate (and, on a draft, the currency) for one order. Finished orders keep theirs; an
 * order in another currency than the document's is left alone. True when it changed.
 */
async function rateOrder(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  rate: { currency: PurchaseCurrency; fxRate: string | undefined },
  canSwitchCurrency: boolean,
): Promise<boolean> {
  const group = await lockCostingGroup(tx, storeId, { purchaseOrderId: orderId })
  const { po } = await loadPurchaseOrder(tx, storeId, orderId)
  if (FINISHED.has(po.status)) return false
  const switching = po.currency !== rate.currency
  if (switching && !(canSwitchCurrency && po.status === 'draft')) return false
  const fxRate = rate.currency === 'INR' ? '1' : (rate.fxRate ?? po.fxRate)
  await tx
    .update(purchaseOrder)
    .set({ currency: rate.currency, fxRate, updatedAt: new Date() })
    .where(eq(purchaseOrder.id, po.id))
  await recost(tx, storeId, group)
  return true
}

/** Live orders in a shipment, for the Bill of Entry's rate. */
async function shipmentOrderIds(tx: StoreTx, shipmentId: string): Promise<string[]> {
  const rows = await tx
    .select({ id: purchaseOrder.id })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.inboundShipmentId, shipmentId))
  return rows.map((r) => r.id)
}

/**
 * Applies what the merchant confirmed from a document that has been read. Nothing is written
 * unless every part succeeds (the caller's transaction). A document applies once: reset it to
 * apply again.
 */
export async function applyPurchaseDocument(
  tx: StoreTx,
  storeId: string,
  input: ApplyDocument,
  userId: string,
): Promise<ApplyDocumentResult> {
  const doc = await loadPurchaseDocument(tx, storeId, input.id, true)
  if (doc.status === 'applied' || doc.appliedAt) {
    throw new InventoryError('DOC_APPLIED', 'This document was already applied', { storeId })
  }
  if (doc.status !== 'ready') {
    throw new InventoryError('DOC_NOT_READY', 'This document has not been read yet', { storeId })
  }
  const owner: Owner = doc.purchaseOrderId
    ? { purchaseOrderId: doc.purchaseOrderId }
    : { inboundShipmentId: doc.inboundShipmentId as string }
  const rate = input.currency ? { currency: input.currency, fxRate: input.fxRate } : null

  // 1. Draft lines, grouped by the order each one is on (new products only on an order).
  const named = input.lines.flatMap((l) => (l.lineId ? [l.lineId] : []))
  const orderOf = await ordersOfLines(tx, storeId, owner, named)
  const byOrder = new Map<string, LineChange[]>()
  for (const change of input.lines) {
    const orderId = change.lineId
      ? (orderOf.get(change.lineId) as string)
      : 'purchaseOrderId' in owner
        ? owner.purchaseOrderId
        : null
    if (!orderId) {
      throw new InventoryError('DOC_NEW_LINE_ON_SHIPMENT', 'Add new products on the order itself', {
        storeId,
      })
    }
    byOrder.set(orderId, [...(byOrder.get(orderId) ?? []), change])
  }
  const rated = new Set<string>()
  for (const [orderId, changes] of byOrder) {
    const own = 'purchaseOrderId' in owner && owner.purchaseOrderId === orderId
    await rewriteDraft(tx, storeId, orderId, changes, own ? rate : null)
    if (own && rate) rated.add(orderId)
  }

  // 2. Currency and rate: the document's order, or every order of the shipment in that currency.
  if (rate) {
    const targets =
      'purchaseOrderId' in owner
        ? [owner.purchaseOrderId]
        : await shipmentOrderIds(tx, owner.inboundShipmentId)
    for (const orderId of targets) {
      if (rated.has(orderId)) continue
      const own = 'purchaseOrderId' in owner
      if (await rateOrder(tx, storeId, orderId, rate, own)) rated.add(orderId)
    }
  }

  // 3. Bill of Entry details on the shipment.
  if (input.billOfEntry && 'inboundShipmentId' in owner) {
    const be = input.billOfEntry
    await tx
      .update(inboundShipment)
      .set({
        ...(be.number ? { billOfEntryNo: be.number } : {}),
        ...(be.date ? { billOfEntryDate: be.date } : {}),
        ...(be.port ? { port: be.port } : {}),
        updatedAt: new Date(),
      })
      .where(eq(inboundShipment.id, owner.inboundShipmentId))
  }

  // 4. Charges on the document's owner; each one recosts the group.
  for (const charge of input.charges) {
    await addPurchaseCharge(tx, storeId, { ...charge, ...owner })
  }

  await tx
    .update(purchaseDocument)
    .set({ status: 'applied', appliedAt: new Date(), appliedBy: userId, updatedAt: new Date() })
    .where(eq(purchaseDocument.id, doc.id))
  // The order and shipment pages remount on updatedAt, so they show what changed.
  if ('purchaseOrderId' in owner) {
    await tx
      .update(purchaseOrder)
      .set({ updatedAt: new Date() })
      .where(eq(purchaseOrder.id, owner.purchaseOrderId))
  } else {
    await tx
      .update(inboundShipment)
      .set({ updatedAt: new Date() })
      .where(eq(inboundShipment.id, owner.inboundShipmentId))
  }
  return {
    linesChanged: input.lines.length,
    ordersRated: rated.size,
    chargesAdded: input.charges.length,
  }
}
