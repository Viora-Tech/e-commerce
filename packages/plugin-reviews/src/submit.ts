import { CommerceError } from '@commerce/core'
import { media, order, product, type StoreTx } from '@commerce/db'
import { and, eq, gt, inArray, isNull, sql } from 'drizzle-orm'
import { purchaseOf, requestLinkBuyer } from './reviews'
import { rewardPhotoReviews } from './rewards'
import { review, reviewMedia, reviewRequest } from './schema'
import { displayName, MAX_REVIEW_PHOTOS, publishDecision, type ReviewsSettings } from './settings'
import { markSummariesStale } from './summary'

/** Why a review was not taken. `invalid` carries the field that is wrong. */
export type ReviewRejection = 'invalid' | 'not_allowed' | 'limit' | 'already' | 'product'

export class ReviewRejected extends CommerceError {
  readonly reason: ReviewRejection
  readonly field: string | undefined
  constructor(reason: ReviewRejection, field?: string) {
    super('REVIEW_REJECTED', `review not taken: ${reason}${field ? ` (${field})` : ''}`)
    this.reason = reason
    this.field = field
  }
}

const REVIEW_LIMITS = { title: 150, body: 5000, name: 80, email: 254 } as const
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type ReviewForm = {
  productId: string
  rating: number
  title: string
  body: string
  name: string
  email: string
}

const text = (form: { get(name: string): unknown }, key: string, max: number): string => {
  const v = form.get(key)
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/**
 * The write-a-review form (field names `product_id`, `rating`, `title`, `body`, `name`,
 * `email`) read into a review, every value capped. The email may be blank only when the
 * caller knows who the shopper is (signed in, or a request link).
 */
export function parseReviewForm(
  form: { get(name: string): unknown },
  opts: { emailKnown: boolean },
): { ok: true; value: ReviewForm } | { ok: false; field: string } {
  const productId = text(form, 'product_id', 64)
  const rating = Number(text(form, 'rating', 2))
  const value: ReviewForm = {
    productId,
    rating,
    title: text(form, 'title', REVIEW_LIMITS.title),
    body: text(form, 'body', REVIEW_LIMITS.body),
    name: text(form, 'name', REVIEW_LIMITS.name),
    email: text(form, 'email', REVIEW_LIMITS.email).toLowerCase(),
  }
  if (!/^[0-9a-f-]{36}$/i.test(productId)) return { ok: false, field: 'product' }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, field: 'rating' }
  if (value.body.length < 2) return { ok: false, field: 'body' }
  if (!value.name) return { ok: false, field: 'name' }
  if (value.email && !EMAIL.test(value.email)) return { ok: false, field: 'email' }
  if (!value.email && !opts.emailKnown) return { ok: false, field: 'email' }
  return { ok: true, value }
}

export type SubmitReviewInput = ReviewForm & {
  /** Media ids of photos this visitor stored (each checked against its signed token by the caller). */
  photoMediaIds: string[]
  /** The signed-in shopper, if any. */
  customer?: { id: string; email: string | null } | null | undefined
  /** The order and product of a review request link, when the shopper came from one. */
  requestLink?: { orderId: string; productId: string } | null | undefined
}

/** Who wrote it and the order that makes them a verified buyer, if any. */
async function buyerOf(tx: StoreTx, input: SubmitReviewInput) {
  if (input.requestLink && input.requestLink.productId === input.productId) {
    const [o] = await tx
      .select({ id: order.id, email: order.email, customerId: order.customerId })
      .from(order)
      .where(eq(order.id, input.requestLink.orderId))
    // The link's own order must hold the product (not cancelled, not a draft).
    const bought = o ? await requestLinkBuyer(tx, input.requestLink) : null
    if (o && bought) {
      return {
        email: (o.email ?? input.email).toLowerCase() || null,
        customerId: o.customerId,
        orderId: o.id,
      }
    }
  }
  if (input.customer) {
    const bought = await purchaseOf(tx, {
      productId: input.productId,
      customerId: input.customer.id,
      email: input.customer.email,
    })
    return {
      email: (input.customer.email ?? input.email).toLowerCase() || null,
      customerId: input.customer.id,
      orderId: bought?.orderId ?? null,
    }
  }
  // A typed email proves nothing: the review is taken (when anyone may review), never verified.
  return { email: input.email || null, customerId: null, orderId: null }
}

/**
 * Takes a shopper's review. Verified buyer means the shopper's account, or the order of
 * the request link they came from, holds an order with this product; with "only verified
 * buyers" on, nobody else may review. One review per person per product, and at most
 * `maxPerDay` a day per email. The settings decide whether it goes live now or waits.
 */
export async function submitReview(
  tx: StoreTx,
  storeId: string,
  input: SubmitReviewInput,
  settings: ReviewsSettings,
  now: Date = new Date(),
): Promise<{ id: string; status: 'published' | 'pending'; verified: boolean }> {
  const [p] = await tx
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.id, input.productId), eq(product.status, 'active')))
  if (!p) throw new ReviewRejected('product')
  const buyer = await buyerOf(tx, input)
  const verified = buyer.orderId !== null
  if (settings.whoCanReview === 'verified' && !verified) throw new ReviewRejected('not_allowed')
  if (!buyer.email) throw new ReviewRejected('invalid', 'email')

  const sameEmail = sql`lower(${review.reviewerEmail}) = ${buyer.email}`
  const [already] = await tx
    .select({ id: review.id })
    .from(review)
    .where(and(sameEmail, eq(review.productId, input.productId)))
    .limit(1)
  if (already) throw new ReviewRejected('already')
  const [today] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(review)
    .where(
      and(
        sameEmail,
        eq(review.source, 'storefront'),
        gt(review.createdAt, new Date(now.getTime() - 24 * 60 * 60 * 1000)),
      ),
    )
  if ((today?.n ?? 0) >= settings.maxPerDay) throw new ReviewRejected('limit')

  const wanted = [...new Set(input.photoMediaIds)].slice(0, MAX_REVIEW_PHOTOS)
  const photos = wanted.length
    ? await tx
        .select({ id: media.id })
        .from(media)
        .where(and(inArray(media.id, wanted), inArray(media.status, ['processing', 'ready'])))
    : []
  const decision = publishDecision(settings, { rating: input.rating, photos: photos.length })
  const [row] = await tx
    .insert(review)
    .values({
      storeId,
      productId: input.productId,
      orderId: buyer.orderId,
      customerId: buyer.customerId,
      rating: input.rating,
      title: input.title,
      body: input.body,
      reviewerName: displayName(input.name),
      reviewerEmail: buyer.email,
      status: decision.status,
      heldReason: decision.heldReason,
      verifiedBuyer: verified,
      source: 'storefront',
      publishedAt: decision.status === 'published' ? now : null,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: review.id })
  if (!row) throw new CommerceError('REVIEW_NOT_SAVED', 'review not saved')
  const kept = wanted.filter((id) => photos.some((ph) => ph.id === id))
  if (kept.length > 0) {
    await tx
      .insert(reviewMedia)
      .values(kept.map((mediaId, position) => ({ storeId, reviewId: row.id, mediaId, position })))
  }
  // Reviewed: no request or reminder for this product goes to this person any more.
  await tx
    .update(reviewRequest)
    .set({ reviewedAt: now })
    .where(
      and(
        eq(reviewRequest.productId, input.productId),
        sql`lower(${reviewRequest.email}) = ${buyer.email}`,
        isNull(reviewRequest.reviewedAt),
      ),
    )
  // Published straight away: the product's summary takes it in on the next refresh.
  if (decision.status === 'published') {
    await markSummariesStale(tx, storeId, [input.productId], now)
  }
  // Published straight away with a photo: the photo review reward goes out now.
  if (decision.status === 'published' && kept.length > 0) {
    await rewardPhotoReviews(tx, storeId, [row.id], settings, now)
  }
  return { id: row.id, status: decision.status, verified }
}

/** "Was this helpful?": one more vote on a published review (the caller limits votes per visitor). */
export async function markHelpful(tx: StoreTx, id: string): Promise<number | null> {
  const [row] = await tx
    .update(review)
    .set({ helpfulCount: sql`${review.helpfulCount} + 1` })
    .where(and(eq(review.id, id), eq(review.status, 'published')))
    .returning({ n: review.helpfulCount })
  return row?.n ?? null
}
