import { CommerceError, enqueueAppJob, permissions } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  askForRecentReviews,
  COPY_PHOTOS_JOB,
  deleteReviews,
  getReview,
  importJudgemeReviews,
  JUDGEME_MAX_BYTES,
  listReviews,
  loadReviewsSettings,
  previewJudgemeImport,
  REPLY_MAX,
  REVIEW_STATUSES,
  REVIEWS_ID,
  ReviewsSettingsSchema,
  replyToReview,
  reviewedProducts,
  reviewStats,
  reviewsState,
  saveReviewsSettings,
  setReviewFeatured,
  setReviewStatus,
} from '@commerce/plugin-reviews/server'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { BULK_MAX, can, canDetached, PAGE_MAX, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { writeReviewReply } from '../services/ai/review-reply'

type Ctx = { tx: StoreTx; scope: { storeId: string } }

async function requireInstalled(context: Ctx) {
  const { installed } = await reviewsState(context.tx, context.scope.storeId)
  if (!installed) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Reviews app first' })
  }
}

/** A review that is not this store's reads as not found (RLS hides it). */
function notFound(err: unknown): never {
  if (err instanceof CommerceError && err.code === 'NOT_FOUND') {
    throw new ORPCError('NOT_FOUND', { message: 'Review not found' })
  }
  throw err
}

const Ids = z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) })
const Csv = z.string().min(1).max(JUDGEME_MAX_BYTES)

export const reviewsRouter = {
  /** One page of reviews with the tiles' and tabs' numbers. */
  list: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).max(PAGE_MAX).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(20),
        q: z.string().trim().max(SEARCH_MAX).optional(),
        status: z.enum(REVIEW_STATUSES).optional(),
        rating: z.number().int().min(1).max(5).optional(),
        productId: z.uuid().optional(),
        hasPhotos: z.boolean().optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const [page, stats] = await Promise.all([
        listReviews(context.tx, input),
        reviewStats(context.tx),
      ])
      return { ...page, stats }
    }),

  /** Products that have reviews, for the list's product filter. */
  products: can(permissions.PRODUCTS_READ).handler(async ({ context }) => {
    await requireInstalled(context)
    return reviewedProducts(context.tx)
  }),

  get: can(permissions.PRODUCTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const found = await getReview(context.tx, input.id)
      if (!found) throw new ORPCError('NOT_FOUND', { message: 'Review not found' })
      return found
    }),

  /** Approve (publish), hide, or move back to waiting, one or many. */
  setStatus: can(permissions.PRODUCTS_WRITE)
    .input(Ids.extend({ status: z.enum(REVIEW_STATUSES) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return { updated: await setReviewStatus(context.tx, input.ids, input.status) }
    }),

  delete: can(permissions.PRODUCTS_WRITE)
    .input(Ids)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return { deleted: await deleteReviews(context.tx, input.ids) }
    }),

  /** The store's public reply; the first one emails the customer. Empty text removes it. */
  reply: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid(), text: z.string().max(REPLY_MAX) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      return replyToReview(context.tx, context.scope.storeId, input.id, input.text).catch(notFound)
    }),

  setFeatured: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid(), featured: z.boolean() }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      await setReviewFeatured(context.tx, input.id, input.featured).catch(notFound)
      return { ok: true }
    }),

  /** "Write with AI" on the reply box: a suggestion only. Uses the product writer's allowance. */
  writeReply: canDetached(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input, signal }) => writeReviewReply(context, input.id, signal)),

  /** Plans review requests, due now, for recently delivered orders never asked. */
  ask: can(permissions.PRODUCTS_WRITE).handler(async ({ context }) => {
    await requireInstalled(context)
    const settings = await loadReviewsSettings(context.tx, context.scope.storeId)
    try {
      return await askForRecentReviews(context.tx, context.scope.storeId, settings)
    } catch (err) {
      if (err instanceof CommerceError && err.code === 'REVIEW_EMAILS_OFF') {
        throw new ORPCError('PRECONDITION_FAILED', { message: err.message })
      }
      throw err
    }
  }),

  settings: {
    get: can(permissions.PRODUCTS_READ).handler(async ({ context }) => {
      await requireInstalled(context)
      return loadReviewsSettings(context.tx, context.scope.storeId)
    }),
    save: can(permissions.PRODUCTS_WRITE)
      .input(ReviewsSettingsSchema)
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return saveReviewsSettings(context.tx, context.scope.storeId, input)
      }),
  },

  judgeme: {
    /** Step 3 of the import: counts and the first rows with how each matched. Writes nothing. */
    preview: can(permissions.PRODUCTS_WRITE)
      .input(z.object({ csv: Csv }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        return previewJudgemeImport(context.tx, input.csv)
      }),

    /** Imports what the preview showed; photos are copied by a background job. */
    import: can(permissions.PRODUCTS_WRITE)
      .input(z.object({ csv: Csv, copyPhotos: z.boolean(), publish: z.boolean() }))
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const storeId = context.scope.storeId
        const result = await importJudgemeReviews(context.tx, storeId, input.csv, {
          copyPhotos: input.copyPhotos,
          publish: input.publish,
        })
        if (result.ok && result.photosToCopy > 0 && context.appJobs) {
          await enqueueAppJob(context.appJobs, {
            storeId,
            pluginId: REVIEWS_ID,
            name: COPY_PHOTOS_JOB,
            data: {},
          })
        }
        return result
      }),
  },
}
