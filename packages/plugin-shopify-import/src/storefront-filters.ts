/**
 * The metafields a Shopify store filters its collections by. Search & Discovery keeps its filter
 * list out of the Admin API, but every Online Store theme writes the filters into its collection
 * page as `filter.p.m.<namespace>.<key>` inputs, so the store's own `/collections/all` names
 * them. The import marks those fields "Use as filter" here. A store behind a password, or a
 * theme that draws no filters, gives none, and the merchant ticks them in Custom data.
 */
import type { ShopifyClient } from './shopify-client'

/** How long the storefront may take to answer before the import goes on without it. */
const STOREFRONT_TIMEOUT_MS = 15_000

/** `namespace.key` of every metafield filter a page's HTML names, as Shopify writes them. */
export function filterKeysFromHtml(html: string): Set<string> {
  const keys = new Set<string>()
  for (const m of html.matchAll(/filter\.p\.m\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/g)) {
    keys.add(`${m[1]}.${m[2]}`)
  }
  return keys
}

/** The metafield filters `/collections/all` shows; empty when the page cannot be read. */
export async function storefrontFilterKeys(client: ShopifyClient): Promise<Set<string>> {
  try {
    const res = await client.fetchImpl(`https://${client.shopDomain}/collections/all`, {
      redirect: 'follow',
      signal: AbortSignal.timeout(STOREFRONT_TIMEOUT_MS),
      headers: { accept: 'text/html' },
    })
    if (!res.ok) return new Set()
    return filterKeysFromHtml(await res.text())
  } catch {
    return new Set()
  }
}
