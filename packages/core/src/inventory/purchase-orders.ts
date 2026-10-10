import { newId, purchaseOrder, purchaseOrderLine, type StoreTx } from '@commerce/db'
import { asc, eq, inArray, sql } from 'drizzle-orm'
import { lockCostingGroup, recost } from './costing'
import {
  adjustIncoming,
  assertLocations,
  assertVariants,
  defaultLocationId,
  InventoryError,
  nextDocumentNumber,
} from './levels'
import type { PurchaseOrderInput } from './schemas'
import { purchaseOrderStatus, remainingOf } from './stock'
import { assertSupplier } from './suppliers'

const nextNumber = (tx: StoreTx, storeId: string) =>
  nextDocumentNumber(
    tx,
    storeId,
    'purchase_order',
    sql<number>`max(${purchaseOrder.number})`,
    purchaseOrder,
  )

type LineKey = { variantId: string; quantity: number; unitPriceMinor: number }
type LineRow = typeof purchaseOrderLine.$inferSelect
type LineInput = PurchaseOrderInput['lines'][number]

/** Lines as one comparable string, so their order does not matter. */
function lineSignature(lines: LineKey[]): string {
  return lines
    .map((l) => `${l.variantId}:${l.quantity}:${l.unitPriceMinor}`)
    .sort()
    .join('|')
}

/** The order and its lines, the order row locked for the rest of the transaction. */
export async function loadPurchaseOrder(tx: StoreTx, storeId: string, id: string) {
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
 * Create a draft, or edit one. Once ordered only the supplier details, dates, FX rate, HSN
 * codes and note can change: lines and currency are locked because stock is already
 * incoming, and a save that tries to change them is refused rather than half applied.
 * With `markOrdered` the draft is also sent to the supplier in the same transaction.
 * Every save recosts the order (and its shipment): prices and the rate feed landed cost.
 */
export async function savePurchaseOrder(
  tx: StoreTx,
  storeId: string,
  input: PurchaseOrderInput,
): Promise<string> {
  if (input.id) await lockCostingGroup(tx, storeId, { purchaseOrderId: input.id })
  await assertLocations(tx, storeId, [input.locationId])
  await assertVariants(
    tx,
    storeId,
    input.lines.map((l) => l.variantId),
  )
  if (input.supplierId) await assertSupplier(tx, storeId, input.supplierId)
  const id = await writeOrder(tx, storeId, input)
  if (input.markOrdered) await markOrdered(tx, storeId, id)
  await recost(tx, storeId, await lockCostingGroup(tx, storeId, { purchaseOrderId: id }))
  return id
}

const lineValues = (storeId: string, purchaseOrderId: string, l: LineInput) => ({
  id: newId(),
  storeId,
  purchaseOrderId,
  variantId: l.variantId,
  quantity: l.quantity,
  unitPriceMinor: l.unitPriceMinor,
  hsnCode: l.hsnCode || null,
})

async function writeOrder(tx: StoreTx, storeId: string, input: PurchaseOrderInput) {
  const fields = {
    supplierId: input.supplierId ?? null,
    supplierName: input.supplierName,
    supplierEmail: input.supplierEmail || null,
    supplierPhone: input.supplierPhone || null,
    expectedAt: input.expectedAt ?? null,
    fxRate: input.currency === 'INR' ? '1' : input.fxRate,
    note: input.note || null,
    updatedAt: new Date(),
  }
  if (!input.id) {
    const id = newId()
    await tx.insert(purchaseOrder).values({
      id,
      storeId,
      number: await nextNumber(tx, storeId),
      locationId: input.locationId || (await defaultLocationId(tx, storeId)),
      status: 'draft',
      currency: input.currency,
      ...fields,
    })
    if (input.lines.length) {
      await tx.insert(purchaseOrderLine).values(input.lines.map((l) => lineValues(storeId, id, l)))
    }
    return id
  }
  const { po, lines } = await loadPurchaseOrder(tx, storeId, input.id)
  if (po.status === 'closed' || po.status === 'received' || po.status === 'cancelled') {
    throw new InventoryError('PO_LOCKED', 'This purchase order is finished', { storeId })
  }
  if (po.status !== 'draft') {
    if (
      input.locationId !== po.locationId ||
      input.currency !== po.currency ||
      lineSignature(input.lines) !== lineSignature(lines)
    ) {
      throw new InventoryError(
        'PO_LINES_LOCKED',
        'Products, quantities, prices, currency and the destination cannot change after the order is sent',
        { storeId },
      )
    }
    await tx.update(purchaseOrder).set(fields).where(eq(purchaseOrder.id, po.id))
    await updateHsnCodes(tx, lines, input.lines)
    return po.id
  }
  await tx
    .update(purchaseOrder)
    .set({ ...fields, currency: input.currency, locationId: input.locationId })
    .where(eq(purchaseOrder.id, po.id))
  await replaceDraftLines(tx, storeId, po.id, lines, input.lines)
  return po.id
}

/**
 * Keep a draft line's id while its product stays on the order, so charges that name lines
 * (specific lines, manual amounts) still find them; add new products, drop removed ones.
 */
async function replaceDraftLines(
  tx: StoreTx,
  storeId: string,
  purchaseOrderId: string,
  current: LineRow[],
  next: LineInput[],
) {
  const byVariant = new Map(current.map((l) => [l.variantId, l]))
  const keep = new Set(next.map((l) => l.variantId))
  const gone = current.filter((l) => !keep.has(l.variantId)).map((l) => l.id)
  if (gone.length) await tx.delete(purchaseOrderLine).where(inArray(purchaseOrderLine.id, gone))
  const fresh = next.filter((l) => !byVariant.has(l.variantId))
  if (fresh.length) {
    await tx
      .insert(purchaseOrderLine)
      .values(fresh.map((l) => lineValues(storeId, purchaseOrderId, l)))
  }
  for (const l of next) {
    const was = byVariant.get(l.variantId)
    if (!was) continue
    await tx
      .update(purchaseOrderLine)
      .set({ quantity: l.quantity, unitPriceMinor: l.unitPriceMinor, hsnCode: l.hsnCode || null })
      .where(eq(purchaseOrderLine.id, was.id))
  }
}

async function updateHsnCodes(tx: StoreTx, current: LineRow[], next: LineInput[]) {
  const wanted = new Map(next.map((l) => [l.variantId, l.hsnCode || null]))
  for (const line of current) {
    const hsn = wanted.get(line.variantId) ?? null
    if (hsn === line.hsnCode) continue
    await tx
      .update(purchaseOrderLine)
      .set({ hsnCode: hsn })
      .where(eq(purchaseOrderLine.id, line.id))
  }
}

/** Send to the supplier: every line's quantity becomes incoming at the destination. */
export async function markOrdered(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { po, lines } = await loadPurchaseOrder(tx, storeId, id)
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

/** Stop waiting for the rest: whatever is still incoming is dropped. */
export async function closePurchaseOrder(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const { po, lines } = await loadPurchaseOrder(tx, storeId, id)
  if (po.status === 'draft' || po.status === 'closed' || po.status === 'cancelled') {
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

/**
 * Call the order off before anything arrives. An ordered one stops showing as incoming. In a
 * shipment it stops sharing the shipment's charges, so the other orders are recosted.
 */
export async function cancelPurchaseOrder(tx: StoreTx, storeId: string, id: string): Promise<void> {
  await lockCostingGroup(tx, storeId, { purchaseOrderId: id })
  const { po, lines } = await loadPurchaseOrder(tx, storeId, id)
  const arrived = lines.some((l) => l.received + l.rejected > 0)
  if ((po.status !== 'draft' && po.status !== 'ordered') || arrived) {
    throw new InventoryError(
      'PO_NOT_CANCELLABLE',
      'Only a draft or an order with nothing received can be cancelled; close it instead',
      { storeId },
    )
  }
  if (po.status === 'ordered') {
    for (const line of lines) {
      await adjustIncoming(tx, storeId, line.variantId, po.locationId, -remainingOf(line))
    }
  }
  await tx
    .update(purchaseOrder)
    .set({ status: 'cancelled', updatedAt: new Date() })
    .where(eq(purchaseOrder.id, po.id))
  await recost(tx, storeId, await lockCostingGroup(tx, storeId, { purchaseOrderId: id }))
}

/**
 * Undo a close or a cancel. A closed order waits for what is still outstanding again; a
 * cancelled one goes back to ordered (incoming again) or, if it was never sent, to draft.
 */
export async function reopenPurchaseOrder(tx: StoreTx, storeId: string, id: string): Promise<void> {
  await lockCostingGroup(tx, storeId, { purchaseOrderId: id })
  const { po, lines } = await loadPurchaseOrder(tx, storeId, id)
  let status: typeof po.status
  if (po.status === 'closed') {
    if (lines.every((l) => remainingOf(l) === 0)) {
      throw new InventoryError('PO_NOTHING_OUTSTANDING', 'Everything on this order has arrived', {
        storeId,
      })
    }
    status = purchaseOrderStatus(lines, 'ordered')
  } else if (po.status === 'cancelled') {
    status = po.orderedAt ? 'ordered' : 'draft'
  } else {
    throw new InventoryError(
      'PO_NOT_REOPENABLE',
      'Only a closed or cancelled order can be reopened',
      { storeId },
    )
  }
  if (status !== 'draft') {
    for (const line of lines) {
      await adjustIncoming(tx, storeId, line.variantId, po.locationId, remainingOf(line))
    }
  }
  await tx
    .update(purchaseOrder)
    .set({ status, updatedAt: new Date() })
    .where(eq(purchaseOrder.id, po.id))
  await recost(tx, storeId, await lockCostingGroup(tx, storeId, { purchaseOrderId: id }))
}

/** A draft, or a cancelled order, can be deleted; its shipment (if any) is recosted. */
export async function deletePurchaseOrder(tx: StoreTx, storeId: string, id: string): Promise<void> {
  const group = await lockCostingGroup(tx, storeId, { purchaseOrderId: id })
  const { po } = await loadPurchaseOrder(tx, storeId, id)
  if (po.status !== 'draft' && po.status !== 'cancelled') {
    throw new InventoryError('PO_NOT_DRAFT', 'Only a draft can be deleted; close it instead', {
      storeId,
    })
  }
  await tx.delete(purchaseOrder).where(eq(purchaseOrder.id, po.id))
  if (group.shipmentId) {
    await recost(
      tx,
      storeId,
      await lockCostingGroup(tx, storeId, { inboundShipmentId: group.shipmentId }),
    )
  }
}
