/** SOURCE OF TRUTH: low / out of stock events — WHAT: `watchStockCrossings` reads what tracked variants have available to sell online before and after a stock change and writes `inventory.low` (fell to or below the store's low-stock threshold) or `inventory.out` (reached 0) once per product per crossing, in the same transaction / WHY: the Automations triggers "Stock low" and "Stock out" must fire on the crossing, not on every sale or edit, and a bulk change must not flood the outbox. Stock writers (`adjustStock`, order reservation, the quick variant edit) call it. */
import { inventoryLevel, type StoreTx, sellableLevel, variant } from '@commerce/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { storeLowStockThreshold } from '../catalog/stock-threshold'
import { insertOutboxEvent } from '../outbox/write'

type Available = Map<string, { productId: string; available: number }>

/** Tracked variants' store-wide available stock (on hand less reserved, selling locations). */
async function sellableAvailable(tx: StoreTx, variantIds: readonly string[]): Promise<Available> {
  const out: Available = new Map()
  const ids = [...new Set(variantIds)]
  if (ids.length === 0) return out
  const rows = await tx
    .select({
      variantId: variant.id,
      productId: variant.productId,
      available: sql<number>`coalesce(sum(${inventoryLevel.onHand} - ${inventoryLevel.reserved}) filter (where ${sellableLevel}), 0)::int`,
    })
    .from(variant)
    .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, variant.id))
    .where(and(inArray(variant.id, ids), eq(variant.trackInventory, true)))
    .groupBy(variant.id, variant.productId)
  for (const r of rows)
    out.set(r.variantId, { productId: r.productId, available: Number(r.available) })
  return out
}

export type StockCrossing = {
  type: 'inventory.low' | 'inventory.out'
  productId: string
  variantId: string
}

/**
 * Which variants crossed a line between `before` and `after`: to 0 or below (`out`), or from
 * above the threshold to at or below it while still above 0 (`low`). One per product and type:
 * a product whose three sizes sell out in one order raises one `out`.
 */
export function stockCrossings(
  before: Available,
  after: Available,
  threshold: number,
): StockCrossing[] {
  const seen = new Set<string>()
  const out: StockCrossing[] = []
  for (const [variantId, now] of after) {
    const was = before.get(variantId)?.available ?? 0
    const type =
      was > 0 && now.available <= 0
        ? 'inventory.out'
        : was > threshold && now.available <= threshold && now.available > 0
          ? 'inventory.low'
          : null
    if (!type) continue
    const key = `${type}:${now.productId}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ type, productId: now.productId, variantId })
  }
  return out
}

/**
 * Runs a stock change and writes `inventory.low` / `inventory.out` for the crossings it caused.
 * Bulk callers pass every variant they touch in one call, so a product crosses once per change.
 */
export async function watchStockCrossings<T>(
  tx: StoreTx,
  storeId: string,
  variantIds: readonly string[],
  change: () => Promise<T>,
): Promise<T> {
  const before = await sellableAvailable(tx, variantIds)
  const result = await change()
  if (before.size === 0) return result
  const after = await sellableAvailable(tx, [...before.keys()])
  const crossings = stockCrossings(before, after, await storeLowStockThreshold(tx, storeId))
  for (const c of crossings) {
    await insertOutboxEvent(tx, storeId, c.type, { productId: c.productId, variantId: c.variantId })
  }
  return result
}
