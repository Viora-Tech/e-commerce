/**
 * Shopify's Section Rendering API as an imported theme's script asks for it: `?sections=a,b`
 * answers JSON keyed by every section asked for, `?section_id=` one section's HTML. Both reach
 * `/theme-actions/section`: the theme's fetches through `lib/liquid-shim.ts`, and a page URL
 * asked for directly (`/collections/all?section_id=guide-results`) through the proxy
 * (`sectionRenderingPath`), so a fetch the shim never sees gets the section, not the page.
 */

import { INTERNAL_PREFIX, SECTION_PATH_HEADER } from './routing'

/** Shopify answers at most this many sections in one `?sections=` request. */
export const MAX_SECTIONS = 5

const SECTION_ID = /^[a-z0-9_-]{1,80}$/i

/** Whether `id` can name a theme section: it goes into a file lookup, so nothing else is tried. */
export function validSectionId(id: string): boolean {
  return SECTION_ID.test(id)
}

/**
 * The sections a `?sections=` list asks for, in order, each once, capped at `MAX_SECTIONS`.
 * An id that cannot name a section stays in the list (it answers null) but is never rendered.
 */
export function requestedSections(list: string): string[] {
  const ids = list
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return [...new Set(ids)].slice(0, MAX_SECTIONS)
}

/**
 * Paths that answer `?section_id=` themselves (predictive search, recommendations, the section
 * route), files and APIs, and the pages a theme never draws (checkout, the account).
 */
const NOT_A_SECTION_PAGE =
  /^\/(search\/suggest|recommendations\/|theme-actions\/|theme-assets\/|checkout|account|api\/|_next\/)|\.[a-z0-9]+$/i

/**
 * The section route a storefront page request is rewritten to when it asks for Shopify's
 * section rendering (`?section_id=` or `?sections=`), else null. The caller passes the page's
 * own path along as `path`, so the section renders with that collection, its filters and sort.
 */
export function sectionRenderingPath(
  storeId: string,
  method: string,
  pathname: string,
  params: URLSearchParams,
): string | null {
  if (method !== 'GET' && method !== 'HEAD') return null
  if (!params.has('section_id') && !params.has('sections')) return null
  if (NOT_A_SECTION_PAGE.test(pathname)) return null
  return `${INTERNAL_PREFIX}/${storeId}/theme-actions/section`
}

/**
 * Points a storefront page request (`url`, already rewritten to its page) at the section route
 * when it asks for section rendering, with the page's path in `SECTION_PATH_HEADER` on the
 * forwarded request `headers` (the route never sees a query param the rewrite adds); true when
 * it did.
 */
export function toSectionRendering(
  url: URL,
  headers: Headers,
  storeId: string,
  method: string,
  pathname: string,
): boolean {
  const target = sectionRenderingPath(storeId, method, pathname, url.searchParams)
  if (!target) return false
  headers.set(SECTION_PATH_HEADER, pathname)
  url.pathname = target
  return true
}

/**
 * The page path a section request renders on: the proxy's header for a page URL
 * (`/collections/all?section_id=`), else the shim's `?path=`, else the home page.
 */
export function sectionPagePath(req: Request): string {
  return req.headers.get(SECTION_PATH_HEADER) || new URL(req.url).searchParams.get('path') || '/'
}
