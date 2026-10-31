/** The store settings import's read of this store's stock side: suppliers, variants the Shopify lines name, and earlier purchase order and transfer imports. Split out of settings-import.ts. */
import { purchaseOrder, type StoreTx, supplier, transfer, variant } from '@commerce/db'
import { and, inArray, isNull } from 'drizzle-orm'
import type { SettingsSource } from './api-settings'
import { findMappings } from './runtime'
import { SETTINGS_MAPPINGS } from './settings-plan'
import type { LocalStock } from './settings-plan-stock'

/** Mapped ids whose record is still here (`existing`); a deleted one may be imported again. */
function stillHere(mapped: Map<string, string>, existing: { id: string }[]): Map<string, string> {
  const ids = new Set(existing.map((r) => r.id))
  return new Map([...mapped].filter(([, id]) => ids.has(id)))
}

/** Suppliers, variants of the imported products the lines name, and earlier imports. */
export async function loadStock(tx: StoreTx, source: SettingsSource): Promise<LocalStock> {
  const pos = source.purchaseOrders?.ok ? source.purchaseOrders.data : []
  const transfers = source.transfers?.ok ? source.transfers.data : []
  const lines = [...pos.flatMap((p) => p.lines), ...transfers.flatMap((t) => t.lines)]
  const products = await findMappings(
    tx,
    'products',
    lines.map((l) => l.productSourceId),
  )
  const productIds = [...new Set(products.values())]
  const variants = productIds.length
    ? await tx
        .select({
          id: variant.id,
          productId: variant.productId,
          sku: variant.sku,
          title: variant.title,
        })
        .from(variant)
        .where(and(inArray(variant.productId, productIds), isNull(variant.archivedAt)))
    : []
  const poIds = await findMappings(
    tx,
    SETTINGS_MAPPINGS.purchaseOrders,
    pos.map((p) => p.sourceId),
  )
  const transferIds = await findMappings(
    tx,
    SETTINGS_MAPPINGS.transfers,
    transfers.map((t) => t.sourceId),
  )
  return {
    suppliers: await tx.select({ id: supplier.id, name: supplier.name }).from(supplier),
    products,
    variants,
    purchaseOrders: stillHere(
      poIds,
      poIds.size
        ? await tx
            .select({ id: purchaseOrder.id })
            .from(purchaseOrder)
            .where(inArray(purchaseOrder.id, [...poIds.values()]))
        : [],
    ),
    transfers: stillHere(
      transferIds,
      transferIds.size
        ? await tx
            .select({ id: transfer.id })
            .from(transfer)
            .where(inArray(transfer.id, [...transferIds.values()]))
        : [],
    ),
  }
}
