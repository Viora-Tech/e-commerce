import { siteConfig } from '@commerce/config/site'
import type { StockFilter } from '@commerce/core/catalog'
import { parseAsArrayOf, parseAsString } from 'nuqs'

/** The page's URL state, and the API filters it maps to. */
export type InventoryQuery = {
  page: number
  perPage: number
  query: string
  stock: StockFilter | null
  vendor: string[]
  productType: string[]
  tag: string[]
  /** Collection ids. */
  collection: string[]
  productStatus: ProductStatusFilter[]
  changed: StockChanged | null
  group: InventoryGroup
}

/** Products (the default): one row per product, SKUs folded under it. Variant: one per SKU. */
export const INVENTORY_GROUPS = ['product', 'variant'] as const
export type InventoryGroup = (typeof INVENTORY_GROUPS)[number]

/** "Stock changed" filter values; the API checks the same list. */
export const STOCK_CHANGED = ['1d', '7d', '30d', '90d', 'stale'] as const
type StockChanged = (typeof STOCK_CHANGED)[number]

/** Archived products never list here, so the Product status filter has two values. */
export const PRODUCT_STATUS_FILTERS = ['active', 'draft'] as const
type ProductStatusFilter = (typeof PRODUCT_STATUS_FILTERS)[number]

/** A multi-pick in the URL; module scope so the empty default keeps one identity. */
export const parseAsPicks = parseAsArrayOf(parseAsString).withDefault([])

/** Every panel filter cleared, as a URL patch. */
export const CLEAR_FILTERS = {
  stock: null,
  vendor: null,
  productType: null,
  tag: null,
  collection: null,
  productStatus: null,
  changed: null,
}

export const PER_PAGE = siteConfig.ui.rowsPerPage.default

export function listFilters(locationId: string, q: InventoryQuery) {
  return {
    locationId,
    search: q.query || undefined,
    stock: q.stock ?? undefined,
    vendors: q.vendor.length ? q.vendor : undefined,
    productTypes: q.productType.length ? q.productType : undefined,
    tags: q.tag.length ? q.tag : undefined,
    collectionIds: q.collection.length ? q.collection : undefined,
    productStatus: q.productStatus.length ? q.productStatus : undefined,
    changed: q.changed ?? undefined,
    group: q.group,
  }
}
