import { sendDueDailySummaries } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, storesWithMemberDailySummaries, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, MEMBER_DAILY_SUMMARY_QUEUE, Queue, Worker } from '@commerce/queue'

/** Members pick a whole hour; checking every 10 minutes sends within 10 minutes of it. */
export const DAILY_SUMMARY_EVERY_MS = 10 * 60_000

/**
 * One repeat job walks every store where someone asked for a daily summary (Account →
 * Notifications) and sends it to each member whose hour (IST) it is and who has not had
 * today's. Members are claimed before sending, so overlapping ticks never send twice. One
 * store failing is logged and skipped.
 */
export function createMemberDailySummary(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string; adminUrl: string },
) {
  const queue = new Queue(MEMBER_DAILY_SUMMARY_QUEUE, { connection })
  const worker = new Worker(
    MEMBER_DAILY_SUMMARY_QUEUE,
    async () => {
      const storeIds = await storesWithMemberDailySummaries(db)
      let sent = 0
      for (const storeId of storeIds) {
        try {
          sent += await withStore(db, storeId, async (tx) =>
            sendDueDailySummaries(
              { storeId, tx },
              {
                registry: (await registriesForStore(tx, storeId)).notifications,
                settingsSecret: opts.settingsSecret,
                adminUrl: opts.adminUrl,
              },
            ),
          )
        } catch (err) {
          logger.warn('member daily summary failed', { storeId, error: err })
        }
      }
      if (sent) logger.info('member daily summaries sent', { sent })
      return { stores: storeIds.length, sent }
    },
    { connection },
  )
  return { queue, worker }
}
