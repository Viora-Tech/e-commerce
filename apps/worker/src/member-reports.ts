import { MEMBER_REPORTS, sendDueReports } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, storesWithMemberReports, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/** Reports go from 9:00 IST on their day; checking every 10 minutes sends within 10 minutes of it. */
export const MEMBER_REPORTS_EVERY_MS = 10 * 60_000

/**
 * One repeat job walks every store where someone turned on the weekly or monthly report
 * (Account → Notifications). The weekly goes on Monday, the monthly on the 1st, from 9:00 IST,
 * once per member and period: members are claimed before sending, so overlapping ticks never
 * send twice. Same pattern as the daily summary (`member-daily-summary.ts`). One store failing
 * is logged and skipped.
 */
export function createMemberReports(db: Db, opts: { settingsSecret: string; adminUrl: string }) {
  const run = async (now: Date = new Date()) => {
    const storeIds = await storesWithMemberReports(db)
    let sent = 0
    for (const storeId of storeIds) {
      for (const report of MEMBER_REPORTS) {
        try {
          sent += await withStore(db, storeId, async (tx) =>
            sendDueReports({ storeId, tx }, report, {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
              adminUrl: opts.adminUrl,
              now,
            }),
          )
        } catch (err) {
          logger.warn('member report failed', { storeId, report, error: err })
        }
      }
    }
    if (sent) logger.info('member reports sent', { sent })
    return { stores: storeIds.length, sent }
  }
  return { run }
}
