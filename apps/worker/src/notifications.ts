import {
  builtInNotificationRegistry,
  deliverNotification,
  NOTIFICATIONS_QUEUE,
  type NotificationJob,
} from '@commerce/core'
import { type Db, withStore } from '@commerce/db'
import { sesFactory } from '@commerce/notifications-ses'
import { whatsappFactory } from '@commerce/notifications-whatsapp'
import { type IORedis, Worker } from '@commerce/queue'

export const notificationRegistry = builtInNotificationRegistry()
  .register(sesFactory)
  .register(whatsappFactory)

/**
 * Consumes {storeId, orderId, template} jobs. A job succeeds only when every
 * enabled channel with a recipient sent; otherwise it throws so BullMQ retries
 * with backoff, and deliverNotification skips the channels that already went.
 */
export function createNotificationWorker(
  connection: IORedis,
  db: Db,
  opts: { settingsSecret: string; storefrontUrl?: string | undefined },
) {
  return new Worker<NotificationJob>(
    NOTIFICATIONS_QUEUE,
    async (job) => {
      const { storeId, orderId, template } = job.data
      const results = await withStore(db, storeId, (tx) =>
        deliverNotification(
          { storeId, tx },
          { orderId, template },
          {
            registry: notificationRegistry,
            settingsSecret: opts.settingsSecret,
            storefrontUrl: opts.storefrontUrl,
          },
        ),
      )
      const failed = results.filter((r) => !r.ok)
      for (const r of results) {
        console.log(
          `[notification] ${template} order=${orderId} ${r.channel}→${r.to} ${r.ok ? 'sent' : `failed: ${r.error}`}`,
        )
      }
      if (failed.length > 0) {
        throw new Error(failed.map((r) => `${r.channel}: ${r.error}`).join('; '))
      }
      return results
    },
    { connection, concurrency: 5 },
  )
}
