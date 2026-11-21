/**
 * Shopify's public JSON paths that do not map onto a route folder by themselves: a product's
 * `/products/<h>.json` and `.js` (and our `.md` copy for AI agents) and a collection's `/collections/<h>.json` share their page's
 * dynamic segment, so the proxy rewrites them to a child route (`product.json`, `product.js`, `product.md`,
 * `collection.json`). `/products.json`, `/collections.json` and `/collections/<h>/products.json`
 * are route folders already. Shopify's child sitemaps are rewritten onto `sitemap.xml/[part]`. Pure.
 */

import { SHOPIFY_SITEMAPS } from '@/data/seo'

const PRODUCT_FILE = /^\/products\/([^/]+)\.(json|js|md)$/
const COLLECTION_FILE = /^\/collections\/([^/]+)\.json$/

/** The store-relative path to render for a Shopify JSON path, or null for any other path. */
export function shopifyJsonPath(pathname: string): string | null {
  const product = PRODUCT_FILE.exec(pathname)
  if (product) return `/products/${product[1]}/product.${product[2]}`
  const collection = COLLECTION_FILE.exec(pathname)
  if (collection) return `/collections/${collection[1]}/collection.json`
  // Shopify's child sitemaps (`/sitemap_products_1.xml`): that part of our sitemap.
  const part = SHOPIFY_SITEMAPS[pathname as keyof typeof SHOPIFY_SITEMAPS]
  if (part) return `/sitemap.xml/${part}`
  return null
}

/** True for any of Shopify's public JSON paths (never a page: no plain HTML, Hono or CDN page rules). */
export function isShopifyJsonPath(pathname: string): boolean {
  return (
    pathname === '/products.json' ||
    pathname === '/collections.json' ||
    /^\/collections\/[^/]+\/products\.json$/.test(pathname) ||
    PRODUCT_FILE.test(pathname) ||
    COLLECTION_FILE.test(pathname)
  )
}

/** A handle from the URL, decoded; null when it is not valid percent-encoding. */
export function decodedHandle(raw: string): string | null {
  try {
    const handle = decodeURIComponent(raw)
    return handle.length > 0 && handle.length <= 255 ? handle : null
  } catch {
    return null
  }
}
