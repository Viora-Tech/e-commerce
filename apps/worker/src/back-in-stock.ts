import { storeNotificationChannels } from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, product, variant, withStore } from '@commerce/db'
import {
  availableStockFor,
  BACK_IN_STOCK_QUEUE,
  loadPlatformQuota,
  loadStoreSettings,
  type RestockJob,
  sendRestockAlerts,
} from '@commerce/plugin-back-in-stock'
import { fairProcessor, type IORedis, QUEUE_LIMITS, Queue, Worker } from '@commerce/queue'
import { eq } from 'drizzle-orm'

export type BackInStockOpts = {
  settingsSecret: string
  storefrontUrl: string | null
}

/**
 * One job per `inventory.restocked` outbox row (see `apps/worker/src/outbox-relay.ts`,
 * which posts here via `inventoryRestock`). Sends exactly one alert per
 * confirmed signup on the restocked variant, throttled and metered; a store
 * over its free quota is skipped and picked up again by the next restock (or
 * a manual retry from the admin), never charged, since pay-as-you-go billing
 * does not exist yet.
 */
export function createBackInStockWorker(connection: IORedis, db: Db, opts: BackInStockOpts) {
  const queue = new Queue<RestockJob>(BACK_IN_STOCK_QUEUE, { connection })
  const quota = loadPlatformQuota(process.env)
  const worker = new Worker<RestockJob>(
    BACK_IN_STOCK_QUEUE,
    fairProcessor(connection, BACK_IN_STOCK_QUEUE, QUEUE_LIMITS.backInStock, async (job) => {
      const { storeId, variantId } = job.data
      const [settings, all] = await withStore(db, storeId, async (tx) => {
        const registries = await registriesForStore(tx, storeId)
        return [
          await loadStoreSettings(tx, storeId),
          await storeNotificationChannels(tx, storeId, {
            registry: registries.notifications,
            settingsSecret: opts.settingsSecret,
          }),
        ] as const
      })
      const channels = all.filter(
        (c) =>
          (c.requires === 'email' && settings.emailEnabled) ||
          (c.requires === 'phone' && settings.whatsappEnabled),
      )
      if (channels.length === 0)
        return { sent: 0, skippedQuota: 0, failed: 0, stoppedForStock: false }

      const [productTitle, variantTitle] = await withStore(db, storeId, async (tx) => {
        const [row] = await tx
          .select({ productTitle: product.title, variantTitle: variant.title })
          .from(variant)
          .innerJoin(product, eq(product.id, variant.productId))
          .where(eq(variant.id, variantId))
        return [
          row?.productTitle ?? '',
          row?.variantTitle === 'Default' ? undefined : row?.variantTitle,
        ]
      })

      return sendRestockAlerts(
        {
          inStore: (fn) => withStore(db, storeId, fn),
          channels,
          quota,
          unlimited: settings.unlimited,
          batchSize: settings.batchSize,
          availableStock: (vId) => withStore(db, storeId, (tx) => availableStockFor(tx, vId)),
          buildMessage: (row, _channel) => ({
            data: {
              storeName: '',
              customerName: '',
              totalLabel: '',
              lines: [],
              paymentMethodLabel: '',
              backInStock: {
                productTitle,
                variantTitle,
                productUrl: opts.storefrontUrl ?? undefined,
                unsubscribeUrl: `${opts.storefrontUrl ?? ''}/back-in-stock/unsubscribe/${row.unsubscribeToken}`,
              },
            },
          }),
          log: (message) => console.log(`[back-in-stock] ${message}`),
        },
        storeId,
        variantId,
      )
    }),
    { connection, concurrency: QUEUE_LIMITS.backInStock.concurrency },
  )
  return { queue, worker }
}
