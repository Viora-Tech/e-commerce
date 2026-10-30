import { insertOutboxEvent, issuePersonalCode } from '@commerce/core'
import { discount, product, type StoreTx, store } from '@commerce/db'
import { and, eq, exists, inArray, isNotNull, isNull, sql } from 'drizzle-orm'
import { review, reviewMedia } from './schema'
import type { ReviewsSettings } from './settings'

/** The code's prefix: `PHOTO-7K2QX9FD`. */
export const PHOTO_REWARD_PREFIX = 'PHOTO'

/** "10% off": how the reward reads in the email. */
export function rewardLabel(percent: number): string {
  return `${percent}% off`
}

/**
 * Sends the photo review reward for the reviews among `ids` that earned it: published, written
 * on the store (imports never), with a photo and the reviewer's email, and not rewarded before.
 * Each gets its own single-use code (made through the discounts table like every personal code,
 * named after the review so a retry finds the same code) and one `review.rewarded` outbox row,
 * which the relay turns into the `review_reward` email. Returns how many were rewarded.
 */
export async function rewardPhotoReviews(
  tx: StoreTx,
  storeId: string,
  ids: string[],
  settings: Pick<ReviewsSettings, 'photoReward'>,
  now: Date = new Date(),
): Promise<number> {
  if (!settings.photoReward.enabled || ids.length === 0) return 0
  const due = await tx
    .select({ id: review.id, customerId: review.customerId })
    .from(review)
    .where(
      and(
        inArray(review.id, ids),
        eq(review.status, 'published'),
        eq(review.source, 'storefront'),
        isNull(review.rewardCode),
        isNotNull(review.reviewerEmail),
        exists(
          tx
            .select({ one: sql`1` })
            .from(reviewMedia)
            .where(and(eq(reviewMedia.reviewId, review.id), isNotNull(reviewMedia.mediaId))),
        ),
      ),
    )
  if (due.length === 0) return 0
  const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
  for (const r of due) {
    const code = await issuePersonalCode(tx, storeId, {
      messageId: r.id,
      prefix: PHOTO_REWARD_PREFIX,
      offer: { percent: settings.photoReward.percent, days: settings.photoReward.days },
      customerId: r.customerId,
      title: `Photo review thanks${s?.name ? ` (${s.name})` : ''}`,
      now,
    })
    await tx
      .update(review)
      .set({ rewardCode: code, rewardSentAt: now })
      .where(eq(review.id, r.id))
    await insertOutboxEvent(tx, storeId, 'review.rewarded', { reviewId: r.id })
  }
  return due.length
}

/** What the reward email needs: who to, the product, the code, its value and its last day. */
export async function rewardEmailData(tx: StoreTx, reviewId: string) {
  const [r] = await tx
    .select({
      email: review.reviewerEmail,
      name: review.reviewerName,
      code: review.rewardCode,
      productTitle: product.title,
      handle: product.handle,
      value: discount.value,
      endsAt: discount.endsAt,
    })
    .from(review)
    .leftJoin(product, eq(product.id, review.productId))
    .leftJoin(discount, eq(discount.code, review.rewardCode))
    .where(eq(review.id, reviewId))
  if (!r?.email || !r.code) return null
  return { ...r, email: r.email, code: r.code, percent: Math.round((r.value ?? 0) / 100) }
}
