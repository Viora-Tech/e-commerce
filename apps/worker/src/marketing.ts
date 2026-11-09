import {
  enrolDue,
  type MarketingDeps,
  processDueRuns,
  sendCampaignBatch,
  startDueCampaigns,
  storefrontOriginFor,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, type StoreTx, storesWithMarketingWork, withStore } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  ABANDONED_SWEEP_QUEUE,
  fairProcessor,
  type IORedis,
  KEEP_FINISHED,
  MARKETING_SEND_QUEUE,
  QUEUE_LIMITS,
  Queue,
  Worker,
} from '@commerce/queue'

/** How often scheduled campaigns and due automation steps are picked up. */
export const MARKETING_TICK_MS = 30_000
/** Batches one send job runs before handing back; the next tick queues the rest. */
const BATCHES_PER_JOB = 10

type SendJob = { storeId: string; campaignId: string }

type Opts = { settingsSecret: string; storefrontUrl: string }

async function depsFor(tx: StoreTx, storeId: string, opts: Opts): Promise<MarketingDeps> {
  return {
    registry: (await registriesForStore(tx, storeId)).notifications,
    settingsSecret: opts.settingsSecret,
    // Shop, click and unsubscribe links go to the store's own domain (env URL is the fallback).
    storefrontUrl: await storefrontOriginFor(tx, storeId, opts.storefrontUrl),
  }
}

/**
 * The hourly abandoned-cart sweep is replaced by the abandoned-checkout
 * automation (migration 0051 moved opted-in stores across). Its repeat
 * schedule lives in Redis, so it is removed explicitly once.
 */
export async function retireAbandonedSweep(connection: IORedis): Promise<void> {
  const queue = new Queue(ABANDONED_SWEEP_QUEUE, { connection })
  try {
    await queue.removeJobScheduler('sweep-abandoned-carts')
  } finally {
    await queue.close()
  }
}

/**
 * Marketing runs on two queues. A repeat tick finds stores with work (via a
 * SECURITY DEFINER lookup that returns ids only), then per store: starts
 * campaigns whose time has come, enrols shoppers into automations (quiet
 * baskets, lapsed customers) and advances due automation runs. Campaign
 * recipients are sent by `{marketing}-send` jobs in batches, each in its own
 * store-scoped transaction, so a crash loses at most one batch and SKIP
 * LOCKED keeps two workers apart.
 */
export function createMarketingWorker(connection: IORedis, db: Db, opts: Opts) {
  const sendQueue = new Queue<SendJob>(MARKETING_SEND_QUEUE, { connection })

  const tick = async () => {
    const storeIds = await storesWithMarketingWork(db)
    let queued = 0
    let enrolled = 0
    let steps = 0
    for (const storeId of storeIds) {
      try {
        const sending = await withStore(db, storeId, (tx) =>
          startDueCampaigns(tx, storeId, opts.settingsSecret),
        )
        for (const campaignId of sending) {
          await sendQueue.add(
            'batch',
            { storeId, campaignId },
            { jobId: `campaign-${campaignId}`, removeOnComplete: true, removeOnFail: true },
          )
          queued += 1
        }
        enrolled += await withStore(db, storeId, (tx) => enrolDue(tx, storeId, opts.settingsSecret))
        const r = await withStore(db, storeId, async (tx) =>
          processDueRuns(tx, storeId, await depsFor(tx, storeId, opts)),
        )
        steps += r.processed
      } catch (err) {
        logger.warn('marketing tick failed', { storeId, error: err })
      }
    }
    return { stores: storeIds.length, queued, enrolled, steps }
  }

  const send = new Worker<SendJob>(
    MARKETING_SEND_QUEUE,
    fairProcessor(connection, MARKETING_SEND_QUEUE, QUEUE_LIMITS.marketingSend, async (job) => {
      const { storeId, campaignId } = job.data
      let sent = 0
      let failed = 0
      for (let i = 0; i < BATCHES_PER_JOB; i++) {
        const r = await withStore(db, storeId, async (tx) =>
          sendCampaignBatch(tx, storeId, await depsFor(tx, storeId, opts), campaignId),
        )
        sent += r.sent
        failed += r.failed
        if (r.done) break
      }
      // The job's wide event carries these counts as `result`, with storeId and campaignId.
      return { sent, failed }
    }),
    { connection, concurrency: QUEUE_LIMITS.marketingSend.concurrency, ...KEEP_FINISHED },
  )

  return { sendQueue, tick, send }
}
