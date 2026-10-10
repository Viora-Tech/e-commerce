/** SOURCE OF TRUTH: recosting purchase orders, costing groups, charge splits at rest, landed
 * unit cost on lines, revaluation of received stock — WHAT: loads a costing group (one
 * purchase order, or every live order in its inbound shipment), splits its charges with
 * `computeLandedCosts`, stores the splits and each line's landed cost, and moves the
 * variant's weighted average cost when units already received now cost something else.
 * WHY: every write that changes a cost (a charge, an FX rate, an order joining a shipment)
 * calls `recost`, so splits, line costs and the variant's cost never disagree.
 */
import {
  inboundShipment,
  inventoryLevel,
  purchaseCharge,
  purchaseChargeSplit,
  purchaseOrder,
  purchaseOrderLine,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, ne, or, sql } from 'drizzle-orm'
import {
  type CostCharge,
  type CostLine,
  computeLandedCosts,
  convertToPaise,
  divRound,
  type LandedCosts,
  revaluedCost,
} from './landed-cost'
import { InventoryError } from './levels'

/** The orders whose lines share charges: a shipment's live orders, or one order on its own. */
export type CostingGroup = { shipmentId: string | null; orderIds: string[] }

/**
 * Lock a costing group in one fixed order (the shipment row, then its orders by id) so two
 * writes on the same shipment queue instead of deadlocking. Pass the order or the shipment.
 */
export function lockCostingGroup(
  tx: StoreTx,
  storeId: string,
  of: { purchaseOrderId: string } | { inboundShipmentId: string },
): Promise<CostingGroup> {
  return costingGroup(tx, storeId, of, true)
}

/** The group without locking it, for previews. */
export async function costingGroup(
  tx: StoreTx,
  storeId: string,
  of: { purchaseOrderId: string } | { inboundShipmentId: string },
  lock = false,
): Promise<CostingGroup> {
  let shipmentId: string | null
  let soloId: string | null = null
  if ('purchaseOrderId' in of) {
    const [po] = await tx
      .select({ id: purchaseOrder.id, shipmentId: purchaseOrder.inboundShipmentId })
      .from(purchaseOrder)
      .where(eq(purchaseOrder.id, of.purchaseOrderId))
    if (!po) throw new InventoryError('PO_NOT_FOUND', 'Purchase order not found', { storeId })
    shipmentId = po.shipmentId
    soloId = po.id
  } else {
    shipmentId = of.inboundShipmentId
  }
  if (shipmentId) {
    const q = tx
      .select({ id: inboundShipment.id })
      .from(inboundShipment)
      .where(eq(inboundShipment.id, shipmentId))
    const [s] = lock ? await q.for('update') : await q
    if (!s)
      throw new InventoryError('SHIPMENT_NOT_FOUND', 'Inbound shipment not found', { storeId })
  }
  const orders = tx
    .select({ id: purchaseOrder.id, status: purchaseOrder.status })
    .from(purchaseOrder)
    .where(
      shipmentId
        ? eq(purchaseOrder.inboundShipmentId, shipmentId)
        : eq(purchaseOrder.id, soloId as string),
    )
    .orderBy(asc(purchaseOrder.id))
  const rows = lock ? await orders.for('update') : await orders
  return { shipmentId, orderIds: rows.filter((r) => r.status !== 'cancelled').map((r) => r.id) }
}

export type CostingLine = CostLine & {
  purchaseOrderId: string
  purchaseOrderNumber: number
  variantId: string
  received: number
  rejected: number
  unitCostPaise: number
  landedUnitCostPaise: number | null
  costedUnits: number
  bookedCostPaise: number
}

export type CostingCharge = CostCharge & {
  purchaseOrderId: string | null
  inboundShipmentId: string | null
}

/** Read a group's lines and charges and split them. No writes. */
export async function loadCosting(
  tx: StoreTx,
  group: CostingGroup,
): Promise<{ lines: CostingLine[]; charges: CostingCharge[]; result: LandedCosts }> {
  const rows = group.orderIds.length
    ? await tx
        .select({
          line: purchaseOrderLine,
          number: purchaseOrder.number,
          currency: purchaseOrder.currency,
          fxRate: purchaseOrder.fxRate,
          weightGrams: variant.weightGrams,
        })
        .from(purchaseOrderLine)
        .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
        .innerJoin(variant, eq(variant.id, purchaseOrderLine.variantId))
        .where(inArray(purchaseOrderLine.purchaseOrderId, group.orderIds))
        .orderBy(asc(purchaseOrder.number), asc(purchaseOrderLine.id))
    : []
  const lines: CostingLine[] = rows.map((r) => ({
    id: r.line.id,
    purchaseOrderId: r.line.purchaseOrderId,
    purchaseOrderNumber: r.number,
    variantId: r.line.variantId,
    quantity: r.line.quantity,
    received: r.line.received,
    rejected: r.line.rejected,
    goodsPaise: convertToPaise(r.line.quantity * r.line.unitPriceMinor, r.currency, r.fxRate),
    weightGrams: r.weightGrams,
    unitCostPaise: r.line.unitCostPaise,
    landedUnitCostPaise: r.line.landedUnitCostPaise,
    costedUnits: r.line.costedUnits,
    bookedCostPaise: r.line.bookedCostPaise,
  }))

  const owners = [
    group.orderIds.length ? inArray(purchaseCharge.purchaseOrderId, group.orderIds) : undefined,
    group.shipmentId ? eq(purchaseCharge.inboundShipmentId, group.shipmentId) : undefined,
  ].filter((w) => w !== undefined)
  const chargeRows = owners.length
    ? await tx
        .select()
        .from(purchaseCharge)
        .where(or(...owners))
        .orderBy(asc(purchaseCharge.createdAt), asc(purchaseCharge.id))
    : []
  const linesOf = (orderId: string) => lines.filter((l) => l.purchaseOrderId === orderId)
  const charges: CostingCharge[] = chargeRows.map((c) => ({
    id: c.id,
    purchaseOrderId: c.purchaseOrderId,
    inboundShipmentId: c.purchaseOrderId ? null : c.inboundShipmentId,
    amountPaise: convertToPaise(c.amountMinor, c.currency, c.fxRate),
    recoverable: c.recoverable,
    splitMethod: c.splitMethod,
    lineIds: (c.purchaseOrderId ? linesOf(c.purchaseOrderId) : lines).map((l) => l.id),
    splitLineIds: c.splitLineIds,
    manualSplits: c.manualSplits,
  }))
  return { lines, charges, result: computeLandedCosts(lines, charges) }
}

/**
 * Move a variant's cost by a late change of `deltaPaise` across `units` received units; only
 * the share still on hand counts (see `revaluedCost`). The variant row is locked first so a
 * receipt and a revaluation of the same variant queue.
 */
async function revalueVariant(tx: StoreTx, variantId: string, deltaPaise: number, units: number) {
  const [v] = await tx
    .select({ cost: variant.costPaise })
    .from(variant)
    .where(eq(variant.id, variantId))
    .for('update')
  if (!v) return
  const onHand = await onHandEverywhere(tx, variantId)
  const next = revaluedCost({ onHand, cost: v.cost, deltaPaise, units })
  if (next.cost !== v.cost) {
    await tx.update(variant).set({ costPaise: next.cost }).where(eq(variant.id, variantId))
  }
}

/** On-hand units of a variant across every location. */
export async function onHandEverywhere(tx: StoreTx, variantId: string): Promise<number> {
  const [row] = await tx
    .select({ n: sql<number>`coalesce(sum(${inventoryLevel.onHand}), 0)`.mapWith(Number) })
    .from(inventoryLevel)
    .where(eq(inventoryLevel.variantId, variantId))
  return row?.n ?? 0
}

/**
 * Split the group's charges again, store the splits and every line's goods and landed unit
 * cost, and revalue stock already received at a different cost. Call after any write that
 * can change a cost, inside the same transaction, with the group locked.
 */
export async function recost(
  tx: StoreTx,
  storeId: string,
  group: CostingGroup,
): Promise<LandedCosts> {
  const { lines, charges, result } = await loadCosting(tx, group)
  if (charges.length > 0) {
    await tx.delete(purchaseChargeSplit).where(
      inArray(
        purchaseChargeSplit.chargeId,
        charges.map((c) => c.id),
      ),
    )
    const splits = result.charges.flatMap((a) =>
      a.splits
        .filter((s) => s.amountPaise !== 0)
        .map((s) => ({
          storeId,
          chargeId: a.chargeId,
          purchaseOrderLineId: s.lineId,
          amountPaise: s.amountPaise,
        })),
    )
    if (splits.length > 0) await tx.insert(purchaseChargeSplit).values(splits)
  }
  for (const [i, line] of lines.entries()) {
    const cost = result.lines[i]
    if (!cost) continue
    const unitCostPaise = Number(divRound(BigInt(line.goodsPaise), BigInt(line.quantity)))
    const booked = line.costedUnits * cost.landedUnitPaise
    const delta = booked - line.bookedCostPaise
    if (delta !== 0 && line.costedUnits > 0) {
      await revalueVariant(tx, line.variantId, delta, line.costedUnits)
    }
    if (
      unitCostPaise !== line.unitCostPaise ||
      cost.landedUnitPaise !== line.landedUnitCostPaise ||
      booked !== line.bookedCostPaise
    ) {
      await tx
        .update(purchaseOrderLine)
        .set({ unitCostPaise, landedUnitCostPaise: cost.landedUnitPaise, bookedCostPaise: booked })
        .where(eq(purchaseOrderLine.id, line.id))
    }
  }
  return result
}

/** Ids of the lines a charge on this order or shipment may be split onto (RLS-scoped reads). */
export async function reachableLineIds(
  tx: StoreTx,
  of: { purchaseOrderId: string } | { inboundShipmentId: string },
): Promise<Set<string>> {
  const rows = await tx
    .select({ id: purchaseOrderLine.id })
    .from(purchaseOrderLine)
    .innerJoin(purchaseOrder, eq(purchaseOrder.id, purchaseOrderLine.purchaseOrderId))
    .where(
      and(
        'purchaseOrderId' in of
          ? eq(purchaseOrder.id, of.purchaseOrderId)
          : eq(purchaseOrder.inboundShipmentId, of.inboundShipmentId),
        ne(purchaseOrder.status, 'cancelled'),
      ),
    )
  return new Set(rows.map((r) => r.id))
}
