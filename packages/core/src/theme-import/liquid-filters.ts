/** SOURCE OF TRUTH: Shopify's storefront filter objects for imported themes — WHAT: `collection.filters` and `search.filters` (filter and filter_value: label, param_name, type, values with counts, active, url_to_add / url_to_remove, price ranges) built from our catalogue facets and the request's filters / WHY: a Liquid theme's own collection and search pages draw their filter drawer from these; with them empty the drawer was blank, and the links they build land on our browse params (`filter.p.m.<namespace>.<key>`, Shopify's shape) */
import type { BrowseFacets, FacetValue } from '../catalog/browse'
import { type BrowseFilters, browseHref, FILTER_PARAM } from '../catalog/browse-params'

export type LiquidFilterValue = {
  label: string
  value: string
  param_name: string
  count: number
  active: boolean
  url_to_add: string
  url_to_remove: string
  image: null
  swatch: null
}

export type LiquidFilter = {
  label: string
  param_name: string
  type: 'list' | 'boolean' | 'price_range'
  presentation: 'text'
  operator: 'OR'
  values: LiquidFilterValue[]
  active_values: LiquidFilterValue[]
  inactive_values: LiquidFilterValue[]
  url_to_remove: string
  false_value?: LiquidFilterValue | undefined
  true_value?: LiquidFilterValue | undefined
  min_value?: { param_name: string; value: number | null } | undefined
  max_value?: { param_name: string; value: number | null } | undefined
  range_max?: number | undefined
}

/** Where the filter links go and what they keep: the page, its search terms and sort. */
export type LiquidFilterPage = {
  path: string
  q?: string | undefined
  sort?: string | null | undefined
}

/** Labels the theme shows for our built-in filters (Shopify's English defaults). */
const LABELS = {
  availability: 'Availability',
  inStock: 'In stock',
  outOfStock: 'Out of stock',
  price: 'Price',
  productType: 'Product type',
  vendor: 'Brand',
  yes: 'Yes',
  no: 'No',
}

/** One filter's picked values in `BrowseFilters`, read and written back. */
type Slot = {
  get: (f: BrowseFilters) => string[]
  set: (f: BrowseFilters, values: string[]) => BrowseFilters
}

const availability: Slot = {
  get: (f) => (f.available === null ? [] : [f.available ? '1' : '0']),
  set: (f, values) => ({
    ...f,
    available: values.length === 1 ? values[0] === '1' : null,
  }),
}

const keyed = (field: 'options' | 'metafields', key: string): Slot => ({
  get: (f) => f[field][key] ?? [],
  set: (f, values) => {
    const next = { ...f[field] }
    if (values.length > 0) next[key] = values
    else delete next[key]
    return { ...f, [field]: next }
  },
})

const listed = (field: 'productTypes' | 'vendors'): Slot => ({
  get: (f) => f[field],
  set: (f, values) => ({ ...f, [field]: values }),
})

function listFilter(
  page: LiquidFilterPage,
  filters: BrowseFilters,
  spec: {
    label: string
    param: string
    type: 'list' | 'boolean'
    slot: Slot
    values: (FacetValue & { label?: string })[]
  },
): LiquidFilter {
  const href = (f: BrowseFilters) => browseHref(page.path, { q: page.q, filters: f, sort: page.sort ?? null })
  const picked = spec.slot.get(filters)
  const values = spec.values.map((v): LiquidFilterValue => {
    const active = picked.includes(v.value)
    return {
      label: v.label ?? v.value,
      value: v.value,
      param_name: spec.param,
      count: v.count,
      active,
      url_to_add: href(spec.slot.set(filters, active ? picked : [...picked, v.value])),
      url_to_remove: href(spec.slot.set(filters, picked.filter((x) => x !== v.value))),
      image: null,
      swatch: null,
    }
  })
  return {
    label: spec.label,
    param_name: spec.param,
    type: spec.type,
    presentation: 'text',
    operator: 'OR',
    values,
    active_values: values.filter((v) => v.active),
    inactive_values: values.filter((v) => !v.active),
    url_to_remove: href(spec.slot.set(filters, [])),
    ...(spec.type === 'boolean'
      ? {
          true_value: values.find((v) => v.value === '1'),
          false_value: values.find((v) => v.value === '0'),
        }
      : {}),
  }
}

/**
 * Shopify's `filters` for a listing: availability, price, each option, then the product extra
 * fields marked "Use as filter", then type and brand when the listing has more than one.
 */
export function liquidFilters(
  facets: BrowseFacets,
  filters: BrowseFilters,
  page: LiquidFilterPage,
): LiquidFilter[] {
  const out: LiquidFilter[] = []
  if (facets.inStock + facets.outOfStock > 0) {
    out.push(
      listFilter(page, filters, {
        label: LABELS.availability,
        param: FILTER_PARAM.available,
        type: 'list',
        slot: availability,
        values: [
          { value: '1', count: facets.inStock, label: LABELS.inStock },
          { value: '0', count: facets.outOfStock, label: LABELS.outOfStock },
        ],
      }),
    )
  }
  if (facets.priceMax !== null && facets.priceMax > 0) {
    const withoutPrice = { ...filters, priceMin: null, priceMax: null }
    out.push({
      label: LABELS.price,
      param_name: 'filter.v.price',
      type: 'price_range',
      presentation: 'text',
      operator: 'OR',
      values: [],
      active_values: [],
      inactive_values: [],
      url_to_remove: browseHref(page.path, { q: page.q, filters: withoutPrice, sort: page.sort ?? null }),
      // Paise, the subunit `| money` reads, as Shopify's cents.
      min_value: { param_name: FILTER_PARAM.priceMin, value: filters.priceMin },
      max_value: { param_name: FILTER_PARAM.priceMax, value: filters.priceMax },
      range_max: facets.priceMax,
    })
  }
  for (const o of facets.options) {
    out.push(
      listFilter(page, filters, {
        label: o.name,
        param: `${FILTER_PARAM.optionPrefix}${o.key}`,
        type: 'list',
        slot: keyed('options', o.key),
        values: o.values,
      }),
    )
  }
  for (const m of facets.metafields) {
    out.push(
      listFilter(page, filters, {
        label: m.name,
        param: `${FILTER_PARAM.metafieldPrefix}${m.key}`,
        type: m.type,
        slot: keyed('metafields', m.key),
        values:
          m.type === 'boolean'
            ? m.values.map((v) => ({ ...v, label: v.value === '1' ? LABELS.yes : LABELS.no }))
            : m.values,
      }),
    )
  }
  if (facets.productTypes.length > 1) {
    out.push(
      listFilter(page, filters, {
        label: LABELS.productType,
        param: FILTER_PARAM.productType,
        type: 'list',
        slot: listed('productTypes'),
        values: facets.productTypes,
      }),
    )
  }
  if (facets.vendors.length > 1) {
    out.push(
      listFilter(page, filters, {
        label: LABELS.vendor,
        param: FILTER_PARAM.vendor,
        type: 'list',
        slot: listed('vendors'),
        values: facets.vendors,
      }),
    )
  }
  return out
}
