import { newId, purchaseOrder, purchaseOrderLine, type StoreTx } from '@commerce/db'
import { asc, eq, sql } from 'drizzle-orm'
import { adjustIncoming, adjustStock, defaultLocationId, InventoryError } from './levels'
import type { PurchaseOrderInput, Receipt } from './schemas'
import { clampReceipt, purchaseOrderStatus, remainingOf } from './stock'

async function nextNumber(tx: StoreTx): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(max(${purchaseOrder.number}), 0) + 1`.mapWith(Number) })
    .from(purchaseOrder)
  return row?.n ?? 1
}

async function load(tx: StoreTx, storeId: string, id: string) {
  const [po] = await tx.select().from(purchaseOrder).where(eq(purchaseOrder.id, id)).for('update')
  if (!po) throw new InventoryError('PO_NOT_FOUND', 'Purchase order not found', { storeId })
  const lines = await tx
    .select()
    .from(purchaseOrderLine)
    .where(eq(purchaseOrderLine.purchaseOrderId, id))
    .orderBy(asc(purchaseOrderLine.id))
  return { po, lines }
}

/**
 * Create a draft, or edit one. Once ordered only the supplier details, dates,
 * costs and note can change: lines are locked because stock is already incoming.
 */
export async function savePurchaseOrder(
  tx: StoreTx,
  storeId: string,
  input: PurchaseOrderInput,
): Promise<string> {
  const fields = {
    supplierName: input.supplierName,
    supplierEmail: input.supplierEmail || null,
    supplierPhone: input.supplierPhone || null,
    expectedAt: input.expectedAt ?? null,
    shippingPaise: input.shippingPaise,
    taxPaise: input.taxPaise,
    note: input.note || null,
    updatedAt: new Date(),
  }
  if (!input.id) {
    const id = newId()
    await tx.insert(purchaseOrder).values({
      id,
      storeId,
      number: await nextNumber(tx),
      locationId: input.locationId || (await defaultLocationId(tx, storeId)),
      status: 'draft',
      ...fields,
    })
    if (input.lines.length) {
      await tx
        .insert(purchaseOrderLine)
        .values(input.lines.map((l) => ({ id: newId(), storeId, purchaseOrderId: id, ...l })))
    }
    return id
  }
  const { po } = await load(tx, storeId, input.id)
  if (po.status === 'closed' || po.status === 'received') {
    throw new InventoryError('PO_LOCKED', 'This purchase order is finished', { storeId })
  }
  if (po.status !== 'draft') {
    await tx.update(purchaseOrder).set(fields).where(eq(purchaseOrder.id, po.id))
    return po.id
  }
  await tx
    .update(purchaseOrder)
    .set({ ...fields, locationId: input.locationId })
    .where(eq(purchaseOrder.id, po.id))
  await tx.delete(purchaseOrderLine).where(eq(purchaseOrderLine.purchaseOrderId, po.id))
  if (input.lines.length) {
    await tx
      .insert(purchaseOrderLine)
      .values(input.lines.map((l) => ({ id: newId(), storeId, purchaseOrderId: po.id, ...l })))
  }
  return po.id
}

/** Send to the supplier: every line's quantity becomes incoming at the destination. */
export async function markOrdered(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { po, lines } = await load(tx, storeId, id)
  if (po.status !== 'draft') {
    throw new InventoryError('PO_NOT_DRAFT', 'Only a draft can be marked as ordered', { storeId })
  }
  if (lines.length === 0) {
    throw new InventoryError('PO_EMPTY', 'Add at least one product first', { storeId })
  }
  for (const line of lines) {
    await adjustIncoming(tx, storeId, line.variantId, po.locationId, line.quantity)
  }
  await tx
    .update(purchaseOrder)
    .set({ status: 'ordered', orderedAt: new Date(), updatedAt: new Date() })
    .where(eq(purchaseOrder.id, po.id))
}

/**
 * Receive some or all of what is outstanding. Each unit received leaves
 * incoming and lands in on-hand at the destination, logged as `received`.
 * Returns how many units were received in this call.
 */
export async function receivePurchaseOrder(
  tx: StoreTx,
  storeId: string,
  receipt: Receipt,
): Promise<number> {
  const { po, lines } = await load(tx, storeId, receipt.id)
  if (po.status === 'draft' || po.status === 'closed' || po.status === 'received') {
    throw new InventoryError('PO_NOT_RECEIVABLE', 'Nothing is outstanding on this order', {
      storeId,
    })
  }
  const byId = new Map(lines.map((l) => [l.id, l]))
  let units = 0
  for (const r of receipt.receipts) {
    const line = byId.get(r.lineId)
    if (!line) continue
    const qty = clampReceipt(line, r.quantity)
    if (qty === 0) continue
    await adjustIncoming(tx, storeId, line.variantId, po.locationId, -qty)
    await adjustStock(tx, {
      storeId,
      variantId: line.variantId,
      locationId: po.locationId,
      delta: qty,
      reason: 'received',
      note: `Purchase order #${po.number}`,
    })
    const received = line.received + qty
    await tx.update(purchaseOrderLine).set({ received }).where(eq(purchaseOrderLine.id, line.id))
    byId.set(line.id, { ...line, received })
    units += qty
  }
  const status = purchaseOrderStatus([...byId.values()], po.status)
  await tx
    .update(purchaseOrder)
    .set({ status, updatedAt: new Date() })
    .where(eq(purchaseOrder.id, po.id))
  return units
}

/** Stop waiting for the rest: whatever is still incoming is dropped. */
export async function closePurchaseOrder(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { po, lines } = await load(tx, storeId, id)
  if (po.status === 'draft' || po.status === 'closed') {
    throw new InventoryError('PO_NOT_OPEN', 'Only an ordered purchase order can be closed', {
      storeId,
    })
  }
  for (const line of lines) {
    await adjustIncoming(tx, storeId, line.variantId, po.locationId, -remainingOf(line))
  }
  await tx
    .update(purchaseOrder)
    .set({ status: 'closed', updatedAt: new Date() })
    .where(eq(purchaseOrder.id, po.id))
}

export async function deletePurchaseOrder(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { po } = await load(tx, storeId, id)
  if (po.status !== 'draft') {
    throw new InventoryError('PO_NOT_DRAFT', 'Only a draft can be deleted; close it instead', {
      storeId,
    })
  }
  await tx.delete(purchaseOrder).where(eq(purchaseOrder.id, po.id))
}
