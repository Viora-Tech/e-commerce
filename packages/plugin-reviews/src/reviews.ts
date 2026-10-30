import { CommerceError, insertOutboxEvent } from '@commerce/core'
import {
  customer,
  media,
  order,
  orderLine,
  product,
  productMedia,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, desc, eq, exists, inArray, isNull, or, sql } from 'drizzle-orm'
import { hasPhotosSql, type ReviewListInput, reviewListWhere } from './review-list-where'
import { type ReviewStatus, review, reviewMedia, reviewRequest } from './schema'
import { markSummariesStale } from './summary'

export type { ReviewListInput } from './review-list-where'

export type ReviewRow = typeof review.$inferSelect

/*
 * Correlated subqueries name the outer column in full (`"product"."id"`): drizzle prints a
 * column bare in a one-table select, and a bare `id` inside the subquery would bind to the
 * subquery's own table.
 */

/** The product's cover image: the first gallery picture. */
const coverOf = () =>
  sql<string | null>`(select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id
    where pm.product_id = "product"."id" order by pm.position asc limit 1)`

/**
 * One admin page of reviews, newest first, with the product (none on a store review) and
 * whether it has photos.
 */
export async function listReviews(tx: StoreTx, input: ReviewListInput) {
  const where = reviewListWhere(input)
  const rows = await tx
    .select({
      id: review.id,
      productId: review.productId,
      productTitle: product.title,
      productImage: coverOf(),
      rating: review.rating,
      title: review.title,
      body: review.body,
      reviewerName: review.reviewerName,
      verifiedBuyer: review.verifiedBuyer,
      featured: review.featured,
      status: review.status,
      source: review.source,
      hasPhotos: hasPhotosSql,
      createdAt: review.createdAt,
    })
    .from(review)
    .leftJoin(product, eq(product.id, review.productId))
    .where(where)
    .orderBy(desc(review.createdAt), desc(review.id))
    .limit(input.perPage)
    .offset((input.page - 1) * input.perPage)
  const [count] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(review)
    .leftJoin(product, eq(product.id, review.productId))
    .where(where)
  return { rows, total: count?.n ?? 0 }
}

/** The four tiles and the tab counts on the Reviews page. */
export async function reviewStats(tx: StoreTx) {
  const [s] = await tx
    .select({
      all: sql<number>`count(*)::int`,
      pending: sql<number>`count(*) filter (where ${review.status} = 'pending')::int`,
      published: sql<number>`count(*) filter (where ${review.status} = 'published')::int`,
      hidden: sql<number>`count(*) filter (where ${review.status} = 'hidden')::int`,
      average: sql<
        number | null
      >`avg(${review.rating}) filter (where ${review.status} = 'published')::float`,
      withPhotos: sql<number>`count(*) filter (where ${hasPhotosSql})::int`,
    })
    .from(review)
  return {
    all: s?.all ?? 0,
    pending: s?.pending ?? 0,
    published: s?.published ?? 0,
    hidden: s?.hidden ?? 0,
    average: s?.average === null || s?.average === undefined ? null : round1(s.average),
    withPhotos: s?.withPhotos ?? 0,
  }
}

const round1 = (n: number) => Math.round(n * 10) / 10

export type RatingSummary = {
  /** Average of published reviews, one decimal; 0 with none. */
  rating: number
  count: number
  /** Published reviews per star, index 0 = 1 star. */
  stars: [number, number, number, number, number]
}

export const emptySummary = (): RatingSummary => ({ rating: 0, count: 0, stars: [0, 0, 0, 0, 0] })

/**
 * Average rating and count per product from its published reviews, worked out on every
 * read, so approving, hiding, deleting or importing a review is reflected at once.
 */
export async function ratingSummaries(
  tx: StoreTx,
  productIds: string[],
): Promise<Map<string, RatingSummary>> {
  const out = new Map<string, RatingSummary>()
  const ids = [...new Set(productIds)]
  if (ids.length === 0) return out
  const rows = await tx
    .select({
      productId: review.productId,
      rating: review.rating,
      n: sql<number>`count(*)::int`,
    })
    .from(review)
    .where(and(inArray(review.productId, ids), eq(review.status, 'published')))
    .groupBy(review.productId, review.rating)
  for (const r of rows) {
    // Never null here (the filter names products); the check narrows the type.
    if (!r.productId) continue
    const s = out.get(r.productId) ?? emptySummary()
    s.stars[r.rating - 1] = (s.stars[r.rating - 1] ?? 0) + r.n
    out.set(r.productId, s)
  }
  for (const s of out.values()) {
    s.count = s.stars.reduce((a, b) => a + b, 0)
    const total = s.stars.reduce((a, n, i) => a + n * (i + 1), 0)
    s.rating = s.count > 0 ? round1(total / s.count) : 0
  }
  return out
}

/** Ready photos per review, in order. */
export async function photosFor(
  tx: StoreTx,
  reviewIds: string[],
): Promise<
  Map<string, { id: string; url: string; width: number | null; height: number | null }[]>
> {
  const out = new Map<
    string,
    { id: string; url: string; width: number | null; height: number | null }[]
  >()
  if (reviewIds.length === 0) return out
  const rows = await tx
    .select({
      reviewId: reviewMedia.reviewId,
      id: media.id,
      url: media.url,
      width: media.width,
      height: media.height,
    })
    .from(reviewMedia)
    .innerJoin(media, eq(media.id, reviewMedia.mediaId))
    .where(and(inArray(reviewMedia.reviewId, reviewIds), eq(media.status, 'ready')))
    .orderBy(reviewMedia.position)
  for (const r of rows) {
    const list = out.get(r.reviewId) ?? []
    list.push({ id: r.id, url: r.url, width: r.width, height: r.height })
    out.set(r.reviewId, list)
  }
  return out
}

export type ActivityEntry = {
  kind: 'submitted' | 'imported' | 'held' | 'published' | 'hidden' | 'replied' | 'requested'
  at: Date
  /** For `held`: why. */
  reason?: string | null | undefined
}

/** Everything the review detail page shows. Null when the review is not this store's. */
export async function getReview(tx: StoreTx, id: string) {
  const [r] = await tx.select().from(review).where(eq(review.id, id))
  if (!r) return null
  const productId = r.productId
  const [p] = productId
    ? await tx
        .select({
          id: product.id,
          title: product.title,
          handle: product.handle,
          image: coverOf(),
        })
        .from(product)
        .where(eq(product.id, productId))
    : []
  const summary = productId
    ? ((await ratingSummaries(tx, [productId])).get(productId) ?? emptySummary())
    : emptySummary()
  const photos = (await photosFor(tx, [r.id])).get(r.id) ?? []
  const [waiting] = await tx
    .select({ n: sql<number>`count(*)::int` })
    .from(reviewMedia)
    .where(and(eq(reviewMedia.reviewId, r.id), isNull(reviewMedia.mediaId)))
  const [o] = r.orderId
    ? await tx.select({ number: order.number }).from(order).where(eq(order.id, r.orderId))
    : []
  const email = r.reviewerEmail?.toLowerCase() ?? null
  const byCustomer = or(
    r.customerId ? eq(order.customerId, r.customerId) : undefined,
    email ? sql`lower(${order.email}) = ${email}` : undefined,
  )
  const [orders] =
    r.customerId || email
      ? await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(order)
          .where(and(byCustomer, sql`${order.status} <> 'draft'`))
      : []
  const [written] = email
    ? await tx
        .select({ n: sql<number>`count(*)::int` })
        .from(review)
        .where(sql`lower(${review.reviewerEmail}) = ${email}`)
    : [{ n: 1 }]
  const [request] =
    r.orderId && productId
      ? await tx
          .select({ sentAt: reviewRequest.sentAt })
          .from(reviewRequest)
          .where(and(eq(reviewRequest.orderId, r.orderId), eq(reviewRequest.productId, productId)))
      : []
  const [cu] = r.customerId
    ? await tx.select({ id: customer.id }).from(customer).where(eq(customer.id, r.customerId))
    : []
  const activity: ActivityEntry[] = [
    ...(request?.sentAt ? [{ kind: 'requested' as const, at: request.sentAt }] : []),
    {
      kind: r.source === 'judgeme' ? ('imported' as const) : ('submitted' as const),
      at: r.createdAt,
    },
    ...(r.heldReason ? [{ kind: 'held' as const, at: r.createdAt, reason: r.heldReason }] : []),
    ...(r.publishedAt ? [{ kind: 'published' as const, at: r.publishedAt }] : []),
    ...(r.hiddenAt ? [{ kind: 'hidden' as const, at: r.hiddenAt }] : []),
    ...(r.replyAt ? [{ kind: 'replied' as const, at: r.replyAt }] : []),
  ].sort((a, b) => b.at.getTime() - a.at.getTime())
  return {
    review: {
      id: r.id,
      rating: r.rating,
      title: r.title,
      body: r.body,
      reviewerName: r.reviewerName,
      status: r.status,
      verifiedBuyer: r.verifiedBuyer,
      source: r.source,
      reply: r.reply,
      replyAt: r.replyAt,
      featured: r.featured,
      helpfulCount: r.helpfulCount,
      createdAt: r.createdAt,
      orderId: r.orderId,
      orderNumber: o?.number ?? null,
    },
    photos,
    photosWaiting: waiting?.n ?? 0,
    product: p ? { ...p, rating: summary.rating, count: summary.count } : null,
    customer: {
      id: cu?.id ?? null,
      name: r.reviewerName,
      orders: orders?.n ?? 0,
      reviews: written?.n ?? 1,
      boughtProduct: r.verifiedBuyer,
    },
    activity,
  }
}

/** Approve (publish), hide, or send back to waiting; ids of other stores are never seen (RLS). */
export async function setReviewStatus(
  tx: StoreTx,
  ids: string[],
  status: ReviewStatus,
  now: Date = new Date(),
): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await tx
    .update(review)
    .set({
      status,
      updatedAt: now,
      ...(status === 'published'
        ? {
            publishedAt: sql`coalesce(${review.publishedAt}, ${now.toISOString()}::timestamptz)`,
            hiddenAt: null,
          }
        : {}),
      ...(status === 'hidden' ? { hiddenAt: now } : {}),
    })
    .where(inArray(review.id, ids))
    .returning({ id: review.id, storeId: review.storeId, productId: review.productId })
  await staleSummariesFor(tx, rows, now)
  return rows.length
}

/** Published, hidden or deleted reviews change what their products' summaries should say. */
async function staleSummariesFor(
  tx: StoreTx,
  rows: { storeId: string; productId: string | null }[],
  now: Date = new Date(),
): Promise<void> {
  const first = rows[0]
  if (!first) return
  await markSummariesStale(
    tx,
    first.storeId,
    rows.map((r) => r.productId),
    now,
  )
}

export async function deleteReviews(tx: StoreTx, ids: string[]): Promise<number> {
  if (ids.length === 0) return 0
  const rows = await tx
    .delete(review)
    .where(inArray(review.id, ids))
    .returning({ id: review.id, storeId: review.storeId, productId: review.productId })
  await staleSummariesFor(tx, rows)
  return rows.length
}

export async function setReviewFeatured(tx: StoreTx, id: string, featured: boolean) {
  const [row] = await tx
    .update(review)
    .set({ featured, updatedAt: new Date() })
    .where(eq(review.id, id))
    .returning({ id: review.id })
  if (!row) throw new CommerceError('NOT_FOUND', 'Review not found')
}

/** Longest store reply we keep. */
export const REPLY_MAX = 2000

/**
 * The store's public reply. The first reply emails the customer (when we have their
 * address), through the outbox in the same transaction; editing it later does not email
 * again. An empty reply removes it.
 */
export async function replyToReview(
  tx: StoreTx,
  storeId: string,
  id: string,
  text: string,
  now: Date = new Date(),
): Promise<{ emailed: boolean }> {
  const [r] = await tx
    .select({ replyAt: review.replyAt, email: review.reviewerEmail })
    .from(review)
    .where(eq(review.id, id))
  if (!r) throw new CommerceError('NOT_FOUND', 'Review not found')
  const reply = text.trim().slice(0, REPLY_MAX)
  await tx
    .update(review)
    .set({
      reply: reply || null,
      replyAt: reply ? (r.replyAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(review.id, id))
  const emailed = Boolean(reply && !r.replyAt && r.email)
  if (emailed) await insertOutboxEvent(tx, storeId, 'review.replied', { reviewId: id })
  return { emailed }
}

/** What the reply email says: who, which product (none for a store review), the reply. */
export async function replyEmailData(tx: StoreTx, id: string) {
  const [r] = await tx
    .select({
      email: review.reviewerEmail,
      name: review.reviewerName,
      reply: review.reply,
      status: review.status,
      productTitle: product.title,
      handle: product.handle,
    })
    .from(review)
    .leftJoin(product, eq(product.id, review.productId))
    .where(eq(review.id, id))
  if (!r?.email || !r.reply) return null
  return r
}

/**
 * The order (number and id) in which this person bought this product: by their account,
 * or by the email on the order. Draft and cancelled orders do not count.
 */
export async function purchaseOf(
  tx: StoreTx,
  input: { productId: string; customerId?: string | null | undefined; email?: string | null },
): Promise<{ orderId: string; orderNumber: number } | null> {
  const email = input.email?.trim().toLowerCase() || null
  const who = or(
    input.customerId ? eq(order.customerId, input.customerId) : undefined,
    email ? sql`lower(${order.email}) = ${email}` : undefined,
  )
  if (!who) return null
  const [row] = await tx
    .select({ orderId: order.id, orderNumber: order.number })
    .from(order)
    .where(
      and(
        who,
        sql`${order.status} in ('open', 'completed')`,
        exists(
          tx
            .select({ one: sql`1` })
            .from(orderLine)
            .innerJoin(variant, eq(variant.id, orderLine.variantId))
            .where(and(eq(orderLine.orderId, order.id), eq(variant.productId, input.productId))),
        ),
      ),
    )
    .orderBy(desc(order.placedAt))
    .limit(1)
  return row ?? null
}

/**
 * The buyer behind a review request link: the order's number and the customer's name, when
 * that order really holds the product. Null otherwise (cancelled, another product).
 */
export async function requestLinkBuyer(
  tx: StoreTx,
  link: { orderId: string; productId: string },
): Promise<{ orderNumber: number; name: string } | null> {
  const [o] = await tx
    .select({ number: order.number, customerId: order.customerId })
    .from(order)
    .where(
      and(
        eq(order.id, link.orderId),
        sql`${order.status} in ('open', 'completed')`,
        exists(
          tx
            .select({ one: sql`1` })
            .from(orderLine)
            .innerJoin(variant, eq(variant.id, orderLine.variantId))
            .where(and(eq(orderLine.orderId, order.id), eq(variant.productId, link.productId))),
        ),
      ),
    )
  if (!o) return null
  const [cu] = o.customerId
    ? await tx.select({ name: customer.name }).from(customer).where(eq(customer.id, o.customerId))
    : []
  return { orderNumber: o.number, name: cu?.name ?? '' }
}

/** Products that have reviews, by name, for the list's product filter. */
export function reviewedProducts(tx: StoreTx, limit = 300) {
  return tx
    .selectDistinct({ id: product.id, title: product.title })
    .from(review)
    .innerJoin(product, eq(product.id, review.productId))
    .orderBy(product.title)
    .limit(limit)
}
