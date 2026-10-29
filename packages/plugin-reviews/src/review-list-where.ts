/** SOURCE OF TRUTH: the admin Reviews list's tab, search and filter panel, as one SQL condition. */
import { product } from '@commerce/db'
import { and, eq, gte, ilike, inArray, lt, or, type SQL, sql } from 'drizzle-orm'
import { type ReviewSource, type ReviewStatus, review, reviewMedia } from './schema'

export type ReviewListInput = {
  page: number
  perPage: number
  q?: string | undefined
  status?: ReviewStatus | undefined
  rating?: number | undefined
  productId?: string | undefined
  hasPhotos?: boolean | undefined
  /** The filter panel's picks; arrays are "any of" and combine with the single values above. */
  ratings?: number[] | undefined
  productIds?: string[] | undefined
  sources?: ReviewSource[] | undefined
  verifiedBuyer?: boolean | undefined
  featured?: boolean | undefined
  /** The store has replied (true) or not yet (false). */
  replied?: boolean | undefined
  /** Written in [from, to); ISO times. */
  createdFrom?: string | undefined
  createdTo?: string | undefined
}

/* The outer column is named in full (`"review"."id"`): drizzle prints a column bare in a
   one-table select, and a bare `id` inside the subquery would bind to its own table. */
export const hasPhotosSql = sql<boolean>`exists (select 1 from ${reviewMedia} rm where rm.review_id = "review"."id")`

const replied = sql`coalesce(${review.reply}, '') <> ''`

/** The list's WHERE; the query must left-join `product` for the search to reach its title. */
export function reviewListWhere(input: ReviewListInput): SQL | undefined {
  const q = input.q?.trim()
  return and(
    input.status ? eq(review.status, input.status) : undefined,
    input.rating ? eq(review.rating, input.rating) : undefined,
    input.productId ? eq(review.productId, input.productId) : undefined,
    input.hasPhotos === true ? hasPhotosSql : undefined,
    input.hasPhotos === false ? sql`not ${hasPhotosSql}` : undefined,
    input.ratings?.length ? inArray(review.rating, input.ratings) : undefined,
    input.productIds?.length ? inArray(review.productId, input.productIds) : undefined,
    input.sources?.length ? inArray(review.source, input.sources) : undefined,
    input.verifiedBuyer === undefined ? undefined : eq(review.verifiedBuyer, input.verifiedBuyer),
    input.featured === undefined ? undefined : eq(review.featured, input.featured),
    input.replied === undefined ? undefined : input.replied ? replied : sql`not ${replied}`,
    input.createdFrom ? gte(review.createdAt, new Date(input.createdFrom)) : undefined,
    input.createdTo ? lt(review.createdAt, new Date(input.createdTo)) : undefined,
    q
      ? or(
          ilike(review.title, `%${q}%`),
          ilike(review.body, `%${q}%`),
          ilike(review.reviewerName, `%${q}%`),
          ilike(product.title, `%${q}%`),
        )
      : undefined,
  )
}
