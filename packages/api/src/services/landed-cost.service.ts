import { costingGroup, loadCosting } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { inventoryLevel, purchaseCharge, variant } from '@commerce/db'
import { inArray, sql } from 'drizzle-orm'
import { lineDetails } from './purchase-order.service'

// Services are the only code that runs queries. They receive a store-scoped tx.

/**
 * What landed cost looks like right now for an order (and every order in its shipment) or a
 * shipment: each charge with its split, each line's goods, charges and landed unit cost next
 * to the variant's current cost and stock, and any split that had to fall back. No writes.
 */
export async function previewCosts(
  tx: StoreTx,
  storeId: string,
  of: { purchaseOrderId: string } | { inboundShipmentId: string },
) {
  const group = await costingGroup(tx, storeId, of)
  const { lines, charges, result } = await loadCosting(tx, group)
  const variantIds = [...new Set(lines.map((l) => l.variantId))]
  const details = await lineDetails(tx, variantIds)
  const stock = variantIds.length
    ? await tx
        .select({
          variantId: inventoryLevel.variantId,
          onHand: sql<number>`coalesce(sum(${inventoryLevel.onHand}), 0)`.mapWith(Number),
        })
        .from(inventoryLevel)
        .where(inArray(inventoryLevel.variantId, variantIds))
        .groupBy(inventoryLevel.variantId)
    : []
  const costs = variantIds.length
    ? await tx
        .select({ id: variant.id, costPaise: variant.costPaise })
        .from(variant)
        .where(inArray(variant.id, variantIds))
    : []
  const rows = charges.length
    ? await tx
        .select()
        .from(purchaseCharge)
        .where(
          inArray(
            purchaseCharge.id,
            charges.map((c) => c.id),
          ),
        )
    : []
  const rowOf = new Map(rows.map((r) => [r.id, r]))
  const onHand = new Map(stock.map((s) => [s.variantId, s.onHand]))
  const cost = new Map(costs.map((c) => [c.id, c.costPaise]))

  const lineOut = lines.map((l, i) => {
    const c = result.lines[i]
    const d = details.get(l.variantId)
    return {
      lineId: l.id,
      purchaseOrderId: l.purchaseOrderId,
      purchaseOrderNumber: l.purchaseOrderNumber,
      variantId: l.variantId,
      productTitle: d?.productTitle ?? '',
      variantTitle: d?.variantTitle ?? '',
      sku: d?.sku ?? null,
      imageUrl: d?.imageUrl ?? null,
      quantity: l.quantity,
      received: l.received,
      rejected: l.rejected,
      weightGrams: l.weightGrams,
      goodsPaise: c?.goodsPaise ?? l.goodsPaise,
      chargesPaise: c?.chargesPaise ?? 0,
      recoverablePaise: c?.recoverablePaise ?? 0,
      landedUnitPaise: c?.landedUnitPaise ?? 0,
      currentCostPaise: cost.get(l.variantId) ?? null,
      onHand: onHand.get(l.variantId) ?? 0,
    }
  })
  const chargeOut = charges.map((c, i) => {
    const row = rowOf.get(c.id)
    const alloc = result.charges[i]
    return {
      id: c.id,
      purchaseOrderId: c.purchaseOrderId,
      inboundShipmentId: c.inboundShipmentId,
      kind: row?.kind ?? 'other',
      amountMinor: row?.amountMinor ?? 0,
      currency: row?.currency ?? 'INR',
      fxRate: row?.fxRate ?? '1',
      amountPaise: c.amountPaise,
      gstPaise: row?.gstPaise ?? 0,
      recoverable: c.recoverable,
      splitMethod: c.splitMethod,
      /** The method actually used after any fallback. */
      appliedMethod: alloc?.method ?? c.splitMethod,
      splitLineIds: c.splitLineIds ?? null,
      manualSplits: c.manualSplits ?? null,
      payee: row?.payee ?? null,
      note: row?.note ?? null,
      incurredAt: row?.incurredAt ?? null,
      splits: alloc?.splits ?? [],
    }
  })
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  return {
    shipmentId: group.shipmentId,
    lines: lineOut,
    charges: chargeOut,
    warnings: result.warnings,
    totals: {
      goodsPaise: sum(lineOut.map((l) => l.goodsPaise)),
      costChargesPaise: sum(chargeOut.filter((c) => !c.recoverable).map((c) => c.amountPaise)),
      recoverablePaise: sum(chargeOut.filter((c) => c.recoverable).map((c) => c.amountPaise)),
      gstPaise: sum(chargeOut.map((c) => c.gstPaise)),
      landedPaise: sum(result.lines.map((l) => l.landedTotalPaise)),
    },
  }
}

export type CostPreview = Awaited<ReturnType<typeof previewCosts>>
