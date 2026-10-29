/**
 * The metafields a Shopify store filters its collections by. Search & Discovery keeps its filter
 * list out of the Admin API, but every Online Store theme writes the filters into its collection
 * page as `filter.p.m.<namespace>.<key>` inputs, so the store's own `/collections/all` names
 * them. It is read on the store's primary domain: a store with its own domain answers 402 on
 * its `*.myshopify.com` address. The import marks those fields "Use as filter" here. A store behind a password, or a
 * theme that draws no filters, gives none, and the merchant ticks them in Custom data.
 */
import type { ShopifyClient } from './shopify-client'

/** How long the storefront may take to answer before the import goes on without it. */
export const STOREFRONT_TIMEOUT_MS = 15_000

/** `namespace.key` of every metafield filter a page's HTML names, as Shopify writes them. */
export function filterKeysFromHtml(html: string): Set<string> {
  const keys = new Set<string>()
  for (const m of html.matchAll(/filter\.p\.m\.([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)/g)) {
    keys.add(`${m[1]}.${m[2]}`)
  }
  return keys
}

/** `https://<host>` of the store's primary domain (its own domain once connected), else null. */
export async function primaryOrigin(client: ShopifyClient): Promise<string | null> {
  try {
    const data = await client.query<{ shop: { primaryDomain: { url: string } | null } }>(
      `{ shop { primaryDomain { url } } }`,
      {},
      1,
    )
    const url = data.shop.primaryDomain?.url
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}

/** The metafield filters `/collections/all` shows; empty when the page cannot be read. */
export async function storefrontFilterKeys(client: ShopifyClient): Promise<Set<string>> {
  const fallback = `https://${client.shopDomain}`
  const primary = await primaryOrigin(client)
  const origins = primary && primary !== fallback ? [primary, fallback] : [fallback]
  for (const origin of origins) {
    try {
      const res = await client.fetchImpl(`${origin}/collections/all`, {
        redirect: 'follow',
        signal: AbortSignal.timeout(STOREFRONT_TIMEOUT_MS),
        headers: { accept: 'text/html' },
      })
      if (!res.ok) continue
      const keys = filterKeysFromHtml(await res.text())
      if (keys.size > 0) return keys
    } catch {
      // Try the next address; none answering means no filters to mark.
    }
  }
  return new Set()
}
