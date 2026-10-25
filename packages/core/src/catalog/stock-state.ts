/** SOURCE OF TRUTH: stock status — WHAT: what the storefront and admin say about a variant's or product's stock, the threshold for "low", and the short spellings `?stock=` links and list filters use / WHY: one rule for every stock badge and filter. Browser-safe (`@commerce/core/catalog`). */

const STOCK_STATES = ['in_stock', 'low', 'out', 'unlimited'] as const
export type StockState = (typeof STOCK_STATES)[number]

/**
 * At or below this many units available, tracked stock reads as low. Also the default of the
 * store's own setting (`store.low_stock_threshold`), which the inventory pages use.
 */
export const LOW_STOCK_THRESHOLD = 5

/**
 * Untracked stock is unlimited; otherwise nothing available is out, a few is low. Pass the
 * store's threshold where it is loaded; the default is `LOW_STOCK_THRESHOLD`.
 */
export function stockStateOf(
  v: { trackInventory: boolean; available: number },
  lowThreshold: number = LOW_STOCK_THRESHOLD,
): StockState {
  if (!v.trackInventory) return 'unlimited'
  if (!Number.isFinite(v.available) || v.available <= 0) return 'out'
  return v.available <= lowThreshold ? 'low' : 'in_stock'
}

/**
 * The states a list can filter by, keyed to the short value in `?stock=` links and the
 * products and inventory list APIs. Old links (`?stock=in`) keep working.
 */
export const STOCK_FILTER_PARAM = {
  in_stock: 'in',
  low: 'low',
  out: 'out',
} as const satisfies Partial<Record<StockState, string>>

export type StockFilter = (typeof STOCK_FILTER_PARAM)[keyof typeof STOCK_FILTER_PARAM]
/** Every `StockFilter`, as a tuple for zod and URL parsers (the `satisfies` keeps it in step). */
export const STOCK_FILTERS = ['in', 'low', 'out'] as const satisfies readonly StockFilter[]

/** The state a `?stock=` value filters to. */
export function stockFilterState(filter: StockFilter): StockState {
  return filter === 'in' ? 'in_stock' : filter
}
