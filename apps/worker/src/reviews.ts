import { installedApps } from '@commerce/core'
import { type Db, storesWithDueReviewRequests, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  loadReviewsSettings,
  queueDueReviewRequests,
  REVIEWS_ID,
} from '@commerce/plugin-reviews/server'
import { type IORedis, Queue, REVIEW_REQUESTS_QUEUE, Worker } from '@commerce/queue'

/** Requests go out days after delivery; ten minutes of slack is plenty. */
export const REVIEW_REQUESTS_EVERY_MS = 10 * 60_000

/**
 * One repeat job walks every store with review requests or reminders due (Reviews app) and,
 * for stores that still have the app installed, writes one `review.request_due` outbox row
 * per order; the outbox relay queues the email and the notifications worker sends it. Rows
 * are marked in the same transaction, so a tick that overlaps another sends nothing twice.
 * One store failing is logged and skipped.
 */
export function createReviewRequestSweep(connection: IORedis, db: Db) {
  const queue = new Queue(REVIEW_REQUESTS_QUEUE, { connection })
  const worker = new Worker(
    REVIEW_REQUESTS_QUEUE,
    async () => {
      const storeIds = await storesWithDueReviewRequests(db)
      const counts = { requests: 0, reminders: 0 }
      for (const storeId of storeIds) {
        try {
          if (!(await installedApps(db, storeId)).includes(REVIEWS_ID)) continue
          const r = await withStore(db, storeId, async (tx) =>
            queueDueReviewRequests(tx, storeId, await loadReviewsSettings(tx, storeId)),
          )
          counts.requests += r.requests
          counts.reminders += r.reminders
        } catch (err) {
          logger.warn('review request sweep failed', { storeId, error: err })
        }
      }
      if (counts.requests || counts.reminders) logger.info('review requests queued', counts)
      return { stores: storeIds.length, ...counts }
    },
    { connection },
  )
  return { queue, worker }
}
