import 'server-only'
import type { ThemeBundle } from '@commerce/core'
import { headers } from 'next/headers'
import { cache } from 'react'
import { NONCE_HEADER } from './csp'
import { currentCustomer } from './customer-session'
import { liquidExperimentsFor } from './experiments'
import { type LiquidRenderScope, liquidRequestPath, withNonce } from './liquid-cache'
import { liquidMarketFor } from './liquid-market'
import { withMarketPrefix } from './liquid-market-links'
import { requestCatalogId } from './market-catalog'
import { marketPricingFor, pricingKey } from './market-pricing'
import { MARKET_HEADERS } from './markets'
import { MISSING_ROUTE_HEADER } from './routing'
import { requestOrigin } from './seo'
import { readPreview } from './storefront-gate'

/**
 * What one request renders an imported theme's Liquid for (`liquid-theme.ts`): its template,
 * path, listing, market and preview, read once per request from the headers the proxy set, and
 * the cache scope a render is keyed by. Split from liquid-theme.ts.
 */

/** Shopify's `template.name` for a storefront path. */
export function liquidTemplateFor(path: string): string {
  if (path === '/' || path === '') return 'index'
  if (path.startsWith('/products/')) return 'product'
  if (path === '/collections' || path === '/collections/') return 'list-collections'
  if (path.startsWith('/collections/')) return 'collection'
  if (path.startsWith('/pages/')) return 'page'
  if (/^\/blogs\/[^/]+\/[^/]+/.test(path)) return 'article'
  if (path.startsWith('/blogs/')) return 'blog'
  if (path.startsWith('/cart')) return 'cart'
  if (path.startsWith('/search')) return 'search'
  if (path.startsWith('/account')) return 'customers/account'
  return '404'
}

/** What this request renders Liquid for: from the headers the proxy set, once per request. */
export const requestScope = cache(async (storeId: string) => {
  const h = await headers()
  // A path no route serves renders as one page, so its 404 is drawn once per theme version.
  const path = liquidRequestPath(h.get('x-pathname') ?? '/', h.get(MISSING_ROUTE_HEADER) === '1')
  const template = liquidTemplateFor(path)
  // Filters, sort and page shape a collection or search page's listing (`listingSearch`).
  const listing =
    template === 'collection' || template === 'search' ? (h.get('x-listing') ?? '') : ''
  const preview = readPreview(storeId, h.get('x-theme-preview')) !== null
  return {
    origin: await requestOrigin(),
    market: liquidMarketFor(h),
    // The market's currency, rate and rounding when it shows another currency than rupees.
    pricing: await marketPricingFor(storeId, h.get(MARKET_HEADERS.id)),
    // Markets › Catalogs: the market lists only its catalog's products (null: every product).
    catalogId: await requestCatalogId(storeId),
    path,
    listing,
    template,
    postedForm: h.get('x-form-posted'),
    nonce: h.get(NONCE_HEADER) ?? '',
    preview,
    ...(await liquidExperimentsFor(storeId, preview)),
  }
})

export type RequestScope = Awaited<ReturnType<typeof requestScope>>

/** Rendered theme HTML for this request: its nonce, and its links under the market prefix. */
export const finish = (html: string, scope: RequestScope) =>
  withMarketPrefix(withNonce(html, scope.nonce), scope.market.market?.prefix ?? '')

/**
 * The scope of a section rendered for another page (`theme-actions/section?path=`): that page's
 * template and, on a collection or search page, the filters, sort and page the request carried.
 */
export async function scopeAt(scope: RequestScope, path: string): Promise<RequestScope> {
  const template = liquidTemplateFor(path)
  const listing =
    template === 'collection' || template === 'search'
      ? ((await headers()).get('x-listing') ?? '')
      : ''
  return { ...scope, path, template, listing }
}

/** True when nobody is signed in; needs no query without a session cookie. */
export async function signedOut(storeId: string): Promise<boolean> {
  return (await currentCustomer(storeId)) === null
}

/** What a market changes about the data: its prices and its catalog's products. */
export function marketKey(scope: RequestScope): string {
  return [pricingKey(scope.pricing), scope.catalogId ? `catalog:${scope.catalogId}` : '']
    .filter(Boolean)
    .join('|')
}

/** `listingSearch` params as the Liquid listing reads them: one key, its values. */
export function listingQuery(search: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [k, v] of new URLSearchParams(search)) {
    const list = out[k] ?? []
    list.push(v)
    out[k] = list
  }
  return out
}

/** What the cache keys a render by, or null when nothing may be cached (a theme preview). */
export function cacheScope(
  scope: RequestScope,
  themeId: string,
  bundle: ThemeBundle,
): LiquidRenderScope | null {
  if (scope.preview) return null
  return {
    themeId,
    themeVersion: bundle.version,
    origin: scope.origin,
    // A filtered listing is its own page.
    path: scope.listing ? `${scope.path}?${scope.listing}` : scope.path,
    template: scope.template,
    postedForm: scope.postedForm,
    experiments: scope.experimentsKey,
    // Subfolder markets share the origin: their prices are their own pages.
    market: [scope.market.key, marketKey(scope)].filter(Boolean).join('|'),
  }
}
