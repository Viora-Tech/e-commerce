import { product, type StoreTx } from '@commerce/db'
import { and, asc, desc, eq, type SQL, sql } from 'drizzle-orm'
import {
  emptySummary,
  photoCopy,
  photosFor,
  type RatingSummary,
  type ReviewPhoto,
  ratingSummaries,
} from './reviews'

import { review } from './schema'
import type { ReviewSort, ReviewsSettings } from './settings'

/** Copy widths for Judge.me's `small` (a card) and `huge` (a photo opened large). */
const SMALL_PHOTO_WIDTH = 640
const HUGE_PHOTO_WIDTH = 1280

/** Published reviews one product page loads; chips and "show more" work on these. */
const PRODUCT_PAGE_REVIEWS = 100

export type PublicReview = {
  id: string
  rating: number
  title: string
  body: string
  name: string
  verified: boolean
  helpful: number
  reply: string | null
  /** ISO date the review was written. */
  createdAt: string
  photos: { url: string; width: number | null; height: number | null }[]
}

const ORDER: Record<ReviewSort, SQL[]> = {
  helpful: [desc(review.helpfulCount), desc(review.createdAt)],
  newest: [desc(review.createdAt)],
  highest: [desc(review.rating), desc(review.createdAt)],
  lowest: [asc(review.rating), desc(review.createdAt)],
}

async function publicReviews(
  tx: StoreTx,
  where: SQL | undefined,
  sort: ReviewSort,
  limit: number,
  showPhotos: boolean,
): Promise<(PublicReview & { productId: string | null })[]> {
  const rows = await tx
    .select({
      id: review.id,
      productId: review.productId,
      rating: review.rating,
      title: review.title,
      body: review.body,
      name: review.reviewerName,
      verified: review.verifiedBuyer,
      helpful: review.helpfulCount,
      reply: review.reply,
      createdAt: review.createdAt,
    })
    .from(review)
    .where(where)
    .orderBy(...ORDER[sort])
    .limit(limit)
  const photos = showPhotos
    ? await photosFor(
        tx,
        rows.map((r) => r.id),
      )
    : new Map()
  return rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    photos: (photos.get(r.id) ?? []).map((p: PublicReview['photos'][number]) => ({
      url: p.url,
      width: p.width,
      height: p.height,
    })),
  }))
}

/** What a product page's reviews section draws: the summary and the published reviews. */
export async function productReviewsFor(
  tx: StoreTx,
  productId: string,
  settings: ReviewsSettings,
): Promise<{ summary: RatingSummary; reviews: PublicReview[] }> {
  const summary = (await ratingSummaries(tx, [productId])).get(productId) ?? emptySummary()
  if (summary.count === 0) return { summary, reviews: [] }
  const reviews = await publicReviews(
    tx,
    and(eq(review.productId, productId), eq(review.status, 'published')),
    settings.storefront.sort,
    PRODUCT_PAGE_REVIEWS,
    settings.storefront.showPhotos,
  )
  return { summary, reviews: reviews.map(({ productId: _p, ...r }) => r) }
}

/** The store-wide average and counts of published reviews (themes' review showcases). */
export async function storeReviewTotals(tx: StoreTx) {
  const [t] = await tx
    .select({
      count: sql<number>`count(*)::int`,
      average: sql<number | null>`avg(${review.rating})::float`,
      verified: sql<number>`count(*) filter (where ${review.verifiedBuyer})::int`,
    })
    .from(review)
    .where(eq(review.status, 'published'))
  const count = t?.count ?? 0
  return {
    count,
    average: count > 0 && t?.average ? Math.round(t.average * 10) / 10 : 0,
    verified: t?.verified ?? 0,
  }
}

/**
 * The newest published reviews across the store, the ones the merchant featured first,
 * each with its product (null title and handle on a store review): what a theme's review
 * wall (Judge.me's `reviews_grid`) lists.
 */
export async function storeReviewFeed(tx: StoreTx, settings: ReviewsSettings, limit = 25) {
  const rows = await tx
    .select({
      id: review.id,
      rating: review.rating,
      title: review.title,
      body: review.body,
      name: review.reviewerName,
      verified: review.verifiedBuyer,
      createdAt: review.createdAt,
      productTitle: product.title,
      handle: product.handle,
    })
    .from(review)
    .leftJoin(product, eq(product.id, review.productId))
    .where(eq(review.status, 'published'))
    .orderBy(desc(review.featured), desc(review.createdAt))
    .limit(limit)
  const photos = settings.storefront.showPhotos
    ? await photosFor(
        tx,
        rows.map((r) => r.id),
      )
    : new Map<string, ReviewPhoto[]>()
  return rows.map((r) => {
    const own = photos.get(r.id) ?? []
    return {
      ...r,
      photos: own.map((p) => p.url),
      /** Judge.me's `pictures_urls` sizes: the theme draws `small` on cards, `huge` opened. */
      pictures: own.map((p) => ({
        original: p.url,
        huge: photoCopy(p, HUGE_PHOTO_WIDTH),
        small: photoCopy(p, SMALL_PHOTO_WIDTH),
      })),
    }
  })
}

export type StoreReviewFeed = Awaited<ReturnType<typeof storeReviewFeed>>
