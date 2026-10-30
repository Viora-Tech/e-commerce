/** SOURCE OF TRUTH: Search & discovery words and limits — WHAT: how a shopper's search is normalised before it is logged or matched to a pin, which searches are never logged (they look like an email or a phone number), the event sources and kinds, the 30-minute link window and the funnel rates / WHY: the storefront beacon, the search pins and the admin Overview must agree on one spelling of a search, and the search log must never hold personal data. Pure and browser-safe (`@commerce/core/discovery`). */

/** Longest search kept, in characters. */
export const MAX_QUERY_LENGTH = 100

/** A click, add or order counts for the search (or recommendation) before it within this long. */
export const LINK_WINDOW_MINUTES = 30

/** Search and recommendation events are deleted after this many days. */
export const DISCOVERY_RETENTION_DAYS = 90

export const DISCOVERY_SOURCES = ['search', 'related', 'complementary'] as const
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number]

export const RECOMMENDATION_INTENTS = ['related', 'complementary'] as const
export type RecommendationIntentKind = (typeof RECOMMENDATION_INTENTS)[number]

export const DISCOVERY_KINDS = ['search', 'impression', 'click', 'add', 'checkout'] as const
export type DiscoveryKind = (typeof DISCOVERY_KINDS)[number]

/** Quotes and punctuation a shopper leaves around a search ("keyboard?", "'mouse'"). */
const EDGE_PUNCTUATION = /^[\s"'`“”‘’.,!?;:()[\]{}]+|[\s"'`“”‘’.,!?;:()[\]{}]+$/g

/**
 * One spelling of a search: Unicode-normalised, lower case, control characters dropped, runs of
 * spaces made one, surrounding quotes and punctuation trimmed, cut to `MAX_QUERY_LENGTH`.
 * "  Wireless   KEYBOARD? " and "wireless keyboard" are the same search.
 */
export function normaliseSearchQuery(raw: string): string {
  return raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\p{Cc}/gu, ' ')
    .replace(/\s+/g, ' ')
    .replace(EDGE_PUNCTUATION, '')
    .slice(0, MAX_QUERY_LENGTH)
    .trim()
}

/** An email address anywhere in the search. */
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/
/** Ten or more digits in a row, spaces and dashes allowed between them: a phone number. */
const PHONE = /(?:\d[\s-]?){10,}/

/**
 * The search as the log keeps it, or null when it must not be kept: empty, or it looks like an
 * email address or a phone number (a shopper pasting their own details into the search box).
 */
export function loggableQuery(raw: string): string | null {
  const q = normaliseSearchQuery(raw)
  if (!q || EMAIL.test(q) || PHONE.test(q)) return null
  return q
}

/** `part` out of `whole` as a fraction, 0 when there is nothing to divide. */
export function discoveryRate(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0
}

/** Percent change from `before` to `now`; null when there was nothing before. */
export function discoveryChange(now: number, before: number): number | null {
  if (before === 0) return null
  return ((now - before) / before) * 100
}

/** The search funnel: sessions that searched, then clicked a result, added one, and ordered. */
export type SearchFunnel = {
  sessions: number
  clicked: number
  added: number
  checkedOut: number
}

/** One search in a list: how often, by how many sessions, with how many results and clicks. */
export type SearchQueryStat = {
  query: string
  searches: number
  sessions: number
  /** Results the latest search found. */
  results: number
  /** Sessions that clicked a result within the link window. */
  clickedSessions: number
}

/** A recommendation row's numbers: times shown, product clicks, and adds of a clicked product. */
export type RecommendationStat = {
  intent: RecommendationIntentKind
  impressions: number
  clicks: number
  adds: number
}

/** The app's Overview for a period, with the same numbers for the period before. */
export type DiscoveryOverview = {
  days: number
  funnel: SearchFunnel
  previous: SearchFunnel
  topSearches: SearchQueryStat[]
  noResults: SearchQueryStat[]
  noClicks: SearchQueryStat[]
  recommendations: RecommendationStat[]
}

/** Periods the Overview offers, in days. */
export const OVERVIEW_PERIODS = [7, 30, 90] as const
export type OverviewPeriod = (typeof OVERVIEW_PERIODS)[number]

/** Rows in each Overview list. */
export const OVERVIEW_LIST_SIZE = 20

/**
 * The Overview's three lists from one pass over the period's searches (most searched first):
 * top searches, searches whose latest run found nothing, and searches that found products but
 * no session clicked one.
 */
export function splitSearchLists(
  stats: SearchQueryStat[],
  size = OVERVIEW_LIST_SIZE,
): Pick<DiscoveryOverview, 'topSearches' | 'noResults' | 'noClicks'> {
  return {
    topSearches: stats.slice(0, size),
    noResults: stats.filter((s) => s.results === 0).slice(0, size),
    noClicks: stats.filter((s) => s.results > 0 && s.clickedSessions === 0).slice(0, size),
  }
}
