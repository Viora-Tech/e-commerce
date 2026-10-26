import type { CardProduct } from '@commerce/blocks'
import { parseUnavailable } from '@commerce/core/browse'
import { numericId } from '@commerce/core/theme-import'

/**
 * The shape of Shopify's Predictive Search answer (`/search/suggest.json`) built from our
 * results, and the Shopify params a theme's script sends. Pure; the search itself is
 * `predictive-search.ts`.
 */

/** What one predictive search found: product cards in rank order, matching collections. */
export type PredictiveResults = {
  terms: string
  products: CardProduct[]
  collections: PredictiveCollection[]
}

export type PredictiveCollection = {
  id: string
  handle: string
  title: string
  imageUrl: string | null
}

/** Shopify's per-type limit: 10 by default, at most 10. */
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10

/** The request's Shopify params: `q`, `resources[limit]`, `resources[type]`, `…[unavailable_products]`. */
export function predictiveParams(params: URLSearchParams) {
  const limit = Number.parseInt(params.get('resources[limit]') ?? '', 10)
  const types = (params.get('resources[type]') ?? 'product,collection')
    .split(',')
    .map((t) => t.trim())
  return {
    q: (params.get('q') ?? '').trim().slice(0, 100),
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT,
    products: types.includes('product'),
    collections: types.includes('collection'),
    queries: types.includes('query'),
    unavailable: parseUnavailable(params.get('resources[options][unavailable_products]')),
  }
}

export type PredictiveParams = ReturnType<typeof predictiveParams>

/** Paise as Shopify's suggest prices read: rupees with two decimals, "8999.00". */
const rupees = (paise: number) => (paise / 100).toFixed(2)

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

/** `/search/suggest.json`'s body: `resources.results` with Shopify's field names. */
export function predictiveJson(r: PredictiveResults, p: PredictiveParams) {
  const searchUrl = `/search?q=${encodeURIComponent(r.terms)}&options%5Bprefix%5D=last`
  return {
    resources: {
      results: {
        products: r.products.map((c) => {
          const image = c.images[0]
          const url = image
            ? (image.variants?.['640']?.webp ?? image.variants?.['320']?.webp ?? image.url)
            : null
          const compareAt = c.mrpPaise && c.mrpPaise > c.pricePaise ? rupees(c.mrpPaise) : '0.00'
          return {
            id: numericId(c.id),
            handle: c.handle,
            title: c.title,
            url: `/products/${encodeURIComponent(c.handle)}`,
            vendor: c.vendor ?? '',
            type: c.productType ?? '',
            // A pre-order still sells past zero stock.
            available: c.available > 0 || Boolean(c.preorder),
            price: rupees(c.pricePaise),
            price_min: rupees(c.pricePaise),
            price_max: rupees(c.pricePaise),
            compare_at_price_min: compareAt,
            compare_at_price_max: compareAt,
            image: url,
            featured_image: url ? { url, alt: image?.alt ?? c.title } : null,
          }
        }),
        collections: r.collections.map((c) => ({
          id: numericId(c.id),
          handle: c.handle,
          title: c.title,
          url: `/collections/${encodeURIComponent(c.handle)}`,
          featured_image: c.imageUrl ? { url: c.imageUrl, alt: c.title } : null,
        })),
        pages: [],
        articles: [],
        queries:
          p.queries && r.terms
            ? [
                {
                  text: r.terms,
                  styled_text: `<mark>${escapeHtml(r.terms)}</mark>`,
                  url: searchUrl,
                },
              ]
            : [],
      },
    },
  }
}
