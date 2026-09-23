import {
  enrolDue,
  type MarketingDeps,
  processDueRuns,
  sendCampaignBatch,
  startDueCampaigns,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, type StoreTx, storesWithMarketingWork, withStore } from '@commerce/db'
import {
  ABANDONED_SWEEP_QUEUE,
  type IORedis,
  MARKETING_SEND_QUEUE,
  MARKETING_TICK_QUEUE,
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
    storefrontUrl: opts.storefrontUrl,
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
  const tickQueue = new Queue(MARKETING_TICK_QUEUE, { connection })
  const sendQueue = new Queue<SendJob>(MARKETING_SEND_QUEUE, { connection })

  const tick = new Worker(
    MARKETING_TICK_QUEUE,
    async () => {
      const storeIds = await storesWithMarketingWork(db)
      let queued = 0
      let enrolled = 0
      let steps = 0
      for (const storeId of storeIds) {
        try {
          const sending = await withStore(db, storeId, (tx) => startDueCampaigns(tx, storeId))
          for (const campaignId of sending) {
            await sendQueue.add(
              'batch',
              { storeId, campaignId },
              { jobId: `campaign-${campaignId}`, removeOnComplete: true, removeOnFail: true },
            )
            queued += 1
          }
          enrolled += await withStore(db, storeId, (tx) => enrolDue(tx, storeId))
          const r = await withStore(db, storeId, async (tx) =>
            processDueRuns(tx, storeId, await depsFor(tx, storeId, opts)),
          )
          steps += r.processed
        } catch (err) {
          console.warn(`[marketing] tick for store ${storeId} failed:`, err)
        }
      }
      return { stores: storeIds.length, queued, enrolled, steps }
    },
    { connection },
  )

  const send = new Worker<SendJob>(
    MARKETING_SEND_QUEUE,
    async (job) => {
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
      console.log(`[marketing] campaign ${campaignId}: ${sent} sent, ${failed} failed`)
      return { sent, failed }
    },
    { connection, concurrency: 2 },
  )

  return { tickQueue, sendQueue, tick, send }
}
