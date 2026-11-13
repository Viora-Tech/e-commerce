import { seoSnippet } from '@commerce/core/catalog'
import { depositIsNonRefundable, parsePreorderStoreSettings } from '@commerce/core/preorder'
import { market, store } from '@commerce/db'
import { reviewsState, storeWidgetReviews } from '@commerce/plugin-reviews/server'
import { parseRichText, richTextToPlainText } from '@commerce/richtext'
import { eq } from 'drizzle-orm'
import { getProductByHandle, getProductSeo, type ProductDetail } from '@/lib/catalog'
import { metaDescription } from '@/lib/seo'
import { storeRead } from '@/lib/store-cache'

/**
 * The store reads of the Hono product page (`./product-page.ts`): the same rows the Next product
 * route and store layout read, under the same render cache keys where they share one, so the two
 * pages cannot drift. All inside `storeRead` (one store, its RLS scope).
 */

function withDepositPolicy(
  product: ProductDetail,
  policy: ReturnType<typeof parsePreorderStoreSettings>,
): ProductDetail {
  if (!product.preorder?.depositPreview || !depositIsNonRefundable(policy)) return product
  return {
    ...product,
    preorder: { ...product.preorder, nonRefundableDepositDays: policy.payWithinDays },
  }
}

/** The same store read, under the same cache key, as the Next route's `loadProduct`. */
export function loadProduct(storeId: string, handle: string) {
  return storeRead(storeId, `product-page|${handle}`, async (tx) => {
    const [s] = await tx
      .select({ name: store.name, currency: store.currency, preorder: store.preorder })
      .from(store)
      .where(eq(store.id, storeId))
    const policy = parsePreorderStoreSettings(s?.preorder)
    const found = await getProductByHandle(tx, handle, policy.note)
    if (!found) return null
    const seo = await getProductSeo(tx, found.id)
    const product = withDepositPolicy(found, policy)
    const text = richTextToPlainText(parseRichText(product.description))
    return {
      product,
      title: seo?.seoTitle || product.title,
      description: metaDescription(seo?.seoDescription || seoSnippet(text)),
      storeName: s?.name ?? '',
      currency: s?.currency ?? 'INR',
    }
  })
}

/** The store row the page's head, island script and price format read. */
export function storeRow(storeId: string) {
  return storeRead(storeId, 'hono-store', async (tx) => {
    const [s] = await tx
      .select({
        name: store.name,
        preferences: store.preferences,
        apps: store.apps,
        moneyFormat: store.moneyFormat,
      })
      .from(store)
      .where(eq(store.id, storeId))
    return s ?? null
  })
}

/** How many markets shoppers can be in, as the store layout counts them (same cache entry). */
export function liveMarketCount(storeId: string) {
  return storeRead(storeId, 'live-market-count', async (tx) => {
    const rows = await tx.select({ id: market.id }).from(market).where(eq(market.enabled, true))
    return rows.length
  })
}

/** As many reviews as the Next layout's carousel shows (`LiquidReviewsCarousel`). */
const CAROUSEL_REVIEWS = 12

/** The Reviews app's carousel, under the same cache key as the Next layout's. */
export function reviewsCarousel(storeId: string) {
  return storeRead(storeId, 'imported-reviews-carousel', async (tx) => {
    const state = await reviewsState(tx, storeId)
    return state.installed
      ? storeWidgetReviews(tx, state.settings, { limit: CAROUSEL_REVIEWS })
      : null
  })
}
