/** SOURCE OF TRUTH: the SEO report's link checks — WHAT: finds the links inside stored rich text, decides which point into this store (relative paths, the store's own domains) or at the old Shopify store (*.myshopify.com), and whether a product, collection or page path still exists (or redirects) / WHY: broken internal links and links to a closed Shopify store are the commonest leftovers of a migration; pure, so the report and its tests share it */

/** Paths under these prefixes name one product, collection or page and can go missing. */
const CHECKED_PREFIXES = ['/products/', '/collections/', '/pages/'] as const

/** Built-in store pages that exist without a record of their own. */
const BUILT_IN = new Set(['/collections/all', '/collections/vendors', '/collections/types'])

/** Every link URL inside stored rich text (Lexical `link` and `autolink` nodes). */
export function seoBodyLinks(value: unknown): string[] {
  const out: string[] = []
  const visit = (node: unknown) => {
    if (!node || typeof node !== 'object') return
    const n = node as { type?: unknown; url?: unknown; children?: unknown; root?: unknown }
    if ((n.type === 'link' || n.type === 'autolink') && typeof n.url === 'string') out.push(n.url)
    if (n.root) visit(n.root)
    if (Array.isArray(n.children)) for (const child of n.children) visit(child)
  }
  visit(value)
  return out
}

/**
 * A store path in one canonical form: no query, hash or trailing slash, lower case, and a
 * product reached through a collection (`/collections/x/products/y`) as `/products/y`.
 */
export function normalizeStorePath(path: string): string {
  const bare = (path.split(/[?#]/)[0] ?? '').toLowerCase().replace(/\/+$/, '') || '/'
  const nested = /^\/collections\/[^/]+(\/products\/[^/]+)$/.exec(bare)
  return nested?.[1] ?? bare
}

export type LinkTarget =
  | { kind: 'internal'; path: string }
  | { kind: 'old_store'; url: string }
  | { kind: 'other' }

/** Where a link goes: into this store, to the old Shopify store, or somewhere else. */
export function linkTarget(url: string, storeHosts: ReadonlySet<string>): LinkTarget {
  const raw = url.trim()
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    return { kind: 'internal', path: normalizeStorePath(raw) }
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { kind: 'other' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { kind: 'other' }
  const host = parsed.hostname.toLowerCase().replace(/^www\./, '')
  if (host.endsWith('.myshopify.com'))
    return { kind: 'old_store', url: `${host}${parsed.pathname}` }
  if (storeHosts.has(host)) return { kind: 'internal', path: normalizeStorePath(parsed.pathname) }
  return { kind: 'other' }
}

/**
 * False only for a product, collection or page path that neither exists nor redirects.
 * Everything else (home, search, blogs, policies, cart) is not checked.
 */
export function pathExists(path: string, known: ReadonlySet<string>): boolean {
  if (!CHECKED_PREFIXES.some((p) => path.startsWith(p))) return true
  return BUILT_IN.has(path) || known.has(path)
}
