/**
 * "Write with AI" on a review's reply box (Reviews app): the review and the product's name in,
 * a suggested public reply out. Nothing is saved: the merchant edits it and posts it. Runs
 * under the product writer's switch and monthly allowance (Settings → AI). Only the review's
 * text, stars, first name and product title are sent, never the customer's email.
 */
import {
  clampReply,
  generateStructured,
  ReviewReplySchema,
  reviewReplyContent,
  reviewReplyInstructions,
} from '@commerce/ai'
import { store, withStore } from '@commerce/db'
import { getReview } from '@commerce/plugin-reviews/server'
import { ORPCError } from '@orpc/server'
import { eq } from 'drizzle-orm'
import { type AiCallContext, finishAiCall, startAiCall } from './guard'

export async function writeReviewReply(
  context: AiCallContext,
  reviewId: string,
  signal?: AbortSignal,
): Promise<{ reply: string }> {
  const { storeId } = context.scope
  const found = await withStore(context.db, storeId, async (tx) => {
    const r = await getReview(tx, reviewId)
    const [s] = await tx.select({ name: store.name }).from(store).where(eq(store.id, storeId))
    return r ? { r, storeName: s?.name ?? '' } : null
  })
  if (!found) throw new ORPCError('NOT_FOUND', { message: 'Review not found' })
  const call = await startAiCall(context, 'productWriter')
  try {
    const { output, usage } = await generateStructured({
      runtime: call.runtime,
      model: call.model,
      schema: ReviewReplySchema,
      instructions: reviewReplyInstructions(found.storeName),
      content: reviewReplyContent({
        productTitle: found.r.product?.title ?? '',
        rating: found.r.review.rating,
        title: found.r.review.title,
        body: found.r.review.body,
        name: found.r.review.reviewerName,
      }),
      abortSignal: signal,
    })
    await finishAiCall(context.db, call, usage)
    return { reply: clampReply(output) }
  } catch {
    throw new ORPCError('BAD_GATEWAY', {
      message: 'The AI writer could not finish this time. Please try again.',
      data: { reason: 'model_failed' },
    })
  }
}
