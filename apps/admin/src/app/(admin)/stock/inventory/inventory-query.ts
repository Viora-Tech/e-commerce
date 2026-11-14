import { siteConfig } from '@commerce/config/site'
import { STOCK_FILTERS, type StockFilter } from '@commerce/core/catalog'
import { parseAsArrayOf, parseAsString } from 'nuqs'
import { type FilterGroup, facetOptions } from '@/components/table/filter-panel/types'
import type { inventoryContent } from '@/data/inventory'
import type { api } from '@/lib/api-client'

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

/** The filter panel's facets: collections, vendors, product types and tags the store uses. */
export type InventoryFacets = Awaited<ReturnType<typeof api.inventory.facets>>

/** No facets yet (the route's loading screen): every group is there, with no options. */
export const NO_INVENTORY_FACETS: InventoryFacets = {
  collections: [],
  vendors: [],
  types: [],
  tags: [],
}

/** URL patch from one filter group; every change goes back to the first page. */
type FilterPatch = Partial<Omit<InventoryQuery, 'productStatus'>> & {
  productStatus?: ProductStatusFilter[]
  page: number
}

/** The inventory filter panel, shared by the page and its loading screen. */
export function inventoryFilterGroups(
  q: InventoryQuery,
  copy: (typeof inventoryContent)['filters'],
  facets: InventoryFacets,
  onPatch: (patch: FilterPatch) => void,
): FilterGroup[] {
  return [
    {
      key: 'stock',
      label: copy.stock,
      type: 'select',
      options: copy.stockOptions,
      value: q.stock,
      onChange: (next) =>
        onPatch({ stock: STOCK_FILTERS.find((s) => s === next) ?? null, page: 1 }),
      anyLabel: copy.any,
    },
    {
      key: 'changed',
      label: copy.changed,
      type: 'select',
      options: copy.changedOptions,
      value: q.changed,
      onChange: (next) =>
        onPatch({ changed: STOCK_CHANGED.find((c) => c === next) ?? null, page: 1 }),
      anyLabel: copy.any,
    },
    {
      key: 'collection',
      label: copy.collection,
      type: 'multi',
      options: facets.collections.map((c) => ({ value: c.id, label: c.title })),
      value: q.collection,
      onChange: (collection) => onPatch({ collection, page: 1 }),
    },
    {
      key: 'vendor',
      label: copy.vendor,
      type: 'multi',
      options: facetOptions(facets.vendors),
      value: q.vendor,
      onChange: (vendor) => onPatch({ vendor, page: 1 }),
    },
    {
      key: 'type',
      label: copy.productType,
      type: 'multi',
      options: facetOptions(facets.types),
      value: q.productType,
      onChange: (productType) => onPatch({ productType, page: 1 }),
    },
    {
      key: 'tag',
      label: copy.tag,
      type: 'multi',
      options: facetOptions(facets.tags),
      value: q.tag,
      onChange: (tag) => onPatch({ tag, page: 1 }),
    },
    {
      key: 'productStatus',
      label: copy.productStatus,
      type: 'checks',
      options: copy.productStatusOptions,
      value: q.productStatus,
      onChange: (next) =>
        onPatch({
          productStatus: PRODUCT_STATUS_FILTERS.filter((s) => next.includes(s)),
          page: 1,
        }),
    },
  ]
}
