import {
  creditDueEntry,
  deliverEmailTo,
  duePointEntryIds,
  grantBirthdayPoints,
  grantReviewPoints,
  loyaltyState,
  markLoyaltyEmailsSent,
  runLoyaltySweepSteps,
  storefrontOriginFor,
  unsentLoyaltyEmails,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { dayStart, formatInZone } from '@commerce/dates'
import { type Db, storesWithLoyaltyPoints, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'

/** Points land by the day (return windows, birthdays, expiry), so hourly is plenty. */
export const LOYALTY_POINTS_EVERY_MS = 60 * 60 * 1000

type LoyaltyOpts = { settingsSecret: string; storefrontUrl?: string | undefined }

/**
 * One repeat job visits every store with the Loyalty points app (`stores_with_loyalty_points`,
 * ids only) and, per store under RLS: makes the review and birthday entries that are due (each
 * once, by unique index), credits every pending entry whose time has come (each in its own
 * transaction, so one customer at the ₹2,00,000 cap never blocks the rest), runs the v2 steps
 * (`runLoyaltySweepSteps`), then sends the queued "points expiring" emails (30 and 7 days before)
 * and marks them sent. A rerun finds nothing left to do. One
 * store or entry failing is logged and skipped; the next tick tries again.
 */
export function createLoyaltySweep(db: Db, opts: LoyaltyOpts) {
  const runStore = async (storeId: string, now: Date) => {
    const counts = { granted: 0, credited: 0, cancelled: 0, reminded: 0 }
    const settings = await withStore(db, storeId, async (tx) => {
      const state = await loyaltyState(tx, storeId)
      if (!state.installed) return null
      const ctx = { storeId, tx }
      counts.granted += await grantReviewPoints(ctx, state.settings, now)
      counts.granted += await grantBirthdayPoints(ctx, state.settings, now)
      return state.settings
    })
    if (!settings) return counts
    const ids = await withStore(db, storeId, (tx) => duePointEntryIds({ storeId, tx }, now))
    for (const id of ids) {
      try {
        const done = await withStore(db, storeId, (tx) =>
          creditDueEntry({ storeId, tx }, id, settings, now),
        )
        if (done === 'credited') counts.credited += 1
        if (done === 'cancelled') counts.cancelled += 1
      } catch (err) {
        logger.warn('loyalty points credit failed', { storeId, entryId: id, error: err })
      }
    }
    // v2: rules from v1 settings, anniversaries, referrals past their hold, expired points,
    // expired codes, the expiry emails queued, tiers once a day.
    await withStore(db, storeId, (tx) => runLoyaltySweepSteps({ storeId, tx }, settings, now))
    counts.reminded += await withStore(db, storeId, async (tx) => {
      const ctx = { storeId, tx }
      // Only `points_expiring` has a template in packages/notifications so far; the other
      // loyalty emails stay queued until theirs exist (docs/loyalty-v2-interfaces.md).
      const due = await unsentLoyaltyEmails(ctx, { templates: ['points_expiring'] })
      if (due.length === 0) return 0
      const fallback = opts.storefrontUrl ?? ''
      const base = (await storefrontOriginFor(tx, storeId, fallback)).replace(/\/+$/, '')
      const registry = (await registriesForStore(tx, storeId)).notifications
      let sent = 0
      for (const r of due) {
        const data = r.data as { expiringPoints: number; lastDay: string; balancePoints: number }
        if (r.email) {
          await deliverEmailTo(
            ctx,
            'points_expiring',
            r.email,
            {
              customerName: r.name?.split(' ')[0] || 'there',
              actionUrl: base ? `${base}/account/points` : undefined,
              points: {
                expiringPoints: data.expiringPoints,
                lastDay: formatInZone(dayStart(data.lastDay), {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                }),
                balancePoints: data.balancePoints,
              },
            },
            { registry, settingsSecret: opts.settingsSecret },
          )
          sent += 1
        }
        await markLoyaltyEmailsSent(ctx, [r.id], now)
      }
      return sent
    })
    return counts
  }

  const run = async () => {
    const now = new Date()
    const storeIds = await storesWithLoyaltyPoints(db)
    const total = { granted: 0, credited: 0, cancelled: 0, reminded: 0 }
    for (const storeId of storeIds) {
      try {
        const c = await runStore(storeId, now)
        total.granted += c.granted
        total.credited += c.credited
        total.cancelled += c.cancelled
        total.reminded += c.reminded
      } catch (err) {
        logger.warn('loyalty points sweep failed', { storeId, error: err })
      }
    }
    if (total.granted || total.credited || total.cancelled || total.reminded) {
      logger.info('loyalty points', total)
    }
    return { stores: storeIds.length, ...total }
  }
  return { run }
}
