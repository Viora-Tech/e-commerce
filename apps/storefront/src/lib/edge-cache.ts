/**
 * Whether a shared cache (Cloudflare, a CDN) may keep a storefront page, and for how long. Pure:
 * `proxy.ts` asks once per request, before the page renders.
 *
 * Only a plain page view by a visitor carrying none of our cookies qualifies: that page is the
 * same for every such visitor (no cart, no account, no saved choices, no theme preview). Our
 * cookies are `wc_*`, plus `theme` (light or dark) and `recently_viewed`; anything else (analytics
 * cookies) does not change what we draw, and neither does `wc_ref` (the affiliate referral, read
 * only when an order is placed). Cart, checkout, account, actions and API routes never
 * qualify, and neither does a client-side navigation (`RSC: 1`), which the CDN cannot key apart.
 *
 * The page carries the CSP nonce it was rendered with, and a CDN hands that page (and its
 * header) to the next visitor too. Fine: an attacker reading a cached nonce would also need to
 * get markup into that same cached page, which any store write replaces with a fresh render.
 */

/** Pages that show the same thing to every visitor without cookies. */
const SHARED_PAGES = [
  /^\/$/,
  /^\/products\/[^/]+\/?$/,
  /^\/collections(\/[^/]+)?\/?$/,
  /^\/pages\/[^/]+\/?$/,
  /^\/blogs\/[^/]+(\/[^/]+)?\/?$/,
  /^\/policies\/[^/]+\/?$/,
  /^\/search\/?$/,
]

/** The longest a shared cache may serve a page past its TTL while it refetches. */
const MAX_STALE_SECONDS = 3600

const PERSONAL_COOKIES = new Set(['theme', 'recently_viewed'])
/** Our cookies that never change what a page shows. */
const NEUTRAL_COOKIES = new Set(['wc_ref'])

/** A catalogue or content page: the same for every visitor without cookies. */
export function isSharedPage(pathname: string): boolean {
  return SHARED_PAGES.some((re) => re.test(pathname))
}

/** True for one of our cookies, whose value changes what a page shows. */
export function isPersonalCookie(name: string): boolean {
  if (NEUTRAL_COOKIES.has(name)) return false
  return name.startsWith('wc_') || PERSONAL_COOKIES.has(name)
}

export type EdgeCacheInput = {
  method: string
  pathname: string
  cookieNames: readonly string[]
  /** The `RSC` request header is set: a client-side navigation's payload, not a page. */
  rsc: boolean
  /** A theme preview, the password page or a form result: never shared. */
  personal: boolean
  /** Seconds a shared cache may keep the page (`STOREFRONT_EDGE_TTL`); 0 turns this off. */
  ttlSeconds: number
}

/** The `Cache-Control` to send, or null to leave the page private (Next's default). */
export function edgeCacheControl(input: EdgeCacheInput): string | null {
  if (input.ttlSeconds <= 0) return null
  if (input.method !== 'GET' && input.method !== 'HEAD') return null
  if (input.rsc || input.personal) return null
  if (input.cookieNames.some(isPersonalCookie)) return null
  if (!isSharedPage(input.pathname)) return null
  // Browsers always ask again (max-age=0); a shared cache keeps it for the TTL and may serve it
  // a while longer while it fetches a fresh one (ten TTLs, at most an hour: with a long TTL the
  // worker's purge keeps it fresh, and the stale window only covers a purge that failed).
  const stale = Math.min(input.ttlSeconds * 10, MAX_STALE_SECONDS)
  return `public, max-age=0, s-maxage=${input.ttlSeconds}, stale-while-revalidate=${stale}`
}
