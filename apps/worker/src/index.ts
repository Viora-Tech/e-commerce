import { resolve } from 'node:path'
import { loadEnv } from '@commerce/config'
import { createDb } from '@commerce/db'
import { createAppEventQueue, createNotificationQueue } from '@commerce/queue'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createAppEventWorker, createAppJobWorker } from './app-events'
import { createDomainPoller, VERIFY_EVERY_MS } from './domains'
import { createMarketingWorker, MARKETING_TICK_MS, retireAbandonedSweep } from './marketing'
import { createNotificationWorker } from './notifications'
import { paymentWebhooks } from './payments'
import { createConnection, createHeartbeat } from './queues'
import { createShippingTracker, TRACK_EVERY_MS } from './shipping'

/* The local storage provider writes relative to the admin app, which serves
   the folder; point this process at the same place for generated files. */
process.env.LOCAL_UPLOAD_ROOT ??= resolve(import.meta.dir, '../../admin')

const env = loadEnv(process.env)
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

const tracker = createShippingTracker(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const domains = createDomainPoller(redis, db, {
  provider: env.DOMAIN_PROVIDER,
  targets: { aRecord: env.STOREFRONT_A_RECORD, cnameTarget: env.STOREFRONT_CNAME_TARGET },
})
const marketing = createMarketingWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})

await queue.upsertJobScheduler('heartbeat-every-minute', { every: 60_000 }, { name: 'tick' })
await tracker.queue.upsertJobScheduler(
  'track-open-shipments',
  { every: TRACK_EVERY_MS },
  { name: 'track' },
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

const app = new Hono()
app.route('/', paymentWebhooks(db, env.SETTINGS_SECRET, notifications))

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
  await domains.worker.close()
  await domains.queue.close()
  await marketing.tick.close()
  await marketing.send.close()
  await marketing.tickQueue.close()
  await marketing.sendQueue.close()
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
