import { STOCK_FILTERS } from '@commerce/core/catalog'
import { parseRupees } from '@commerce/money'
import { parseAsArrayOf, parseAsString, parseAsStringLiteral } from 'nuqs'
import {
  type DateFilterValue,
  type FilterGroup,
  facetOptions,
} from '@/components/table/filter-panel'
import type { productsListContent, StockFilter } from '@/data/products'
import {
  dateFilterBounds,
  hasDateFilter,
  NO_DATE_FILTER,
  parseAsDateFilter,
} from '@/lib/date-filter'
import { formatPaise } from '@/lib/money'

/** The Created presets; a custom from–to is the date group's own option. */
export const CREATED_FILTERS = ['7d', '30d', '90d'] as const
export type CreatedFilter = (typeof CREATED_FILTERS)[number]

const DAYS: Record<CreatedFilter, number> = { '7d': 7, '30d': 30, '90d': 90 }

/** What the Products filter panel holds; arrays are "any of", empty for no filter. */
export type ProductFilters = {
  vendor: string[]
  productType: string[]
  tag: string[]
  /** Collection ids. */
  collection: string[]
  stock: StockFilter | null
  /** Rupees as typed; empty for no bound. */
  priceMin: string
  priceMax: string
  created: DateFilterValue
}

export const NO_PRODUCT_FILTERS: ProductFilters = {
  vendor: [],
  productType: [],
  tag: [],
  collection: [],
  stock: null,
  priceMin: '',
  priceMax: '',
  created: NO_DATE_FILTER,
}

/* Module scope, so the empty defaults keep one identity and the list effect runs once per change.
   A single `?vendor=Acme` from an older link reads as one pick. */
export const PRODUCT_FILTER_PARAMS = {
  vendor: parseAsArrayOf(parseAsString).withDefault([]),
  productType: parseAsArrayOf(parseAsString).withDefault([]),
  tag: parseAsArrayOf(parseAsString).withDefault([]),
  collection: parseAsArrayOf(parseAsString).withDefault([]),
  stock: parseAsStringLiteral(STOCK_FILTERS),
  priceMin: parseAsString.withDefault(''),
  priceMax: parseAsString.withDefault(''),
  created: parseAsDateFilter(CREATED_FILTERS),
}

/** Every filter cleared, as a URL patch (`null` drops the param). */
export const CLEAR_PRODUCT_FILTERS = {
  vendor: null,
  productType: null,
  tag: null,
  collection: null,
  stock: null,
  priceMin: null,
  priceMax: null,
  created: null,
}

function presetStart(preset: string, now: Date): Date | null {
  const created = CREATED_FILTERS.find((c) => c === preset)
  return created ? new Date(now.getTime() - DAYS[created] * 86_400_000) : null
}

export function hasProductFilters(f: ProductFilters): boolean {
  return (
    f.vendor.length > 0 ||
    f.productType.length > 0 ||
    f.tag.length > 0 ||
    f.collection.length > 0 ||
    f.stock !== null ||
    parseRupees(f.priceMin) !== null ||
    parseRupees(f.priceMax) !== null ||
    hasDateFilter(f.created)
  )
}

/** The panel as `products.list` input. */
export function productFilterInput(f: ProductFilters, now = new Date()) {
  const created = dateFilterBounds(f.created, presetStart, now)
  const min = parseRupees(f.priceMin)
  const max = parseRupees(f.priceMax)
  return {
    ...(f.vendor.length ? { vendors: f.vendor } : {}),
    ...(f.productType.length ? { productTypes: f.productType } : {}),
    ...(f.tag.length ? { tags: f.tag } : {}),
    ...(f.collection.length ? { collectionIds: f.collection } : {}),
    ...(f.stock ? { stock: f.stock } : {}),
    ...(min !== null ? { priceMinPaise: Math.max(0, min) } : {}),
    ...(max !== null ? { priceMaxPaise: Math.max(0, max) } : {}),
    ...(created.from ? { createdFrom: created.from } : {}),
    ...(created.to ? { createdTo: created.to } : {}),
  }
}

type Facets = {
  vendors: string[]
  productTypes: string[]
  tags: string[]
  collections: { id: string; title: string }[]
}

/** The panel's groups; the chips and Clear all come from the same list. */
export function productFilterGroups(
  f: ProductFilters,
  copy: (typeof productsListContent)['filters'],
  facets: Facets,
  onChange: (patch: Partial<ProductFilters>) => void,
): FilterGroup[] {
  return [
    {
      key: 'collection',
      label: copy.collection,
      type: 'multi',
      options: facets.collections.map((c) => ({ value: c.id, label: c.title })),
      value: f.collection,
      onChange: (collection) => onChange({ collection }),
    },
    {
      key: 'vendor',
      label: copy.vendor,
      type: 'multi',
      options: facetOptions(facets.vendors),
      value: f.vendor,
      onChange: (vendor) => onChange({ vendor }),
    },
    {
      key: 'type',
      label: copy.productType,
      type: 'multi',
      options: facetOptions(facets.productTypes),
      value: f.productType,
      onChange: (productType) => onChange({ productType }),
    },
    {
      key: 'tag',
      label: copy.tag,
      type: 'multi',
      options: facetOptions(facets.tags),
      value: f.tag,
      onChange: (tag) => onChange({ tag }),
    },
    {
      key: 'stock',
      label: copy.stock,
      type: 'select',
      options: copy.stockOptions,
      value: f.stock,
      onChange: (next) => onChange({ stock: STOCK_FILTERS.find((s) => s === next) ?? null }),
      anyLabel: copy.any,
    },
    {
      key: 'price',
      label: copy.price,
      type: 'range',
      input: 'money',
      from: f.priceMin,
      to: f.priceMax,
      fromLabel: copy.priceMin,
      toLabel: copy.priceMax,
      format: (v) => formatPaise(parseRupees(v) ?? 0),
      onChange: ({ from, to }) =>
        onChange({
          ...(from === undefined ? {} : { priceMin: from }),
          ...(to === undefined ? {} : { priceMax: to }),
        }),
    },
    {
      key: 'created',
      label: copy.created,
      type: 'date',
      presets: CREATED_FILTERS.map((c) => ({ value: c, label: copy.createdOptions[c] })),
      value: f.created,
      onChange: (created) => onChange({ created }),
      anyLabel: copy.anyDate,
    },
  ]
}
