import type { LiquidProductData, RecommendationIntent } from '@commerce/core'
import { numericId } from '@commerce/core/theme-import'

/**
 * The shape of Shopify's Product Recommendations answer (`/recommendations/products.json`)
 * built from our related products, and the params a theme's script sends. Pure; the
 * ranking itself is core's `relatedProducts` (theme-import `related.ts`).
 */

/** Shopify's limit: 10 by default, 1 to 10. */
const DEFAULT_LIMIT = 10
const MAX_LIMIT = 10

/** The request's Shopify params: `product_id`, `limit`, `intent`, `section_id`. */
export function recommendationsParams(params: URLSearchParams) {
  const limit = Number.parseInt(params.get('limit') ?? '', 10)
  return {
    productId: (params.get('product_id') ?? '').trim().slice(0, 64),
    limit: Number.isFinite(limit) && limit > 0 ? Math.min(limit, MAX_LIMIT) : DEFAULT_LIMIT,
    // Shopify's two intents; anything else is the default, related.
    intent: (params.get('intent') === 'complementary'
      ? 'complementary'
      : 'related') as RecommendationIntent,
    sectionId: (params.get('section_id') ?? '').trim(),
  }
}

export type RecommendationsParams = ReturnType<typeof recommendationsParams>

/** A section id a theme may send: Shopify's `template--123__related-products` or a plain type. */
export const validSectionId = (id: string) => /^[a-z0-9_-]{1,120}$/i.test(id)

/**
 * One product as Shopify's `products.json` / `product.js` writes it, ids as the whole numbers
 * the theme saw in `product.id`. Prices are whole paise, Shopify's subunit (its `price: 89900`
 * is ₹899.00), which is what a theme's `Shopify.formatMoney` expects from this endpoint, unlike
 * the decimal strings of `/search/suggest.json`.
 */
export function shopifyProductJson(p: LiquidProductData) {
  const prices = p.variants.map((v) => v.price)
  const compares = p.variants.map((v) => v.compareAtPrice ?? 0)
  const min = (xs: number[]) => (xs.length ? Math.min(...xs) : 0)
  const max = (xs: number[]) => (xs.length ? Math.max(...xs) : 0)
  const first = p.variants.find((v) => v.available) ?? p.variants[0]
  const featured = p.images[0] ?? null
  const url = `/products/${encodeURIComponent(p.handle)}`
  const image = (i: LiquidProductData['images'][number] | null, position = 1) =>
    i
      ? {
          id: i.id ? numericId(i.id) : null,
          src: i.url,
          alt: i.alt ?? p.title,
          width: i.width ?? null,
          height: i.height ?? null,
          position,
        }
      : null
  return {
    id: numericId(p.id),
    title: p.title,
    handle: p.handle,
    description: p.descriptionHtml,
    published_at: p.createdAt.toISOString(),
    created_at: p.createdAt.toISOString(),
    vendor: p.vendor,
    type: p.type,
    tags: p.tags,
    price: first?.price ?? min(prices),
    price_min: min(prices),
    price_max: max(prices),
    // A pre-order still sells past zero stock (`available` on the variant already says so).
    available: p.variants.some((v) => v.available),
    price_varies: min(prices) !== max(prices),
    compare_at_price: first?.compareAtPrice ?? null,
    compare_at_price_min: min(compares),
    compare_at_price_max: max(compares),
    compare_at_price_varies: min(compares) !== max(compares),
    variants: p.variants.map((v) => ({
      id: numericId(v.id),
      title: v.title,
      option1: v.options[0] ?? null,
      option2: v.options[1] ?? null,
      option3: v.options[2] ?? null,
      sku: v.sku ?? '',
      requires_shipping: true,
      taxable: true,
      featured_image: image(v.image),
      available: v.available,
      name: v.title === 'Default Title' ? p.title : `${p.title} - ${v.title}`,
      public_title: v.title === 'Default Title' ? null : v.title,
      options: v.options,
      price: v.price,
      weight: v.weightGrams ?? 0,
      compare_at_price: v.compareAtPrice,
      inventory_management: 'shopify',
      barcode: v.barcode ?? '',
    })),
    images: p.images.map((i) => i.url),
    featured_image: featured?.url ?? null,
    options: p.options.map((o, i) => ({ name: o.name, position: i + 1, values: o.values })),
    url,
    media: p.images.map((i, n) => ({
      ...image(i, n + 1),
      media_type: 'image',
      preview_image: { src: i.url, width: i.width ?? null, height: i.height ?? null },
    })),
  }
}

/** `/recommendations/products.json`'s body: the intent and the products in rank order. */
export function recommendationsJson(products: LiquidProductData[], intent: RecommendationIntent) {
  return { intent, products: products.map(shopifyProductJson) }
}
