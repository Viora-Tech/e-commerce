/**
 * SOURCE OF TRUTH: ad-click and campaign query params (`fbclid`, `gclid`, `utm_*`, …) — WHAT: which
 * params never change what a store page shows, the URL without them, and the Cloudflare rule that
 * takes them out of the edge cache key / WHY: every ad click carries a unique `fbclid` or `gclid`,
 * so a CDN keying by the full URL misses on every ad visitor and the page waits on the origin
 * (up to 4.6 s on a cold product page). The origin never reads them for a page: attribution reads
 * the browser's own `location.href` through the beacon (`/api/beacon`, `/api/px`), which keeps them.
 *
 * `ref` (affiliate links) is NOT here: the proxy reads it to set the referral cookie and keeps
 * that page out of the cache itself (`proxy.ts`).
 */

/** Ad networks' click ids. */
const CLICK_IDS = [
  'fbclid',
  'gclid',
  'gbraid',
  'wbraid',
  'dclid',
  'gad_source',
  'gad_campaignid',
  'ttclid',
  'msclkid',
  'twclid',
  'li_fat_id',
  'igshid',
] as const

/** The UTM tags analytics tools write; Cloudflare's rule needs every name spelled out. */
const UTM_TAGS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
] as const

/** Every param the Cloudflare rule removes, in the order it lists them. */
export const TRACKING_PARAMS: readonly string[] = [...CLICK_IDS, ...UTM_TAGS]

const CLICK_ID_SET = new Set<string>(CLICK_IDS)

/** True for a click id or any `utm_` tag (case as sent: `UTM_SOURCE` is someone else's param). */
export function isTrackingParam(name: string): boolean {
  return CLICK_ID_SET.has(name) || name.startsWith('utm_')
}

/** `search` (with or without `?`) without tracking params, as `?…` or `''`; order kept. */
export function withoutTrackingParams(search: string): string {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const kept = [...params].filter(([name]) => !isTrackingParam(name))
  if (kept.length === [...params].length) return search === '?' ? '' : search
  const qs = new URLSearchParams(kept).toString()
  return qs ? `?${qs}` : ''
}

/** True when the query carries at least one tracking param. */
export function hasTrackingParams(search: string): boolean {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  return [...params.keys()].some(isTrackingParam)
}

/** Paths the rewrite leaves alone: API calls, webhooks and Next's own files see the full URL. */
const UNTOUCHED_PREFIXES = ['/api/', '/_next/', '/webhooks/'] as const

/**
 * The Cloudflare URL rewrite (Rules → Transform Rules → Rewrite URL, on the SaaS zone) that drops
 * the tracking params from what the edge caches and the origin sees. Cache Rules can only exclude
 * query params from the cache key on Enterprise; a rewrite runs before the cache on every plan, and
 * the shopper's address bar (which pixels and the beacon read) keeps the params.
 */
export function cloudflareTrackingRewrite(): {
  description: string
  expression: string
  query: string
} {
  const has = TRACKING_PARAMS.map((p) => `http.request.uri.query contains "${p}="`).join(' or ')
  const skip = UNTOUCHED_PREFIXES.map((p) => `not starts_with(http.request.uri.path, "${p}")`).join(
    ' and ',
  )
  const args = TRACKING_PARAMS.map((p) => `"${p}"`).join(', ')
  return {
    description: 'Store pages: ad-click params out of the cache key',
    expression: `(http.request.method eq "GET" and ${skip} and (${has}))`,
    query: `remove_query_args(http.request.uri.query, ${args})`,
  }
}
