import {
  aiModel,
  clampSummary,
  generateStructured,
  ReviewSummarySchema,
  reviewSummaryContent,
  reviewSummaryInstructions,
} from '@commerce/ai'
import { installedApps, recordAiUsage } from '@commerce/core'
import { admitAiCall } from '@commerce/core/ai-runtime'
import { type Db, storesWithStaleReviewSummaries, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  loadReviewsSettings,
  needsSummary,
  REVIEWS_ID,
  saveSummary,
  staleSummaries,
  storeNameOf,
  summarySource,
} from '@commerce/plugin-reviews/server'
import {
  type IORedis,
  KEEP_FINISHED,
  Queue,
  REVIEW_SUMMARIES_QUEUE,
  Worker,
} from '@commerce/queue'

/** New reviews show in the summary within about this long. */
export const REVIEW_SUMMARIES_EVERY_MS = 15 * 60_000

const STOPPED = {
  feature_off: 'The AI product writer is turned off in Settings → AI.',
  quota: "Your store has used this month's AI allowance.",
  ai_off: 'AI is not switched on for this platform.',
} as const

/**
 * Refreshes one store's stale "What customers say" summaries (Reviews app), a few per tick.
 * Each refresh is one admitted, metered call of the product writer; reads and writes take their
 * own short transactions, never holding one open while the model thinks. A product with fewer
 * than three published reviews is cleared without a call. Out of allowance or switched off: the
 * reason is saved on the summary (the admin shows it; Refresh tries again) and the store stops
 * for this tick.
 */
async function refreshStore(db: Db, storeId: string): Promise<number> {
  const ready = await withStore(db, storeId, async (tx) => {
    const settings = await loadReviewsSettings(tx, storeId)
    if (!settings.aiSummary.enabled) return null
    return { rows: await staleSummaries(tx), storeName: await storeNameOf(tx, storeId) }
  })
  if (!ready) return 0
  let done = 0
  for (const { productId } of ready.rows) {
    const source = await withStore(db, storeId, (tx) => summarySource(tx, productId))
    if (!needsSummary(source.reviews.length)) {
      await withStore(db, storeId, (tx) =>
        saveSummary(tx, productId, { summary: '', reviewCount: source.reviews.length }),
      )
      continue
    }
    const admission = await withStore(db, storeId, (tx) =>
      admitAiCall({ storeId, tx }, 'productWriter'),
    )
    const model = admission.ok ? aiModel('productWriter', process.env, admission.tier) : null
    if (!admission.ok || !model) {
      const reason = admission.ok ? 'ai_off' : admission.reason
      await withStore(db, storeId, (tx) => saveSummary(tx, productId, { error: STOPPED[reason] }))
      return done
    }
    try {
      const { output, usage } = await generateStructured({
        runtime: { storeId, userId: 'system', plan: admission.plan, feature: 'productWriter' },
        model,
        schema: ReviewSummarySchema,
        instructions: reviewSummaryInstructions(ready.storeName),
        content: reviewSummaryContent(source),
      })
      await withStore(db, storeId, (tx) =>
        saveSummary(tx, productId, {
          summary: clampSummary(output),
          reviewCount: source.reviews.length,
        }),
      )
      // Metering never fails a summary.
      await withStore(db, storeId, (tx) =>
        recordAiUsage(
          { storeId, tx },
          { month: admission.month, feature: 'productWriter', tier: admission.tier, ...usage },
        ),
      ).catch(() => undefined)
      done += 1
    } catch (err) {
      logger.warn('review summary failed', { storeId, productId, error: err })
      await withStore(db, storeId, (tx) =>
        saveSummary(tx, productId, { error: 'The AI writer could not finish this time.' }),
      )
    }
  }
  return done
}

/**
 * One repeat job walks every store with stale review summaries and, for stores that still have
 * the Reviews app installed with summaries on, writes them again. One store failing is logged
 * and skipped.
 */
export function createReviewSummarySweep(connection: IORedis, db: Db) {
  const queue = new Queue(REVIEW_SUMMARIES_QUEUE, { connection })
  const worker = new Worker(
    REVIEW_SUMMARIES_QUEUE,
    async () => {
      const storeIds = await storesWithStaleReviewSummaries(db)
      let written = 0
      for (const storeId of storeIds) {
        try {
          if (!(await installedApps(db, storeId)).includes(REVIEWS_ID)) continue
          written += await refreshStore(db, storeId)
        } catch (err) {
          logger.warn('review summary sweep failed', { storeId, error: err })
        }
      }
      if (written) logger.info('review summaries written', { written })
      return { stores: storeIds.length, written }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
