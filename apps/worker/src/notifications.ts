import {
  type AppEventQueue,
  appEventForTemplate,
  deliverNotification,
  enqueueAppEvent,
  fulfilGiftCardsForOrder,
  NOTIFICATIONS_QUEUE,
  type NotificationJob,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, withStore } from '@commerce/db'
import { type IORedis, Worker } from '@commerce/queue'
import { appEmailExtras } from './app-events'

/**
 * Consumes {storeId, orderId, template} jobs. A job succeeds only when every
 * enabled channel with a recipient sent; otherwise it throws so BullMQ retries
 * with backoff, and deliverNotification skips the channels that already went.
 */
export function createNotificationWorker(
  connection: IORedis,
  db: Db,
  opts: {
    settingsSecret: string
    storefrontUrl?: string | undefined
    /** Order paid/shipped notifications double as the app lifecycle events. */
    appEvents?: AppEventQueue | undefined
  },
) {
  return new Worker<NotificationJob>(
    NOTIFICATIONS_QUEUE,
    async (job) => {
      const { storeId, orderId, template } = job.data
      const event = appEventForTemplate(template)
      // Queued before delivery: a channel failure retries this job, and the app
      // event's own job id makes the repeat a no-op.
      if (event && opts.appEvents) {
        await enqueueAppEvent(opts.appEvents, { storeId, event, orderId })
      }
      // A paid order that bought gift cards issues them and emails the codes. Idempotent,
      // so a retry of this job only sends codes that have not gone out yet.
      if (template === 'payment_received') {
        const cards = await withStore(db, storeId, async (tx) =>
          fulfilGiftCardsForOrder({ storeId, tx }, orderId, {
            registry: (await registriesForStore(tx, storeId)).notifications,
            secret: opts.settingsSecret,
          }),
        )
        for (const d of cards.deliveries) {
          console.log(
            `[gift-card] order=${orderId} ${d.channel}→${d.to} ${d.ok ? 'sent' : `failed: ${d.error}`}`,
          )
        }
        // A failed gift card email never blocks the order emails; the merchant can resend
        // it from the gift card page, and the next payment_received retry tries again.
      }
      const results = await withStore(db, storeId, async (tx) =>
        deliverNotification(
          { storeId, tx },
          { orderId, template },
          {
            registry: (await registriesForStore(tx, storeId)).notifications,
            settingsSecret: opts.settingsSecret,
            storefrontUrl: opts.storefrontUrl,
            extras: appEmailExtras(db, opts, storeId),
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
