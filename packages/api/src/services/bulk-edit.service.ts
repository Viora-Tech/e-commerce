import { BULK_EDIT_MAX, notSystemTest } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { inventoryLevel, location, product, variant } from '@commerce/db'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

/**
 * What the bulk editor grid loads: one row per live variant of the chosen products, with the
 * product cells repeated on each row and the on-hand count at every active location.
 */
export async function loadBulkEditSheet(tx: StoreTx, productIds: string[]) {
  const [locations, variants] = await Promise.all([
    tx
      .select({ id: location.id, name: location.name, isDefault: location.isDefault })
      .from(location)
      .where(eq(location.active, true))
      .orderBy(asc(location.name)),
    tx
      .select({
        variantId: variant.id,
        productId: product.id,
        title: product.title,
        status: product.status,
        vendor: product.vendor,
        productType: product.productType,
        tags: product.tags,
        variantTitle: variant.title,
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        costPaise: variant.costPaise,
        sku: variant.sku,
        barcode: variant.barcode,
        weightGrams: variant.weightGrams,
        hsCode: variant.hsCode,
        gstRatePercent: variant.gstRatePercent,
      })
      .from(variant)
      .innerJoin(product, eq(product.id, variant.productId))
      .where(and(inArray(product.id, productIds), isNull(variant.archivedAt), notSystemTest))
      .orderBy(asc(product.title), asc(product.id), asc(variant.position), asc(variant.id))
      .limit(BULK_EDIT_MAX + 1),
  ])
  const rows = variants.slice(0, BULK_EDIT_MAX)
  const levels = rows.length
    ? await tx
        .select({
          variantId: inventoryLevel.variantId,
          locationId: inventoryLevel.locationId,
          onHand: inventoryLevel.onHand,
        })
        .from(inventoryLevel)
        .where(
          inArray(
            inventoryLevel.variantId,
            rows.map((r) => r.variantId),
          ),
        )
    : []
  const stock = new Map<string, Record<string, number>>()
  for (const l of levels) {
    if (!l.locationId) continue
    stock.set(l.variantId, { ...stock.get(l.variantId), [l.locationId]: l.onHand })
  }
  return {
    locations,
    rows: rows.map((r) => ({ ...r, stock: stock.get(r.variantId) ?? {} })),
    /** True when the products have more variants than one sheet holds; the rest are left out. */
    truncated: variants.length > BULK_EDIT_MAX,
  }
}
