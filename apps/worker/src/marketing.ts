import { type MarketingDeps, sendCampaignBatch, startDueCampaigns } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, type StoreTx, storesWithMarketingWork, withStore } from '@commerce/db'
import {
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
 * Marketing runs on two queues. A repeat tick finds stores with work (via a
 * SECURITY DEFINER lookup that returns ids only), starts campaigns whose time
 * has come and queues one send job per sending campaign. Send jobs work
 * through recipients in batches, each in its own store-scoped transaction,
 * so a crash loses at most one batch and SKIP LOCKED keeps two workers apart.
 */
export function createMarketingWorker(connection: IORedis, db: Db, opts: Opts) {
  const tickQueue = new Queue(MARKETING_TICK_QUEUE, { connection })
  const sendQueue = new Queue<SendJob>(MARKETING_SEND_QUEUE, { connection })

  const tick = new Worker(
    MARKETING_TICK_QUEUE,
    async () => {
      const storeIds = await storesWithMarketingWork(db)
      let queued = 0
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
        } catch (err) {
          console.warn(`[marketing] tick for store ${storeId} failed:`, err)
        }
      }
      return { stores: storeIds.length, queued }
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
