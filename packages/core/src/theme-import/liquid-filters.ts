/** SOURCE OF TRUTH: Shopify's storefront filter objects for imported themes — WHAT: `collection.filters` and `search.filters` (filter and filter_value: label, param_name, type, values with counts, active, url_to_add / url_to_remove, price ranges) built from our catalogue facets, the store's filter settings and the request's filters / WHY: a Liquid theme's own collection and search pages draw their filter drawer from these; with them empty the drawer was blank, and the links they build land on our browse params (`filter.p.m.<namespace>.<key>`, Shopify's shape) */
import type { BrowseFacets } from '../catalog/browse'
import {
  type BrowseFilters,
  browseHref,
  FILTER_PARAM,
  pickedValues,
  withValues,
} from '../catalog/browse-params'
import {
  type FilterSource,
  type ResolvedFilterGroup,
  resolveFilterGroups,
  type StorefrontFilterConfig,
} from '../catalog/filter-config'

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

/** The drawer's name for a group the merchant did not name. */
const DEFAULT_LABEL: Partial<Record<FilterSource, string>> = {
  availability: LABELS.availability,
  price: LABELS.price,
  productType: LABELS.productType,
  vendor: LABELS.vendor,
  giftCard: 'Product kind',
  tags: 'Tags',
}

/** Value labels for groups whose values are codes (`1` / `0`). */
function valueLabel(g: ResolvedFilterGroup, value: string): string | undefined {
  if (g.source === 'availability') return value === '1' ? LABELS.inStock : LABELS.outOfStock
  if (g.source === 'giftCard') return value === '1' ? 'Gift cards' : 'Products'
  if (g.type === 'boolean') return value === '1' ? LABELS.yes : LABELS.no
  return undefined
}

function listFilter(
  page: LiquidFilterPage,
  filters: BrowseFilters,
  g: ResolvedFilterGroup,
): LiquidFilter {
  const href = (f: BrowseFilters) =>
    browseHref(page.path, { q: page.q, filters: f, sort: page.sort ?? null })
  const picked = pickedValues(filters, g.slot)
  const type = g.type === 'boolean' ? 'boolean' : 'list'
  const values = g.values.map((v): LiquidFilterValue => {
    const active = picked.includes(v.value)
    return {
      label: v.label ?? valueLabel(g, v.value) ?? v.value,
      value: v.value,
      param_name: g.param,
      count: v.count,
      active,
      url_to_add: href(withValues(filters, g.slot, active ? picked : [...picked, v.value])),
      url_to_remove: href(
        withValues(
          filters,
          g.slot,
          picked.filter((x) => x !== v.value),
        ),
      ),
      image: null,
      swatch: null,
    }
  })
  return {
    label: g.label ?? DEFAULT_LABEL[g.source] ?? g.id,
    param_name: g.param,
    type,
    presentation: 'text',
    operator: 'OR',
    values,
    active_values: values.filter((v) => v.active),
    inactive_values: values.filter((v) => !v.active),
    url_to_remove: href(withValues(filters, g.slot, [])),
    ...(type === 'boolean'
      ? {
          true_value: values.find((v) => v.value === '1'),
          false_value: values.find((v) => v.value === '0'),
        }
      : {}),
  }
}

/**
 * Shopify's `filters` for a listing, in the order the store's filter settings give. Without
 * settings, Shopify's defaults: availability, price, each option, then the product extra fields
 * marked "Use as filter", then type and brand when the listing has more than one.
 */
export function liquidFilters(
  facets: BrowseFacets,
  filters: BrowseFilters,
  page: LiquidFilterPage,
  config: StorefrontFilterConfig | null = null,
): LiquidFilter[] {
  return resolveFilterGroups(facets, config, 'liquid').map((g) => {
    if (g.type !== 'price_range') return listFilter(page, filters, g)
    return {
      label: g.label ?? LABELS.price,
      param_name: g.param,
      type: 'price_range',
      presentation: 'text',
      operator: 'OR',
      values: [],
      active_values: [],
      inactive_values: [],
      url_to_remove: browseHref(page.path, {
        q: page.q,
        filters: withValues(filters, g.slot, []),
        sort: page.sort ?? null,
      }),
      // Paise, the subunit `| money` reads, as Shopify's cents.
      min_value: { param_name: FILTER_PARAM.priceMin, value: filters.priceMin },
      max_value: { param_name: FILTER_PARAM.priceMax, value: filters.priceMax },
      range_max: g.priceMax,
    }
  })
}
