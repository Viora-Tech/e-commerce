import { BULK_EDIT_MAX, notSystemTest } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  collection,
  collectionProduct,
  inventoryLevel,
  location,
  product,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

const DESCRIPTION_PREVIEW_MAX = 400

/** Text of a Lexical document, blocks joined by spaces, for a read-only cell. */
function previewText(doc: unknown): string {
  const out: string[] = []
  const walk = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { text?: unknown; children?: unknown }
    if (typeof n.text === 'string') out.push(n.text)
    if (Array.isArray(n.children)) {
      for (const c of n.children) walk(c)
      out.push(' ')
    }
  }
  if (typeof doc === 'string') return doc.slice(0, DESCRIPTION_PREVIEW_MAX)
  walk((doc as { root?: unknown } | null)?.root)
  return out.join('').replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_PREVIEW_MAX)
}

/**
 * What the bulk editor grid loads: one row per live variant of the chosen products, with the
 * product cells repeated on each row and the on-hand count at every active location.
 */
export async function loadBulkEditSheet(tx: StoreTx, productIds: string[]) {
  const [locations, collections, links, variants] = await Promise.all([
    tx
      .select({ id: location.id, name: location.name, isDefault: location.isDefault })
      .from(location)
      .where(eq(location.active, true))
      .orderBy(asc(location.name)),
    tx
      .select({ id: collection.id, title: collection.title })
      .from(collection)
      .where(eq(collection.kind, 'manual'))
      .orderBy(asc(collection.title)),
    tx
      .select({
        productId: collectionProduct.productId,
        collectionId: collectionProduct.collectionId,
      })
      .from(collectionProduct)
      .innerJoin(collection, eq(collection.id, collectionProduct.collectionId))
      .where(and(inArray(collectionProduct.productId, productIds), eq(collection.kind, 'manual'))),
    tx
      .select({
        variantId: variant.id,
        productId: product.id,
        title: product.title,
        status: product.status,
        vendor: product.vendor,
        productType: product.productType,
        tags: product.tags,
        handle: product.handle,
        description: product.description,
        seoTitle: product.seoTitle,
        seoDescription: product.seoDescription,
        featured: product.featured,
        taxIncluded: product.taxIncluded,
        templateSuffix: product.templateSuffix,
        variantTitle: variant.title,
        pricePaise: variant.pricePaise,
        mrpPaise: variant.mrpPaise,
        costPaise: variant.costPaise,
        sku: variant.sku,
        barcode: variant.barcode,
        weightGrams: variant.weightGrams,
        hsCode: variant.hsCode,
        gstRatePercent: variant.gstRatePercent,
        trackInventory: variant.trackInventory,
        countryOfOrigin: variant.countryOfOrigin,
        packageLengthCm: variant.packageLengthCm,
        packageWidthCm: variant.packageWidthCm,
        packageHeightCm: variant.packageHeightCm,
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
  const inCollections = new Map<string, string[]>()
  for (const l of links) {
    inCollections.set(l.productId, [...(inCollections.get(l.productId) ?? []), l.collectionId])
  }
  return {
    locations,
    /** The manual collections a product can be put in. */
    collections,
    rows: rows.map(({ description, ...r }) => ({
      ...r,
      descriptionText: previewText(description),
      collectionIds: inCollections.get(r.productId) ?? [],
      stock: stock.get(r.variantId) ?? {},
    })),
    /** True when the products have more variants than one sheet holds; the rest are left out. */
    truncated: variants.length > BULK_EDIT_MAX,
  }
}
