import { loadEnv, settingsSecret } from '@commerce/config'
import { CommerceError, enqueueAppJob, permissions, storefrontOriginFor } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import {
  askForRecentReviews,
  askPastOrders,
  COPY_PHOTOS_JOB,
  deleteReviews,
  getReview,
  importJudgemeReviews,
  JUDGEME_MAX_BYTES,
  listReviews,
  loadReviewsSettings,
  parseQrTarget,
  previewJudgemeImport,
  previewPastOrders,
  REPLY_MAX,
  REVIEW_SOURCES,
  REVIEW_STATUSES,
  REVIEWS_ID,
  ReviewsSettingsSchema,
  replyToReview,
  reviewedProducts,
  reviewQrLinks,
  rewardPhotoReviews,
  reviewStats,
  reviewsState,
  saveReviewsSettings,
  setReviewFeatured,
  setReviewStatus,
  storeWidgetReviews,
  WIDGET_PRODUCTS_MAX,
  WIDGET_REVIEWS_MAX,
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

/** A plain CommerceError from the past-orders tools, as the API's error. */
function askError(err: unknown): never {
  if (err instanceof CommerceError && err.code === 'REVIEW_EMAILS_OFF') {
    throw new ORPCError('PRECONDITION_FAILED', { message: err.message })
  }
  if (err instanceof CommerceError && err.code === 'REVIEW_RANGE_INVALID') {
    throw new ORPCError('BAD_REQUEST', { message: err.message })
  }
  throw err
}

const Ids = z.object({ ids: z.array(z.uuid()).min(1).max(BULK_MAX) })
/** The merchant's date range, start of the first day to end of the last, in their time zone. */
const PastRange = z.object({
  from: z.iso.datetime({ offset: true }),
  to: z.iso.datetime({ offset: true }),
})
const pastRange = (input: z.infer<typeof PastRange>) => ({
  from: new Date(input.from),
  to: new Date(input.to),
})
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
        /** The admin's filter panel; each combines with the tab (`status`) and search. */
        ratings: z.array(z.number().int().min(1).max(5)).max(5).optional(),
        productIds: z.array(z.uuid()).max(BULK_MAX).optional(),
        sources: z.array(z.enum(REVIEW_SOURCES)).max(REVIEW_SOURCES.length).optional(),
        verifiedBuyer: z.boolean().optional(),
        featured: z.boolean().optional(),
        replied: z.boolean().optional(),
        createdFrom: z.iso.datetime().optional(),
        createdTo: z.iso.datetime().optional(),
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
      const { storeId } = context.scope
      const updated = await setReviewStatus(context.tx, input.ids, input.status)
      if (input.status === 'published') {
        // Photo reviews approved now earn the reward code, when the store offers one.
        const settings = await loadReviewsSettings(context.tx, storeId)
        await rewardPhotoReviews(context.tx, storeId, input.ids, settings)
      }
      return { updated }
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

  /** "Request reviews from past orders": how many delivered orders in the range would be asked. */
  pastOrdersPreview: can(permissions.PRODUCTS_WRITE)
    .input(PastRange)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const settings = await loadReviewsSettings(context.tx, context.scope.storeId)
      return previewPastOrders(context.tx, settings, pastRange(input)).catch(askError)
    }),

  /** Plans the requests the preview counted, a batch an hour, after any still waiting. */
  askPastOrders: can(permissions.PRODUCTS_WRITE)
    .input(PastRange)
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const settings = await loadReviewsSettings(context.tx, context.scope.storeId)
      return askPastOrders(context.tx, context.scope.storeId, settings, pastRange(input)).catch(
        askError,
      )
    }),

  /**
   * The links a review QR card encodes (`order-<id>` or `product-<id>`): the product's review
   * form, or a signed link per product of the order so the buyer reviews as a verified buyer.
   */
  qrLinks: can(permissions.PRODUCTS_READ)
    .input(z.object({ target: z.string().max(64) }))
    .handler(async ({ context, input }) => {
      await requireInstalled(context)
      const target = parseQrTarget(input.target)
      if (!target) throw new ORPCError('NOT_FOUND', { message: 'Nothing to make a card for' })
      const { storeId } = context.scope
      return reviewQrLinks(context.tx, storeId, target, {
        secret: settingsSecret(),
        storefrontUrl: await storefrontOriginFor(
          context.tx,
          storeId,
          loadEnv(process.env).STOREFRONT_URL,
        ),
      })
    }),

  /**
   * The published reviews a Reviews theme section draws, for the theme editor's canvas (the
   * storefront reads the same query itself). Null when the app is not installed, so the section
   * shows its hint instead of an error.
   */
  widgets: can(permissions.ONLINE_STORE_READ)
    .input(
      z.object({
        limit: z.number().int().min(1).max(WIDGET_REVIEWS_MAX),
        minRating: z.number().int().min(1).max(5).optional(),
        withPhotos: z.boolean().optional(),
        productHandles: z.array(z.string().trim().max(255)).max(WIDGET_PRODUCTS_MAX).optional(),
      }),
    )
    .handler(async ({ context, input }) => {
      const state = await reviewsState(context.tx, context.scope.storeId)
      return state.installed ? storeWidgetReviews(context.tx, state.settings, input) : null
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

    /**
     * Imports what the preview showed (store reviews too, and missing-product rows as store
     * reviews when asked); photos are copied by a background job.
     */
    import: can(permissions.PRODUCTS_WRITE)
      .input(
        z.object({
          csv: Csv,
          copyPhotos: z.boolean(),
          publish: z.boolean(),
          unmatchedAsStore: z.boolean().default(false),
        }),
      )
      .handler(async ({ context, input }) => {
        await requireInstalled(context)
        const storeId = context.scope.storeId
        const result = await importJudgemeReviews(context.tx, storeId, input.csv, {
          copyPhotos: input.copyPhotos,
          publish: input.publish,
          unmatchedAsStore: input.unmatchedAsStore,
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
