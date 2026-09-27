/**
 * The link picker's model: which storefront path each kind of target lives
 * at, and the reverse (reading a stored href back into "a product called X").
 * Pure, so the storefront paths are pinned by tests — the storefront routes
 * are `apps/storefront/src/app/-s/[storeId]/{products,collections,pages,blogs}`.
 *
 * What a link field stores (documented in developer-docs/building/section-settings.mdx):
 *
 * - a bare link text field (`href`, or a field labelled "Link") stores the
 *   href string itself: `/products/glass-pad`, `/collections/all`,
 *   `/pages/about`, `/pages/refund-policy`, `/blogs/news/launch-day`, `/`,
 *   or a pasted `https://…` address;
 * - a `{ label, href }` link object keeps that same string in `href` and may
 *   add `newTab: true` (the "Open in a new tab" switch). Nothing else.
 *
 * Policies have no route of their own: they are ordinary pages whose handle
 * reads as a policy (`refund-policy`, `terms-of-service` …), so they are
 * stored as `/pages/<handle>` and only listed under their own heading.
 */

export type LinkKind = 'product' | 'collection' | 'page' | 'article' | 'policy'

/** One thing a link can point at, as the picker lists it. */
export type LinkTarget = {
  kind: LinkKind
  id: string
  title: string
  /** The storefront path this target lives at. */
  href: string
  imageUrl?: string | null | undefined
}

/** What a stored href turned out to be. */
export type ParsedHref =
  | { kind: 'empty' }
  | { kind: 'home' }
  | { kind: LinkKind; handle: string; blog?: string | undefined }
  | { kind: 'url'; url: string }

export const LINK_KINDS: readonly LinkKind[] = [
  'product',
  'collection',
  'page',
  'article',
  'policy',
]

/** Page handles that read as a store policy (Shopify's refund, privacy, shipping and terms pages). */
export function isPolicyHandle(handle: string): boolean {
  return /(^|-)(polic(y|ies)|terms|refund|returns?|privacy|cancellation)(-|$)/.test(
    handle.toLowerCase(),
  )
}

const enc = encodeURIComponent

export function productHref(handle: string): string {
  return `/products/${enc(handle)}`
}

export function collectionHref(handle: string): string {
  return `/collections/${enc(handle)}`
}

/** The page with the `home` handle is the home page, served at `/`. */
export function pageHref(handle: string): string {
  return handle === 'home' ? '/' : `/pages/${enc(handle)}`
}

export function articleHref(blogHandle: string, handle: string): string {
  return `/blogs/${enc(blogHandle)}/${enc(handle)}`
}

const PATTERNS: { kind: LinkKind; re: RegExp }[] = [
  { kind: 'product', re: /^\/products\/([^/?#]+)\/?$/ },
  { kind: 'collection', re: /^\/collections\/([^/?#]+)\/?$/ },
  { kind: 'page', re: /^\/pages\/([^/?#]+)\/?$/ },
]

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

/** Reads a stored href back into what it points at, so the picker can show its title. */
export function parseHref(href: string | null | undefined): ParsedHref {
  const value = (href ?? '').trim()
  if (!value) return { kind: 'empty' }
  if (value === '/') return { kind: 'home' }
  for (const { kind, re } of PATTERNS) {
    const m = value.match(re)
    if (!m?.[1]) continue
    const handle = safeDecode(m[1])
    return { kind: kind === 'page' && isPolicyHandle(handle) ? 'policy' : kind, handle }
  }
  const article = value.match(/^\/blogs\/([^/?#]+)\/([^/?#]+)\/?$/)
  if (article?.[1] && article[2]) {
    return { kind: 'article', blog: safeDecode(article[1]), handle: safeDecode(article[2]) }
  }
  return { kind: 'url', url: value }
}

/**
 * Turns what a merchant pasted into something safe to store as a link:
 * a site path stays as is, a bare domain gets `https://`, and anything that
 * isn't http(s), mailto or tel (a `javascript:` URL, say) is refused.
 */
export function normalisePastedUrl(input: string): string | null {
  const value = input.trim()
  if (!value) return null
  if (value.startsWith('/') && !value.startsWith('//')) return value
  if (value.startsWith('#')) return value
  if (/^(mailto|tel):/i.test(value)) return value
  const withScheme = value.startsWith('//')
    ? `https:${value}`
    : /^[a-z][a-z0-9+.-]*:/i.test(value)
      ? value
      : `https://${value}`
  try {
    const url = new URL(withScheme)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    if (!url.hostname.includes('.') && url.hostname !== 'localhost') return null
    return url.toString()
  } catch {
    return null
  }
}

/**
 * Which plain text fields are links: any field named `href`, or labelled
 * "Link" (the label every `{ label, href }` link object and logo row uses).
 * Media URLs ("Image URL", "Video link") are deliberately not matched.
 */
export function isLinkTextField(
  field: { type: string; label?: string | undefined },
  name = '',
): boolean {
  if (field.type !== 'text') return false
  const last = name.split('.').pop() ?? ''
  return last === 'href' || field.label?.trim().toLowerCase() === 'link'
}

/** A link the merchant picked recently, as the picker's "Recent" list keeps it. */
export type RecentLink = { href: string; title: string; kind: LinkKind | 'home' | 'url' }

export const RECENT_LINKS_MAX = 5

/** The recent list after a pick: newest first, one entry per href, capped. */
export function pushRecentLink(
  list: readonly RecentLink[],
  pick: RecentLink,
  max = RECENT_LINKS_MAX,
): RecentLink[] {
  if (!pick.href) return [...list]
  return [pick, ...list.filter((r) => r.href !== pick.href)].slice(0, max)
}

/** Reads a stored recent list defensively (it comes from localStorage). */
export function parseRecentLinks(raw: string | null): RecentLink[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (r): r is RecentLink =>
          typeof r === 'object' &&
          r !== null &&
          typeof (r as RecentLink).href === 'string' &&
          typeof (r as RecentLink).title === 'string' &&
          typeof (r as RecentLink).kind === 'string',
      )
      .slice(0, RECENT_LINKS_MAX)
  } catch {
    return []
  }
}

/** The kind a stored href shows as (its chip icon and type label). */
export function linkKindOf(href: string | null | undefined): LinkKind | 'home' | 'url' | null {
  const parsed = parseHref(href)
  return parsed.kind === 'empty' ? null : parsed.kind
}
