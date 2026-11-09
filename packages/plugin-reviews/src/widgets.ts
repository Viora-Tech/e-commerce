/**
 * SOURCE OF TRUTH: the Reviews app's theme sections' data — WHAT: the store's published reviews
 * for the carousel, testimonials, all-reviews, photo grid and floating tab sections, with the
 * rating summary they show / WHY: one query behind every widget, so the storefront and the
 * theme editor's canvas draw the same reviews.
 */
import { media, product, type StoreTx } from '@commerce/db'
import { and, desc, eq, gte, inArray, type SQL, sql } from 'drizzle-orm'
import { emptySummary, photoCopy, photosFor, type RatingSummary, type ReviewPhoto } from './reviews'

import { review, reviewMedia } from './schema'
import { displayName, type ReviewsSettings } from './settings'

/** Review photos in the widgets show at most this wide (a card, or opened in the dialog). */
const WIDGET_PHOTO_WIDTH = 1280

/** The most reviews one widget loads (the all-reviews section pages through these). */
export const WIDGET_REVIEWS_MAX = 200
/** The most products a widget can be limited to. */
export const WIDGET_PRODUCTS_MAX = 50

export type WidgetReviewsQuery = {
  limit: number
  /** Only reviews with at least this many stars. */
  minRating?: number | undefined
  /** Only reviews with a photo the store shows. */
  withPhotos?: boolean | undefined
  /** Only reviews of these products; empty or missing is the whole store. */
  productHandles?: string[] | undefined
}

export type WidgetReview = {
  id: string
  rating: number
  title: string
  body: string
  /** First name and last initial, whatever the review was saved with (imports keep full names). */
  name: string
  verified: boolean
  /** ISO date the review was written. */
  createdAt: string
  /** The product reviewed; null on a store review or a product that is not on sale. */
  product: { title: string; handle: string } | null
  /** Photo URLs, empty when the store hides customer photos. */
  photos: string[]
}

export type WidgetReviews = { summary: RatingSummary; reviews: WidgetReview[] }

/* The outer column is named in full (`"review"."id"`): drizzle prints a column bare in a
   one-table select, and a bare `id` inside the subquery would bind to its own table. */
const shownPhotoSql = sql<boolean>`exists (select 1 from ${reviewMedia} rm join ${media} m
  on m.id = rm.media_id where rm.review_id = "review"."id" and m.status = 'ready')`

/** The query as the widgets may ask it: limits in range, handles trimmed and de-duplicated. */
export function widgetQuery(query: WidgetReviewsQuery): {
  limit: number
  minRating: number
  withPhotos: boolean
  productHandles: string[]
} {
  const limit = Number.isFinite(query.limit) ? Math.trunc(query.limit) : 1
  const min = Number.isFinite(query.minRating) ? Math.trunc(query.minRating ?? 1) : 1
  const handles = [...new Set((query.productHandles ?? []).map((h) => h.trim()).filter(Boolean))]
  return {
    limit: Math.min(WIDGET_REVIEWS_MAX, Math.max(1, limit)),
    minRating: Math.min(5, Math.max(1, min)),
    withPhotos: query.withPhotos === true,
    productHandles: handles.slice(0, WIDGET_PRODUCTS_MAX),
  }
}

/**
 * Published reviews across the store (or the chosen products), the ones the merchant featured
 * first, then the newest, with the rating summary of the same products. Nothing pending or
 * hidden ever leaves here. Runs under the store's RLS (`withStore`).
 */
export async function storeWidgetReviews(
  tx: StoreTx,
  settings: ReviewsSettings,
  raw: WidgetReviewsQuery,
): Promise<WidgetReviews> {
  const query = widgetQuery(raw)
  const empty = { summary: emptySummary(), reviews: [] }
  const showPhotos = settings.storefront.showPhotos
  // A photo widget on a store that hides customer photos has nothing to show.
  if (query.withPhotos && !showPhotos) return empty
  const productIds = query.productHandles.length
    ? (
        await tx
          .select({ id: product.id })
          .from(product)
          .where(inArray(product.handle, query.productHandles))
      ).map((p) => p.id)
    : null
  if (productIds?.length === 0) return empty
  const scope: SQL | undefined = and(
    eq(review.status, 'published'),
    productIds ? inArray(review.productId, productIds) : undefined,
  )

  const counts = await tx
    .select({ rating: review.rating, n: sql<number>`count(*)::int` })
    .from(review)
    .where(scope)
    .groupBy(review.rating)
  const summary = emptySummary()
  for (const c of counts) summary.stars[c.rating - 1] = c.n
  summary.count = summary.stars.reduce((a, b) => a + b, 0)
  const total = summary.stars.reduce((a, n, i) => a + n * (i + 1), 0)
  summary.rating = summary.count > 0 ? Math.round((total / summary.count) * 10) / 10 : 0
  if (summary.count === 0) return empty

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
    // A draft or archived product has no page to link to: the review reads as a store review.
    .leftJoin(product, and(eq(product.id, review.productId), eq(product.status, 'active')))
    .where(
      and(
        scope,
        query.minRating > 1 ? gte(review.rating, query.minRating) : undefined,
        query.withPhotos ? shownPhotoSql : undefined,
      ),
    )
    .orderBy(desc(review.featured), desc(review.createdAt))
    .limit(query.limit)
  const photos = showPhotos
    ? await photosFor(
        tx,
        rows.map((r) => r.id),
      )
    : new Map<string, ReviewPhoto[]>()
  return {
    summary,
    reviews: rows.map((r) => ({
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      name: displayName(r.name) || 'Customer',
      verified: r.verified,
      createdAt: r.createdAt.toISOString(),
      product: r.productTitle && r.handle ? { title: r.productTitle, handle: r.handle } : null,
      // A sized copy, sharp enough for the photo opened large, never the phone's original.
      photos: (photos.get(r.id) ?? []).map((p) => photoCopy(p, WIDGET_PHOTO_WIDTH)),
    })),
  }
}
