import {
  type ChannelDeps,
  type ChannelSyncJob,
  channelApps,
  syncChannelProvider,
} from '@commerce/core'
import { type Db, storesWithChannelConnections } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { CHANNEL_SYNC_QUEUE, type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'

export { CHANNEL_SYNC_EVERY_MS } from '@commerce/core'

const PROVIDERS = ['meta', 'google', 'openai'] as const

/**
 * Sales channels: a sweep every few hours queues one sync per store and platform, and the admin
 * queues one after Connect and on "Sync now". Each sync sends only what changed and moves the
 * channels on that platform through syncing → connected (or error / expired).
 */
export function createChannelSync(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string; adminUrl: string; storefrontUrl: string },
) {
  const queue = new Queue<ChannelSyncJob>(CHANNEL_SYNC_QUEUE, { connection })
  const deps: ChannelDeps = {
    fetch,
    secret: opts.settingsSecret,
    ...channelApps(process.env),
    adminUrl: opts.adminUrl,
    storefrontUrl: opts.storefrontUrl,
  }
  const worker = new Worker<ChannelSyncJob>(
    CHANNEL_SYNC_QUEUE,
    async (job) => {
      if ('sweep' in job.data) {
        const stores = await storesWithChannelConnections(db)
        for (const storeId of stores)
          for (const provider of PROVIDERS)
            await queue.add(
              'sync',
              { storeId, provider },
              {
                jobId: `channel-sync:${storeId}:${provider}`,
                removeOnComplete: true,
              },
            )
        return { stores: stores.length }
      }
      const r = await syncChannelProvider(db, job.data.storeId, job.data.provider, deps)
      if (r.state !== 'skipped')
        logger.info('channel synced', {
          area: 'sales-channels',
          storeId: job.data.storeId,
          provider: job.data.provider,
          ...r,
        })
      return r
    },
    { connection, concurrency: 2, ...KEEP_FINISHED },
  )
  return { queue, worker }
}
