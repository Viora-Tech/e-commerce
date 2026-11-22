/**
 * SOURCE OF TRUTH KEYWORDS: slugify, handle, URL slug
 * WHAT:  Title → URL handle for products, collections, pages, menus, blogs, metaobjects.
 * WHY:   One rule for every handle so admin placeholders match what the server saves.
 * WHERE: Core services; admin dialogs via `@commerce/core/catalog` (client-safe).
 */
/** "Talongames 幻 Maboroshi" → "talongames-maboroshi". ASCII only so the URL is typeable. */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

/** `decodeURIComponent` that leaves a malformed escape (`%E5%B9`) as it came. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

/**
 * The handles a storefront `/products/<handle>` (or collection) lookup tries, best first. The
 * path segment may arrive percent-encoded UTF-8 (`talongames-%E5%B9%BB-maboroshi`, a Shopify
 * handle with a CJK character); we store ASCII handles (`slugify`), so after the decoded form
 * and its lower case comes the ASCII slug (non-ASCII dropped, dashes collapsed). Old Shopify
 * links keep working without a redirect per product.
 */
export function handleCandidates(raw: string): string[] {
  const decoded = safeDecode(raw).trim()
  const out = [decoded, decoded.toLowerCase(), slugify(decoded)]
  return [...new Set(out.filter((h) => h.length > 0))]
}

/** The row whose handle comes earliest in `tries` (an exact match beats the ASCII fallback). */
export function bestByHandle<T>(
  rows: T[],
  tries: string[],
  handleOf: (row: T) => string,
): T | null {
  let best: T | null = null
  let rank = Number.POSITIVE_INFINITY
  for (const row of rows) {
    const at = tries.indexOf(handleOf(row))
    if (at >= 0 && at < rank) {
      best = row
      rank = at
    }
  }
  return best
}
