import type { BulkEditRow } from '@commerce/core/catalog'
import {
  cellValue,
  type GridRow,
  isDirty,
  parseCollections,
  parsePaise,
  parseTags,
  parseWhole,
  type SheetCollection,
  type STATUSES,
  STOCK_PREFIX,
} from './bulk-edit-model'

type ProductPatch = NonNullable<BulkEditRow['product']>
type VariantPatch = NonNullable<BulkEditRow['variant']>

const blank = (v: string) => v.trim() || null

function productPatch(
  r: GridRow,
  changed: (key: string) => boolean,
  collections: SheetCollection[],
): ProductPatch {
  const product: ProductPatch = {}
  if (changed('title')) product.title = r.title.trim()
  if (changed('status')) product.status = r.status as (typeof STATUSES)[number]
  if (changed('handle')) product.handle = r.handle.trim()
  if (changed('vendor')) product.vendor = blank(r.vendor)
  if (changed('productType')) product.productType = blank(r.productType)
  if (changed('tags')) product.tags = parseTags(r.tags)
  if (changed('collections'))
    product.collectionIds = parseCollections(r.collections, collections).ids
  if (changed('seoTitle')) product.seoTitle = blank(r.seoTitle)
  if (changed('seoDescription')) product.seoDescription = blank(r.seoDescription)
  if (changed('featured')) product.featured = r.featured === 'yes'
  if (changed('taxIncluded')) product.taxIncluded = r.taxIncluded === 'yes'
  if (changed('templateSuffix')) product.templateSuffix = blank(r.templateSuffix)
  return product
}

function variantPatch(r: GridRow, changed: (key: string) => boolean): VariantPatch {
  const variant: VariantPatch = {}
  // A cleared price lists the variant without one (#913), never at ₹0.
  if (changed('price')) variant.pricePaise = parsePaise(r.price)
  if (changed('mrp')) variant.mrpPaise = parsePaise(r.mrp)
  if (changed('cost')) variant.costPaise = parsePaise(r.cost)
  if (changed('sku')) variant.sku = blank(r.sku)
  if (changed('barcode')) variant.barcode = blank(r.barcode)
  if (changed('weight')) variant.weightGrams = parseWhole(r.weight)
  if (changed('hsCode')) variant.hsCode = blank(r.hsCode)
  if (changed('gst')) variant.gstRatePercent = parseWhole(r.gst)
  if (changed('trackInventory')) variant.trackInventory = r.trackInventory === 'yes'
  if (changed('countryOfOrigin'))
    variant.countryOfOrigin = blank(r.countryOfOrigin)?.toUpperCase() ?? null
  if (changed('packageLength')) variant.packageLengthCm = parseWhole(r.packageLength)
  if (changed('packageWidth')) variant.packageWidthCm = parseWhole(r.packageWidth)
  if (changed('packageHeight')) variant.packageHeightCm = parseWhole(r.packageHeight)
  return variant
}

/**
 * Only the cells that changed, as the API's rows. An emptied optional cell sends null; a
 * required one that is empty is a validation error and never gets here.
 */
export function toBulkRows(
  rows: GridRow[],
  base: Map<string, GridRow>,
  locationIds: string[],
  collections: SheetCollection[],
): BulkEditRow[] {
  const out: BulkEditRow[] = []
  for (const r of rows) {
    const b = base.get(r.variantId)
    if (!b) continue
    const changed = (k: string) => isDirty(r, b, k)
    const row: BulkEditRow = { variantId: r.variantId }
    const product = productPatch(r, changed, collections)
    const variant = variantPatch(r, changed)
    const stock: Record<string, number> = {}
    for (const loc of locationIds) {
      if (changed(`${STOCK_PREFIX}${loc}`))
        stock[loc] = parseWhole(cellValue(r, `${STOCK_PREFIX}${loc}`)) ?? 0
    }
    if (Object.keys(product).length) row.product = product
    if (Object.keys(variant).length) row.variant = variant
    if (Object.keys(stock).length) row.stock = stock
    if (row.product || row.variant || row.stock) out.push(row)
  }
  return out
}
