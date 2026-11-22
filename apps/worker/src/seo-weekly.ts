import { registriesForStore } from '@commerce/core/registries'
import { sendSeoWeeklyEmail } from '@commerce/core/seo-assistant-service'
import { type Db, storesWithSearchConsoleConnected, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/** The SEO email goes from 9:00 IST on Monday; checking every 10 minutes sends within 10 minutes of it. */
export const SEO_WEEKLY_EVERY_MS = 10 * 60_000

/**
 * One repeat job walks every store with Google Search Console connected and, on Monday from
 * 9:00 IST, sends the owner the weekly SEO email (pages that moved, the top three suggestions).
 * The week is claimed by a `seo_weekly_snapshot` row first, so overlapping ticks send once.
 * Same pattern as the member reports (`member-reports.ts`). One store failing is logged and
 * skipped.
 */
export function createSeoWeeklyEmail(db: Db, opts: { settingsSecret: string; adminUrl: string }) {
  const run = async (now: Date = new Date()) => {
    const storeIds = await storesWithSearchConsoleConnected(db)
    let sent = 0
    for (const storeId of storeIds) {
      try {
        const result = await withStore(db, storeId, async (tx) =>
          sendSeoWeeklyEmail(
            { storeId, tx },
            {
              registry: (await registriesForStore(tx, storeId)).notifications,
              settingsSecret: opts.settingsSecret,
              adminUrl: opts.adminUrl,
              now,
            },
          ),
        )
        if (result === 'sent') sent += 1
      } catch (err) {
        logger.warn('seo weekly email failed', { storeId, error: err })
      }
    }
    if (sent) logger.info('seo weekly emails sent', { sent })
    return { stores: storeIds.length, sent }
  }
  return { run }
}
