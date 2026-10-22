import { notSystemTest, storeLowStockThreshold } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { inventoryAdjustment, inventoryLevel, product, sellableLevel, variant } from '@commerce/db'
import { and, count, desc, eq, isNull, sql } from 'drizzle-orm'

// Stock tiles and the stock movement history for the products screens.

export type ProductStats = {
  total: number
  active: number
  draft: number
  /** Selling products with 1 to the store's low-stock threshold units left. */
  lowStock: number
  outOfStock: number
  stockValuePaise: number
}

/** Tiles above the list: counts plus what the stock on hand is worth at cost. */
export async function productStats(tx: StoreTx): Promise<ProductStats> {
  const lowThreshold = await storeLowStockThreshold(tx)
  const [counts] = await tx
    .select({
      total: count(),
      active: sql<number>`count(*) filter (where ${product.status} = 'active')`,
      draft: sql<number>`count(*) filter (where ${product.status} = 'draft')`,
    })
    .from(product)
    .where(notSystemTest)
  const [stock] = await tx
    .select({
      value: sql<number>`coalesce(sum(greatest(0, ${inventoryLevel.onHand}) * coalesce(${variant.costPaise}, ${variant.pricePaise})), 0)`,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, and(eq(inventoryLevel.variantId, variant.id), sellableLevel))
    .where(and(isNull(variant.archivedAt), notSystemTest))
  const [out] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(product)
    .where(
      and(
        notSystemTest,
        sql`(
        select coalesce(sum(greatest(0, il.on_hand - il.reserved)), 0)
        from variant v left join inventory_level il on il.variant_id = v.id and il.fulfils_online
        where v.product_id = ${product.id} and v.archived_at is null
      ) = 0`,
      ),
    )
  const [low] = await tx
    .select({ n: sql<number>`count(*)` })
    .from(product)
    .where(
      and(
        notSystemTest,
        sql`(
        select coalesce(sum(greatest(0, il.on_hand - il.reserved)), 0)
        from variant v left join inventory_level il on il.variant_id = v.id and il.fulfils_online
        where v.product_id = ${product.id} and v.archived_at is null
      ) between 1 and ${lowThreshold}`,
      ),
    )
  return {
    total: counts?.total ?? 0,
    active: Number(counts?.active ?? 0),
    draft: Number(counts?.draft ?? 0),
    lowStock: Number(low?.n ?? 0),
    outOfStock: Number(out?.n ?? 0),
    stockValuePaise: Number(stock?.value ?? 0),
  }
}

export type AdjustmentRow = {
  id: string
  variantTitle: string
  delta: number
  reason: string
  note: string | null
  createdAt: Date
}

/** Recent stock movements for one product, newest first. */
export async function productAdjustments(
  tx: StoreTx,
  productId: string,
  limit = 20,
): Promise<AdjustmentRow[]> {
  const rows = await tx
    .select({
      id: inventoryAdjustment.id,
      variantTitle: variant.title,
      delta: inventoryAdjustment.delta,
      reason: inventoryAdjustment.reason,
      note: inventoryAdjustment.note,
      createdAt: inventoryAdjustment.createdAt,
    })
    .from(inventoryAdjustment)
    .innerJoin(variant, eq(variant.id, inventoryAdjustment.variantId))
    .where(eq(variant.productId, productId))
    .orderBy(desc(inventoryAdjustment.createdAt))
    .limit(limit)
  return rows
}
