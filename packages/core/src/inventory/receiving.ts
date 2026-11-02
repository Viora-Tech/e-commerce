/** SOURCE OF TRUTH: receiving a purchase order at landed cost — WHAT: checks in accepted and
 * rejected units per line, moves accepted units from incoming to on hand, books them into
 * the variant's weighted average cost at the line's landed unit cost, and records the
 * receipt with the cost before and after. WHY: the moment stock lands is the moment its
 * true cost (goods plus freight, duty and clearing, without recoverable GST) has to reach
 * the product, so margins are right from the first sale.
 */
import {
  newId,
  purchaseOrder,
  purchaseOrderLine,
  purchaseOrderReceipt,
  purchaseOrderReceiptLine,
  type StoreTx,
  variant,
} from '@commerce/db'
import { eq } from 'drizzle-orm'
import { lockCostingGroup, onHandEverywhere, recost } from './costing'
import { weightedAverageCost } from './landed-cost'
import { adjustIncoming, adjustStock, InventoryError } from './levels'
import { loadPurchaseOrder } from './purchase-orders'
import type { Receipt } from './schemas'
import { syncShipmentArrival } from './shipment-arrival'
import { clampReceipt, purchaseOrderStatus } from './stock'

export type ReceivedLine = {
  lineId: string
  variantId: string
  accepted: number
  rejected: number
  landedUnitPaise: number
  /** The variant's cost before and after; null when nothing was accepted on the line. */
  costBeforePaise: number | null
  costAfterPaise: number | null
}

export type ReceiptResult = {
  /** Units accepted onto stock in this call. */
  units: number
  rejected: number
  /** Null when the call received nothing (every count was zero or already in). */
  receiptId: string | null
  lines: ReceivedLine[]
}

/** Book `accepted` units into the variant's average cost; returns the cost before and after. */
async function bookCost(tx: StoreTx, variantId: string, accepted: number, landedUnitPaise: number) {
  const [v] = await tx
    .select({ cost: variant.costPaise })
    .from(variant)
    .where(eq(variant.id, variantId))
    .for('update')
  const before = v?.cost ?? null
  const after = weightedAverageCost({
    onHandBefore: await onHandEverywhere(tx, variantId),
    costBefore: before,
    receivedQty: accepted,
    landedUnitPaise,
  })
  if (after !== before) {
    await tx.update(variant).set({ costPaise: after }).where(eq(variant.id, variantId))
  }
  return { before, after }
}

/**
 * Receive some or all of what is outstanding. Accepted units leave incoming and land on hand
 * at the destination (logged as `received`) at the line's landed cost; rejected units only
 * leave incoming. The order is recosted first, so the latest charges are in the cost.
 */
export async function receivePurchaseOrder(
  tx: StoreTx,
  storeId: string,
  receipt: Receipt,
  receivedBy: string | null = null,
): Promise<ReceiptResult> {
  const group = await lockCostingGroup(tx, storeId, { purchaseOrderId: receipt.id })
  const { po, lines } = await loadPurchaseOrder(tx, storeId, receipt.id)
  if (po.status !== 'ordered' && po.status !== 'partially_received') {
    throw new InventoryError('PO_NOT_RECEIVABLE', 'Nothing is outstanding on this order', {
      storeId,
    })
  }
  const costs = await recost(tx, storeId, group)
  const landed = new Map(costs.lines.map((l) => [l.lineId, l.landedUnitPaise]))
  const byId = new Map(lines.map((l) => [l.id, l]))
  const done: ReceivedLine[] = []

  for (const r of receipt.receipts) {
    const line = byId.get(r.lineId)
    if (!line) continue
    const accepted = clampReceipt(line, r.accepted)
    const rejected = clampReceipt({ ...line, received: line.received + accepted }, r.rejected)
    if (accepted + rejected === 0) continue
    const unit = landed.get(line.id) ?? line.unitCostPaise
    let cost: { before: number | null; after: number | null } = { before: null, after: null }
    await adjustIncoming(tx, storeId, line.variantId, po.locationId, -(accepted + rejected))
    if (accepted > 0) {
      cost = await bookCost(tx, line.variantId, accepted, unit)
      await adjustStock(tx, {
        storeId,
        variantId: line.variantId,
        locationId: po.locationId,
        delta: accepted,
        reason: 'received',
        note: `Purchase order #${po.number}`,
      })
    }
    const next = {
      received: line.received + accepted,
      rejected: line.rejected + rejected,
      costedUnits: line.costedUnits + accepted,
      bookedCostPaise: line.bookedCostPaise + accepted * unit,
    }
    await tx.update(purchaseOrderLine).set(next).where(eq(purchaseOrderLine.id, line.id))
    byId.set(line.id, { ...line, ...next })
    done.push({
      lineId: line.id,
      variantId: line.variantId,
      accepted,
      rejected,
      landedUnitPaise: unit,
      costBeforePaise: cost.before,
      costAfterPaise: cost.after,
    })
  }

  if (done.length === 0) return { units: 0, rejected: 0, receiptId: null, lines: [] }

  const receiptId = newId()
  await tx.insert(purchaseOrderReceipt).values({
    id: receiptId,
    storeId,
    purchaseOrderId: po.id,
    locationId: po.locationId,
    receivedBy,
    note: receipt.note || null,
  })
  await tx.insert(purchaseOrderReceiptLine).values(
    done.map((d) => ({
      id: newId(),
      storeId,
      receiptId,
      purchaseOrderLineId: d.lineId,
      accepted: d.accepted,
      rejected: d.rejected,
      landedUnitCostPaise: d.landedUnitPaise,
      costBeforePaise: d.costBeforePaise,
      costAfterPaise: d.costAfterPaise,
    })),
  )
  const status = purchaseOrderStatus([...byId.values()], po.status)
  await tx
    .update(purchaseOrder)
    .set({ status, updatedAt: new Date() })
    .where(eq(purchaseOrder.id, po.id))
  // The last order on a shipment to come in marks the shipment delivered (#1062).
  if (po.inboundShipmentId) await syncShipmentArrival(tx, storeId, po.inboundShipmentId)
  return {
    units: done.reduce((n, d) => n + d.accepted, 0),
    rejected: done.reduce((n, d) => n + d.rejected, 0),
    receiptId,
    lines: done,
  }
}
