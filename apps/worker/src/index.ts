import { resolve } from 'node:path'
import { loadEnv } from '@commerce/config'
import { createRedisRateLimitStore } from '@commerce/core'
import { createDb } from '@commerce/db'
import { reportWorkerFailures } from '@commerce/observability'
import { createAppEventQueue, createNotificationQueue } from '@commerce/queue'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createAppEventWorker, createAppJobWorker } from './app-events'
import { createBackInStockWorker } from './back-in-stock'
import { createDomainPoller, VERIFY_EVERY_MS } from './domains'
import { createMarketingWorker, MARKETING_TICK_MS, retireAbandonedSweep } from './marketing'
import { createNotificationWorker } from './notifications'
import { initSentry, reportError } from './observability'
import { createOutboxRelay, RELAY_EVERY_MS } from './outbox-relay'
import { paymentWebhooks } from './payments'
import { createUnpaidOrderExpiry, EXPIRY_EVERY_MS } from './payments-expiry'
import { BALANCE_EVERY_MS, createPreorderBalanceJob } from './preorder-balance'
import { createConnection, createHeartbeat } from './queues'
import { createShippingTracker, TRACK_EVERY_MS } from './shipping'

/* The local storage provider writes relative to the admin app, which serves
   the folder; point this process at the same place for generated files. */
process.env.LOCAL_UPLOAD_ROOT ??= resolve(import.meta.dir, '../../admin')

const env = loadEnv(process.env)
initSentry(env)
const db = createDb(env.DATABASE_URL)
const redis = createConnection(env.REDIS_URL)
const { queue, worker } = createHeartbeat(redis)
const notifications = createNotificationQueue(redis)
const appEvents = createAppEventQueue(redis)
const notificationWorker = createNotificationWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
  appEvents,
})
const appEventWorker = createAppEventWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const appJobWorker = createAppJobWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})

const unpaidExpiry = createUnpaidOrderExpiry(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const preorderBalance = createPreorderBalanceJob(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const tracker = createShippingTracker(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const domains = createDomainPoller(redis, db, {
  provider: env.DOMAIN_PROVIDER,
  targets: { aRecord: env.STOREFRONT_A_RECORD, cnameTarget: env.STOREFRONT_CNAME_TARGET },
})
const marketing = createMarketingWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const backInStock = createBackInStockWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const outboxRelay = createOutboxRelay(redis, db, {
  notifications,
  appEvents,
  inventoryRestock: backInStock.queue,
})

reportWorkerFailures(worker, 'heartbeat', reportError)
reportWorkerFailures(notificationWorker, 'notifications', reportError)
reportWorkerFailures(appEventWorker, 'app-events', reportError)
reportWorkerFailures(appJobWorker, 'app-jobs', reportError)
reportWorkerFailures(tracker.worker, 'shipping-tracker', reportError)
reportWorkerFailures(unpaidExpiry.worker, 'unpaid-order-expiry', reportError)
reportWorkerFailures(preorderBalance.worker, 'preorder-balance', reportError)
reportWorkerFailures(domains.worker, 'domain-verify', reportError)
reportWorkerFailures(marketing.tick, 'marketing-tick', reportError)
reportWorkerFailures(marketing.send, 'marketing-send', reportError)
reportWorkerFailures(outboxRelay.worker, 'outbox-relay', reportError)
reportWorkerFailures(backInStock.worker, 'back-in-stock', reportError)

await queue.upsertJobScheduler('heartbeat-every-minute', { every: 60_000 }, { name: 'tick' })
await tracker.queue.upsertJobScheduler(
  'track-open-shipments',
  { every: TRACK_EVERY_MS },
  { name: 'track' },
)
await unpaidExpiry.queue.upsertJobScheduler(
  'expire-unpaid-orders',
  { every: EXPIRY_EVERY_MS },
  { name: 'expire' },
)
await preorderBalance.queue.upsertJobScheduler(
  'preorder-balance',
  { every: BALANCE_EVERY_MS },
  { name: 'balance' },
)
// Abandoned-cart recovery now runs as a Marketing automation; drop the old sweep's schedule.
await retireAbandonedSweep(redis)

await domains.queue.upsertJobScheduler(
  'verify-pending-domains',
  { every: VERIFY_EVERY_MS },
  { name: 'verify' },
)
await marketing.tickQueue.upsertJobScheduler(
  'marketing-tick',
  { every: MARKETING_TICK_MS },
  { name: 'tick' },
)
await outboxRelay.queue.upsertJobScheduler(
  'relay-outbox-events',
  { every: RELAY_EVERY_MS },
  { name: 'relay' },
)

const rateLimitStore = createRedisRateLimitStore(redis)

const app = new Hono()
app.route('/', paymentWebhooks(db, env.SETTINGS_SECRET, rateLimitStore))

app.get('/health', async (c) => {
  const [dbOk, queueOk] = await Promise.all([
    db
      .execute(sql`select 1`)
      .then(() => true)
      .catch(() => false),
    redis
      .ping()
      .then((r) => r === 'PONG')
      .catch(() => false),
  ])
  const ok = dbOk && queueOk
  return c.json({ ok, db: dbOk, queue: queueOk }, ok ? 200 : 503)
})

const shutdown = async () => {
  await worker.close()
  await notificationWorker.close()
  await appEventWorker.close()
  await appJobWorker.close()
  await tracker.worker.close()
  await tracker.queue.close()
  await unpaidExpiry.worker.close()
  await unpaidExpiry.queue.close()
  await preorderBalance.worker.close()
  await preorderBalance.queue.close()
  await domains.worker.close()
  await domains.queue.close()
  await marketing.tick.close()
  await marketing.send.close()
  await marketing.tickQueue.close()
  await marketing.sendQueue.close()
  await outboxRelay.worker.close()
  await outboxRelay.queue.close()
  await backInStock.worker.close()
  await backInStock.queue.close()
  await queue.close()
  await notifications.close()
  redis.disconnect()
  await db.$client.end()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log(`worker listening on :${env.WORKER_PORT}`)

export default { port: env.WORKER_PORT, fetch: app.fetch }
