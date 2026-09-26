/**
 * The link picker's model: which storefront path each kind of target lives
 * at, and the reverse (reading a stored href back into "a product called X").
 * Pure, so the storefront paths are pinned by tests — the storefront routes
 * are `apps/storefront/src/app/-s/[storeId]/{products,collections,pages,blogs}`.
 */

export type LinkKind = 'product' | 'collection' | 'page' | 'article'

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

export const LINK_KINDS: readonly LinkKind[] = ['product', 'collection', 'page', 'article']

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
    if (m?.[1]) return { kind, handle: safeDecode(m[1]) }
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
