/** SOURCE OF TRUTH: browse abandonment rules — WHAT: which page views count as a product view,
 * the run key that keeps one run per shopper, product and week, and when a view is due /
 * WHY: the storefront beacon, the legacy Growth runner and the Automations engine sweep must
 * agree on the same rules (audit #183). Pure: no database import.
 */

/** A shopper is nudged about one product at most once a week. */
const BROWSE_REPEAT_DAYS = 7
/** Views older than this are not chased, however the settings read. */
const BROWSE_LOOKBACK_DAYS = 7
/** The default wait after a view before it counts as abandoned. */
export const BROWSE_DEFAULT_AFTER_MINUTES = 4 * 60
/** A repeat view of the same product within this window does not write again. */
export const BROWSE_VIEW_THROTTLE_MINUTES = 5

const DAY_MS = 86_400_000

/**
 * The product handle of a storefront product page URL ("/products/glasspad", also under a market
 * or language prefix such as "/en-ae/products/glasspad"); null for any other page.
 */
export function productHandleFromHref(href: string): string | null {
  let path: string
  try {
    path = new URL(href, 'https://store.invalid').pathname
  } catch {
    return null
  }
  const m = /(?:^|\/)products\/([^/]+)\/?$/.exec(path)
  if (!m?.[1]) return null
  let handle: string
  try {
    handle = decodeURIComponent(m[1])
  } catch {
    return null
  }
  handle = handle.trim().toLowerCase()
  return handle && handle.length <= 255 ? handle : null
}

/** The start of every run key for one shopper and product. */
export const browseKeyPrefix = (customerId: string, productId: string): string =>
  `browse:${customerId}:${productId}:`

/** One run per view: the view time keeps a later week's view a new run. */
export const browseKey = (customerId: string, productId: string, viewedAt: Date): string =>
  `${browseKeyPrefix(customerId, productId)}${viewedAt.getTime()}`

/** The product id a browse run key carries; null for other keys. */
export function productIdFromBrowseKey(key: string): string | null {
  const m = /^browse:[0-9a-f-]{36}:([0-9a-f-]{36}):\d+$/i.exec(key)
  return m?.[1] ?? null
}

/** The window a view must sit in to be due: quiet for `afterMinutes`, within the lookback. */
export function browseWindow(now: Date, afterMinutes: number): { from: Date; to: Date } {
  return {
    from: new Date(now.getTime() - BROWSE_LOOKBACK_DAYS * DAY_MS),
    to: new Date(now.getTime() - afterMinutes * 60_000),
  }
}

/** Runs for the same shopper and product started after this are a repeat (one per week). */
export const browseRepeatSince = (now: Date): Date =>
  new Date(now.getTime() - BROWSE_REPEAT_DAYS * DAY_MS)
