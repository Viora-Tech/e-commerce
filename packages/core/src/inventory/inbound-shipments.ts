/** SOURCE OF TRUTH: inbound shipments (create, edit, delete, add and remove purchase orders)
 * — WHAT: one import consignment (Bill of Entry, container) that carries one or more
 * purchase orders; its charges split across all their lines. WHY: freight and customs are
 * billed per consignment, not per order, so the shared cost has to live above the orders.
 */
import { inboundShipment, newId, purchaseOrder, type StoreTx } from '@commerce/db'
import { eq, sql } from 'drizzle-orm'
import { lockCostingGroup, recost } from './costing'
import { inboundTrackingUrl } from './inbound-tracking'
import { InventoryError, nextDocumentNumber } from './levels'
import type { InboundShipmentInput } from './schemas'

export async function saveInboundShipment(
  tx: StoreTx,
  storeId: string,
  input: InboundShipmentInput,
): Promise<string> {
  const trackingNumber = input.trackingNumber || null
  const fields = {
    carrier: input.carrier ?? null,
    trackingNumber,
    trackingUrl: inboundTrackingUrl(input.carrier, trackingNumber, input.trackingUrl),
    expectedAt: input.expectedAt ?? null,
    reference: input.reference || null,
    billOfEntryNo: input.billOfEntryNo || null,
    billOfEntryDate: input.billOfEntryDate ?? null,
    port: input.port || null,
    arrivedAt: input.arrivedAt ?? null,
    status: input.status,
    note: input.note || null,
    updatedAt: new Date(),
  }
  if (!input.id) {
    const id = newId()
    const number = await nextDocumentNumber(
      tx,
      storeId,
      'inbound_shipment',
      sql<number>`max(${inboundShipment.number})`,
      inboundShipment,
    )
    await tx.insert(inboundShipment).values({ id, storeId, number, ...fields })
    return id
  }
  const [before] = await tx
    .select({ carrier: inboundShipment.carrier, trackingNumber: inboundShipment.trackingNumber })
    .from(inboundShipment)
    .where(eq(inboundShipment.id, input.id))
  // A new tracking number has not been read yet.
  const retracked =
    before && (before.carrier !== fields.carrier || before.trackingNumber !== trackingNumber)
  const [row] = await tx
    .update(inboundShipment)
    .set(retracked ? { ...fields, trackedAt: null } : fields)
    .where(eq(inboundShipment.id, input.id))
    .returning({ id: inboundShipment.id })
  if (!row) {
    throw new InventoryError('SHIPMENT_NOT_FOUND', 'Inbound shipment not found', { storeId })
  }
  return row.id
}

async function findOrder(tx: StoreTx, storeId: string, id: string) {
  const [po] = await tx
    .select({
      id: purchaseOrder.id,
      status: purchaseOrder.status,
      shipmentId: purchaseOrder.inboundShipmentId,
    })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.id, id))
  if (!po) throw new InventoryError('PO_NOT_FOUND', 'Purchase order not found', { storeId })
  return po
}

/**
 * Put a purchase order on this shipment (taking it off any other). The shipment's charges
 * now split across its lines too, so both groups are recosted.
 */
export async function attachPurchaseOrder(
  tx: StoreTx,
  storeId: string,
  shipmentId: string,
  purchaseOrderId: string,
): Promise<void> {
  const po = await findOrder(tx, storeId, purchaseOrderId)
  if (po.status === 'cancelled') {
    throw new InventoryError('PO_CANCELLED', 'This purchase order is cancelled', { storeId })
  }
  if (po.shipmentId === shipmentId) return
  await lockCostingGroup(tx, storeId, { inboundShipmentId: shipmentId })
  const previous = po.shipmentId
    ? await lockCostingGroup(tx, storeId, { inboundShipmentId: po.shipmentId })
    : null
  await tx
    .update(purchaseOrder)
    .set({ inboundShipmentId: shipmentId, updatedAt: new Date() })
    .where(eq(purchaseOrder.id, purchaseOrderId))
  await recost(tx, storeId, await lockCostingGroup(tx, storeId, { inboundShipmentId: shipmentId }))
  if (previous?.shipmentId) {
    await recost(
      tx,
      storeId,
      await lockCostingGroup(tx, storeId, { inboundShipmentId: previous.shipmentId }),
    )
  }
}

/** Take a purchase order off its shipment; it keeps only its own charges from now on. */
export async function detachPurchaseOrder(
  tx: StoreTx,
  storeId: string,
  purchaseOrderId: string,
): Promise<void> {
  const po = await findOrder(tx, storeId, purchaseOrderId)
  if (!po.shipmentId) return
  await lockCostingGroup(tx, storeId, { inboundShipmentId: po.shipmentId })
  await tx
    .update(purchaseOrder)
    .set({ inboundShipmentId: null, updatedAt: new Date() })
    .where(eq(purchaseOrder.id, purchaseOrderId))
  await recost(
    tx,
    storeId,
    await lockCostingGroup(tx, storeId, { inboundShipmentId: po.shipmentId }),
  )
  await recost(tx, storeId, await lockCostingGroup(tx, storeId, { purchaseOrderId }))
}

/** Only an empty shipment can go; its own charges go with it. */
export async function deleteInboundShipment(
  tx: StoreTx,
  storeId: string,
  id: string,
): Promise<void> {
  const group = await lockCostingGroup(tx, storeId, { inboundShipmentId: id })
  const [any] = await tx
    .select({ id: purchaseOrder.id })
    .from(purchaseOrder)
    .where(eq(purchaseOrder.inboundShipmentId, id))
    .limit(1)
  if (any || group.orderIds.length > 0) {
    throw new InventoryError(
      'SHIPMENT_NOT_EMPTY',
      'Remove its purchase orders before deleting this shipment',
      { storeId },
    )
  }
  await tx.delete(inboundShipment).where(eq(inboundShipment.id, id))
}
