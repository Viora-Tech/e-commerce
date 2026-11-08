import type { LiquidReviewsSource } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ratingSummaries } from './reviews'
import { reviewsState } from './store-settings'
import { type StoreReviewFeed, storeReviewFeed, storeReviewTotals } from './storefront'

/**
 * The Reviews app's data for an imported theme's Liquid (`storeLiquidData`'s `reviews`
 * option), or undefined when the store has not installed the app. With "star ratings on
 * product cards" off, products carry no rating metafields.
 */
export async function reviewsLiquidSource(
  tx: StoreTx,
  storeId: string,
): Promise<LiquidReviewsSource | undefined> {
  const { installed, settings } = await reviewsState(tx, storeId)
  if (!installed) return undefined
  return {
    ratings: async (productIds) =>
      settings.storefront.starsOnCards ? ratingSummaries(tx, productIds) : new Map(),
    judgeme: async () => {
      const [feed, totals] = await Promise.all([
        storeReviewFeed(tx, settings),
        storeReviewTotals(tx),
      ])
      return judgemeShop(judgemeShopData(feed, totals))
    },
  }
}

/** Judge.me's data as `shop.metafields.judgeme.<key>.value`, the way themes read it. */
function judgemeShop(data: JudgemeShopData): Record<string, unknown> {
  return {
    reviews_grid: { value: data.reviews_grid },
    all_reviews_rating: { value: data.all_reviews_rating },
    all_reviews_count: { value: data.all_reviews_count },
    'trust_badge.verified_reviews_count': { value: data.verified_reviews_count },
  }
}

/*
 * Our reviews in the shapes an imported Shopify theme reads (the theme-import Liquid
 * layer passes these through; core never imports the app):
 * - `product.metafields.reviews.rating` / `.rating_count`: Shopify's standard rating
 *   metafields, which review apps (Judge.me) keep up to date on each product.
 * - `shop.metafields.judgeme.*`: Judge.me's shop-wide copy of the latest reviews
 *   (`reviews_grid`) and its totals, which review walls and showcases read.
 */

export type JudgemeShopData = {
  reviews_grid: {
    average_rating: number
    number_of_reviews: number
    all_reviews: { reviews: JudgemeGridReview[]; media_only: { reviews: JudgemeGridReview[] } }
  }
  all_reviews_rating: number
  all_reviews_count: number
  verified_reviews_count: number
}

export type JudgemeGridReview = {
  id: string
  rating: number
  title: string
  body: string
  reviewer_name: string
  reviewer_initial: string
  verified_buyer: boolean
  product_title: string
  product_url: string
  product_handle: string
  created_at: string
  pictures_urls: { original: string; huge: string; small: string }[]
}

/** Judge.me's `reviews_grid` and totals, built from our published reviews. */
function judgemeShopData(
  feed: StoreReviewFeed,
  totals: { count: number; average: number; verified: number },
): JudgemeShopData {
  const reviews: JudgemeGridReview[] = feed.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    reviewer_name: r.name,
    reviewer_initial: r.name.trim().charAt(0).toUpperCase(),
    verified_buyer: r.verified,
    // A store review has no product: Judge.me leaves these blank and links the shop.
    product_title: r.productTitle ?? '',
    product_url: r.handle ? `/products/${r.handle}` : '/',
    product_handle: r.handle ?? '',
    created_at: r.createdAt.toISOString(),
    pictures_urls: r.pictures,
  }))
  return {
    reviews_grid: {
      average_rating: totals.average,
      number_of_reviews: totals.count,
      all_reviews: {
        reviews,
        media_only: { reviews: reviews.filter((r) => r.pictures_urls.length) },
      },
    },
    all_reviews_rating: totals.average,
    all_reviews_count: totals.count,
    verified_reviews_count: totals.verified,
  }
}
