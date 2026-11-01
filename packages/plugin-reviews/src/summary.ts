import { product, type StoreTx, store } from '@commerce/db'
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'
import { review, reviewSummary } from './schema'

/** Fewer published reviews than this get no summary: there is nothing to sum up yet. */
const SUMMARY_MIN_REVIEWS = 3

/** Most reviews one summary reads, newest first (`REVIEW_SUMMARY_REVIEWS` in @commerce/ai). */
const SUMMARY_READS = 60

/** Most summaries one store refreshes per worker tick, so one big import cannot hog the AI. */
const SUMMARIES_PER_TICK = 20

/**
 * Marks the summaries of these products for a refresh (a review was published, hidden,
 * deleted or imported). Creates the row the first time, so every reviewed product gets one.
 */
export async function markSummariesStale(
  tx: StoreTx,
  storeId: string,
  productIds: readonly (string | null)[],
  now: Date = new Date(),
): Promise<void> {
  const wanted = [...new Set(productIds.filter((id): id is string => Boolean(id)))]
  if (wanted.length === 0) return
  // Only this store's products: an id from another store, or a
  // deleted product, never gets a summary row here.
  const own = await tx
    .select({ id: product.id })
    .from(product)
    .where(and(eq(product.storeId, storeId), inArray(product.id, wanted)))
  const ids = own.map((p) => p.id)
  if (ids.length === 0) return
  await tx
    .insert(reviewSummary)
    .values(ids.map((productId) => ({ storeId, productId, stale: true, updatedAt: now })))
    .onConflictDoUpdate({
      target: [reviewSummary.storeId, reviewSummary.productId],
      set: { stale: true, updatedAt: now },
    })
}

/** The summaries waiting for a refresh, oldest first. */
export async function staleSummaries(tx: StoreTx, limit = SUMMARIES_PER_TICK) {
  return tx
    .select({ productId: reviewSummary.productId })
    .from(reviewSummary)
    .where(eq(reviewSummary.stale, true))
    .orderBy(asc(reviewSummary.updatedAt))
    .limit(limit)
}

/** What the summary writer reads for one product: its title and published reviews with text. */
export async function summarySource(tx: StoreTx, productId: string) {
  const [p] = await tx
    .select({ title: product.title })
    .from(product)
    .where(eq(product.id, productId))
  const reviews = await tx
    .select({ rating: review.rating, title: review.title, body: review.body })
    .from(review)
    .where(
      and(
        eq(review.productId, productId),
        eq(review.status, 'published'),
        sql`length(trim(${review.body})) > 0`,
      ),
    )
    .orderBy(desc(review.createdAt))
    .limit(SUMMARY_READS)
  return { productTitle: p?.title ?? '', reviews }
}

/** The store's name, for the summary writer's instructions. */
export async function storeNameOf(tx: StoreTx, storeId: string): Promise<string> {
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  return s?.name ?? ''
}

/** Whether a product has enough to summarise; below it the summary is cleared, no AI call. */
export const needsSummary = (reviewCount: number) => reviewCount >= SUMMARY_MIN_REVIEWS

/** Stores the refreshed summary (or the reason it failed, keeping the last good text). */
export async function saveSummary(
  tx: StoreTx,
  productId: string,
  result: { summary: string; reviewCount: number } | { error: string },
  now: Date = new Date(),
): Promise<void> {
  await tx
    .update(reviewSummary)
    .set(
      'error' in result
        ? { stale: false, error: result.error, updatedAt: now }
        : {
            stale: false,
            error: null,
            summary: result.summary,
            reviewCount: result.reviewCount,
            generatedAt: now,
            updatedAt: now,
          },
    )
    .where(eq(reviewSummary.productId, productId))
}

/** The product's "What customers say" text for the storefront, or null when it has none. */
export async function productSummary(
  tx: StoreTx,
  productId: string,
): Promise<{ text: string; reviewCount: number } | null> {
  const [row] = await tx
    .select({ text: reviewSummary.summary, reviewCount: reviewSummary.reviewCount })
    .from(reviewSummary)
    .where(eq(reviewSummary.productId, productId))
  return row?.text && needsSummary(row.reviewCount) ? row : null
}

/** The admin's view of one product's summary: the text, when it was written, and any error. */
export async function summaryState(tx: StoreTx, productId: string) {
  const [row] = await tx
    .select({
      summary: reviewSummary.summary,
      reviewCount: reviewSummary.reviewCount,
      stale: reviewSummary.stale,
      error: reviewSummary.error,
      generatedAt: reviewSummary.generatedAt,
    })
    .from(reviewSummary)
    .where(eq(reviewSummary.productId, productId))
  return row ?? null
}
