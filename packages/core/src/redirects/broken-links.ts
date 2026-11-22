/**
 * SOURCE OF TRUTH KEYWORDS: broken links, 404 log, redirect suggestion
 * WHAT:  Which storefront 404s are worth logging, the referrer we keep, and the closest product or
 *        collection to suggest as a redirect target. Pure, so it is safe in client bundles.
 * WHY:   The log is for pages people and search engines expect (old Shopify links, typos), not
 *        assets, endpoints or bots' junk (base64 tokens Googlebot lifted out of scripts).
 * WHERE: Storefront `not-found.tsx` (filter), core `broken-links-service.ts` (suggestions).
 */
import { slugify } from '../catalog/slug'
import { normaliseRedirectPath } from './paths'

/** Longest path kept; longer ones are junk or attacks. */
export const BROKEN_LINK_PATH_MAX = 300

/** Prefixes that are endpoints, assets or framework internals, never pages. */
const SKIP_PREFIXES = [
  '/api/',
  '/_next/',
  '/-',
  '/cdn-cgi/',
  '/theme-assets/',
  '/theme-actions/',
  '/.well-known/',
  '/wp-',
  '/cart/',
]

/** A last segment with a file extension (`.js`, `.png`, `.m3u8`, `.php`): an asset or a probe. */
const FILE_EXTENSION = /\.[a-z0-9]{1,8}$/i

/**
 * A random token rather than words: 16+ characters mixing upper case, lower case and digits
 * (`PcFBwC3+4Fcl7SdViaL5nWGFY744XgP`, a CSP nonce, a hash). Handles are lower case.
 */
function tokenShaped(segment: string): boolean {
  if (segment.length < 16) return false
  return /[a-z]/.test(segment) && /[A-Z]/.test(segment) && /[0-9]/.test(segment)
}

/** A segment with its escapes decoded, so `%E5%B9%BB` reads as one character, not a token. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/**
 * Whether a 404 for `rawPath` (the request's path, before decoding, no query) is worth logging.
 * Takes the raw path because the junk's shape (case, `=`, `+`, `${`) is lost once normalised.
 */
export function shouldLogBrokenLink(rawPath: string): boolean {
  const path = rawPath.split(/[?#]/)[0] ?? ''
  if (!path.startsWith('/') || path === '/' || path.length > BROKEN_LINK_PATH_MAX) return false
  const lower = path.toLowerCase()
  if (SKIP_PREFIXES.some((p) => lower.startsWith(p))) return false
  // Base64 padding and plus signs, template literals (`/${t}`), escapes of either.
  if (/[=+$`{}<>\\]|%24|%7b|%3d|%2b/i.test(path)) return false
  const segments = path.split('/').filter(Boolean)
  const last = segments.at(-1) ?? ''
  if (FILE_EXTENSION.test(last)) return false
  if (segments.map(decodeSegment).some(tokenShaped)) return false
  // A single short segment (`/b`, `/x1`) is a minified-script fragment, not a page.
  if (segments.length === 1 && last.length < 3) return false
  return true
}

/** The path as stored: the redirect form (decoded, lower case, no trailing slash). */
export function brokenLinkPath(rawPath: string): string {
  return normaliseRedirectPath(rawPath).slice(0, BROKEN_LINK_PATH_MAX)
}

/** A referrer reduced to origin and path (no query, no fragment), or null when not a web URL. */
export function brokenLinkReferrer(referer: string | null | undefined): string | null {
  if (!referer) return null
  try {
    const url = new URL(referer)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return `${url.origin}${url.pathname}`.slice(0, 500)
  } catch {
    return null
  }
}

export type HandleOption = { kind: 'product' | 'collection'; handle: string }

export type RedirectSuggestion = { target: string; score: number }

/** Below this word overlap a suggestion is more likely wrong than helpful. */
export const SUGGESTION_MIN_SCORE = 0.5

function words(value: string): Set<string> {
  return new Set(value.split('-').filter(Boolean))
}

/** Word overlap (Jaccard) of two handles, plus a little for a shared start, capped at 1. */
export function handleSimilarity(a: string, b: string): number {
  if (!a || !b) return 0
  if (a === b) return 1
  const wa = words(a)
  const wb = words(b)
  let shared = 0
  for (const w of wa) if (wb.has(w)) shared++
  const union = wa.size + wb.size - shared
  const jaccard = union === 0 ? 0 : shared / union
  const sameStart = a.split('-')[0] === b.split('-')[0] ? 0.05 : 0
  return Math.min(1, jaccard + sameStart)
}

/**
 * The closest product or collection for a broken path: its last segment (ASCII-slugged, so an
 * old non-ASCII Shopify handle compares) against every handle. `/products/…` prefers products and
 * `/collections/…` collections; anything else compares with both. Null below the minimum score.
 */
export function suggestRedirect(path: string, options: HandleOption[]): RedirectSuggestion | null {
  const segments = path.split('/').filter(Boolean)
  const slug = slugify(segments.at(-1) ?? '')
  if (!slug) return null
  const wanted =
    segments[0] === 'products' ? 'product' : segments[0] === 'collections' ? 'collection' : null
  let best: RedirectSuggestion | null = null
  for (const option of options) {
    const kindBonus = wanted && option.kind !== wanted ? -0.1 : 0
    const score = handleSimilarity(slug, option.handle) + kindBonus
    if (score < SUGGESTION_MIN_SCORE || (best && score <= best.score)) continue
    best = {
      target: `/${option.kind === 'product' ? 'products' : 'collections'}/${option.handle}`,
      score,
    }
  }
  return best
}
