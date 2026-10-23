import { deliverEmailTo, installedApps, storefrontOriginFor } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, storesWithDueAffiliateCommissions, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  AFFILIATES_ID,
  type AffiliateNotice,
  affiliateEmail,
  approveDueCommissions,
  loadAffiliateSettings,
} from '@commerce/plugin-affiliates/server'
import {
  AFFILIATE_COMMISSIONS_QUEUE,
  type IORedis,
  KEEP_FINISHED,
  Queue,
  Worker,
} from '@commerce/queue'

/**
 * Sends one `affiliate_update` email (approved, a new sale, a payout) to the affiliate, with
 * links on the store's own domain. Nothing to send (no email, the commission reversed) is [].
 */
export async function deliverAffiliateUpdate(
  db: Db,
  storeId: string,
  input: {
    affiliateId: string
    notice: AffiliateNotice
    commissionId?: string | undefined
    payoutId?: string | undefined
    settingsSecret: string
    storefrontUrl: string
  },
) {
  return withStore(db, storeId, async (tx) => {
    const email = await affiliateEmail(tx, {
      affiliateId: input.affiliateId,
      notice: input.notice,
      commissionId: input.commissionId,
      payoutId: input.payoutId,
      storefrontUrl: input.storefrontUrl
        ? await storefrontOriginFor(tx, storeId, input.storefrontUrl)
        : '',
    })
    if (!email) return []
    return deliverEmailTo({ storeId, tx }, 'affiliate_update', email.to, email.data, {
      registry: (await registriesForStore(tx, storeId)).notifications,
      settingsSecret: input.settingsSecret,
    })
  })
}

/** Holds are counted in days; an hourly pass is plenty. */
export const AFFILIATE_COMMISSIONS_EVERY_MS = 60 * 60_000

/**
 * One repeat job walks every store with affiliate commissions whose hold is over (Affiliates
 * app) and, where the app is still installed, approves them with their TDS. Each approval
 * writes `affiliate.commission_approved` in the same transaction, for the Automations app.
 * One store failing is logged and skipped.
 */
export function createAffiliateCommissionSweep(connection: IORedis, db: Db) {
  const queue = new Queue(AFFILIATE_COMMISSIONS_QUEUE, { connection })
  const worker = new Worker(
    AFFILIATE_COMMISSIONS_QUEUE,
    async () => {
      const storeIds = await storesWithDueAffiliateCommissions(db)
      const counts = { approved: 0, reversed: 0 }
      for (const storeId of storeIds) {
        try {
          if (!(await installedApps(db, storeId)).includes(AFFILIATES_ID)) continue
          const r = await withStore(db, storeId, async (tx) =>
            approveDueCommissions(tx, storeId, await loadAffiliateSettings(tx, storeId)),
          )
          counts.approved += r.approved
          counts.reversed += r.reversed
        } catch (err) {
          logger.warn('affiliate commission sweep failed', { storeId, error: err })
        }
      }
      if (counts.approved || counts.reversed) logger.info('affiliate commissions', counts)
      return { stores: storeIds.length, ...counts }
    },
    { connection, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
