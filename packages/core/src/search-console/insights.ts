/** SOURCE OF TRUTH: Google Search Console numbers — WHAT: the row shape the Search Console app stores, how Google's page URLs map to our products, collections and pages, how rows add up, and the thresholds behind "Almost page 1", "Losing traffic" and the SEO report's search issues / WHY: the app's pages, the product page card and the SEO report read the same rules, so they never disagree. Pure and client-safe: no database */

/** The app's plugin id, and its entry in `store.apps.settings`. */
export const SEARCH_CONSOLE_APP_ID = 'google-search-console'

/** The worker job that pulls a store's numbers from Google (also run by "Refresh now"). */
export const SEARCH_CONSOLE_SYNC_JOB = 'sync'

/** What a stored row is broken down by. `total`: the whole property, one row per period. */
export const SEARCH_DIMENSIONS = [
  'total',
  'page',
  'query',
  'page_query',
  'device',
  'country',
] as const
export type SearchDimension = (typeof SEARCH_DIMENSIONS)[number]

/** The last 28 days Google has final numbers for, and the 28 days before them. */
export const SEARCH_PERIODS = ['current', 'previous'] as const
export type SearchPeriod = (typeof SEARCH_PERIODS)[number]

/** Days in each period. */
export const SEARCH_PERIOD_DAYS = 28

/** One row from Search Analytics, as stored. */
export type SearchRow = {
  period: SearchPeriod
  dimension: SearchDimension
  /** The URL as Google reports it (page and page_query rows). */
  page: string | null
  /** `searchPath(page)`: what the row is matched to our items by. */
  path: string | null
  query: string | null
  /** Device (`MOBILE`, `DESKTOP`, `TABLET`) or country (ISO 3166 alpha-3, lowercase). */
  segment: string | null
  clicks: number
  impressions: number
  /** Google's average position, 1 = the top result. */
  position: number
}

/** Clicks, impressions, click-through rate (0–1) and average position of one or more rows. */
export type SearchStats = { clicks: number; impressions: number; ctr: number; position: number }

export const EMPTY_STATS: SearchStats = { clicks: 0, impressions: 0, ctr: 0, position: 0 }

/**
 * Rows added up. Position is averaged by impressions (how Google weighs it), so one URL seen
 * 1,000 times counts more than its twin seen twice.
 */
export function sumStats(
  rows: readonly Pick<SearchRow, 'clicks' | 'impressions' | 'position'>[],
): SearchStats {
  let clicks = 0
  let impressions = 0
  let weighted = 0
  for (const r of rows) {
    clicks += r.clicks
    impressions += r.impressions
    weighted += r.position * r.impressions
  }
  if (impressions === 0) return { ...EMPTY_STATS, clicks }
  return { clicks, impressions, ctr: clicks / impressions, position: weighted / impressions }
}

/** Percent change from `before` to `now`; null when there is nothing to compare against. */
export function percentChange(now: number, before: number): number | null {
  if (before === 0) return now === 0 ? 0 : null
  return Math.round(((now - before) / before) * 1000) / 10
}

/**
 * The path a Google page URL is matched by: lowercase, decoded, no query, no trailing slash.
 * A product opened inside a collection (`/collections/x/products/y`) is the product.
 * Null for something that is not a URL.
 */
export function searchPath(pageUrl: string): string | null {
  let url: URL
  try {
    url = new URL(pageUrl)
  } catch {
    return null
  }
  let path = url.pathname
  try {
    path = decodeURIComponent(path)
  } catch {
    // Keep the raw path: Google reported it that way.
  }
  path = path.toLowerCase().replace(/\/+$/, '') || '/'
  const nested = /^\/collections\/[^/]+(\/products\/[^/]+)$/.exec(path)
  return nested?.[1] ?? path
}

/** What a path is in this store. `handle` is set for products, collections and pages. */
export type SearchPathKind = 'home' | 'product' | 'collection' | 'page' | 'other'

export function searchPathKind(path: string): { kind: SearchPathKind; handle: string | null } {
  if (path === '/') return { kind: 'home', handle: null }
  const m = /^\/(products|collections|pages)\/([^/]+)$/.exec(path)
  if (!m?.[2]) return { kind: 'other', handle: null }
  const kind = m[1] === 'products' ? 'product' : m[1] === 'collections' ? 'collection' : 'page'
  return { kind, handle: m[2] }
}

/** The path of a product's own page, as `searchPath` writes it. */
export const productSearchPath = (handle: string): string => `/products/${handle.toLowerCase()}`

/** Shown on Google, just off page one: worth a better title, description and more text. */
export const ALMOST_PAGE_ONE = { minPosition: 8, maxPosition: 20, minImpressions: 100 } as const

/** Shown near the top, but far fewer clicks than that spot usually gets. */
export const LOW_CTR = { minImpressions: 300, maxPosition: 8, shareOfExpected: 0.5 } as const

/**
 * Roughly what share of searchers click a result at this position (public click-through
 * studies, rounded). Only used to say "fewer clicks than usual", never shown as a number.
 */
export function expectedCtr(position: number): number {
  if (position < 1.5) return 0.28
  if (position < 2.5) return 0.15
  if (position < 3.5) return 0.1
  if (position < 4.5) return 0.07
  if (position < 5.5) return 0.05
  if (position < 10.5) return 0.03
  return 0.01
}

export const isAlmostPageOne = (s: SearchStats): boolean =>
  s.impressions >= ALMOST_PAGE_ONE.minImpressions &&
  s.position >= ALMOST_PAGE_ONE.minPosition &&
  s.position <= ALMOST_PAGE_ONE.maxPosition

export const isLowCtr = (s: SearchStats): boolean =>
  s.impressions >= LOW_CTR.minImpressions &&
  s.position > 0 &&
  s.position < LOW_CTR.maxPosition &&
  s.ctr < expectedCtr(s.position) * LOW_CTR.shareOfExpected

/** Rows of one period and dimension added up by a key (path, query, device…). */
export function statsBy(
  rows: readonly SearchRow[],
  key: (row: SearchRow) => string | null,
): Map<string, SearchStats> {
  const groups = new Map<string, SearchRow[]>()
  for (const row of rows) {
    const k = key(row)
    if (k === null) continue
    const list = groups.get(k)
    if (list) list.push(row)
    else groups.set(k, [row])
  }
  return new Map([...groups].map(([k, list]) => [k, sumStats(list)]))
}

/** One ranked entry: this period, the period before, and the change in clicks. */
export type SearchCompare = {
  key: string
  current: SearchStats
  previous: SearchStats
  /** Clicks now minus clicks before. */
  clickDelta: number
}

/** The keys of `current` with their previous numbers, most clicks first (then impressions). */
export function compareStats(
  current: Map<string, SearchStats>,
  previous: Map<string, SearchStats>,
): SearchCompare[] {
  return [...current]
    .map(([key, now]) => {
      const before = previous.get(key) ?? EMPTY_STATS
      return { key, current: now, previous: before, clickDelta: now.clicks - before.clicks }
    })
    .sort(
      (a, b) =>
        b.current.clicks - a.current.clicks || b.current.impressions - a.current.impressions,
    )
}

/** Pages or searches that lost the most clicks, biggest drop first (gone entirely included). */
export function losingTraffic(
  current: Map<string, SearchStats>,
  previous: Map<string, SearchStats>,
): SearchCompare[] {
  return [...previous]
    .map(([key, before]) => {
      const now = current.get(key) ?? EMPTY_STATS
      return { key, current: now, previous: before, clickDelta: now.clicks - before.clicks }
    })
    .filter((c) => c.clickDelta < 0)
    .sort((a, b) => a.clickDelta - b.clickDelta)
}

/** Entries just off page one, most impressions first: the easiest wins. */
export function almostPageOne(current: Map<string, SearchStats>): [string, SearchStats][] {
  return [...current]
    .filter(([, s]) => isAlmostPageOne(s))
    .sort(([, a], [, b]) => b.impressions - a.impressions)
}
