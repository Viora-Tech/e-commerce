import { loadEnv } from '@commerce/config'
import { createDb } from '@commerce/db'
import { createNotificationQueue } from '@commerce/queue'
import { sql } from 'drizzle-orm'
import { Hono } from 'hono'
import { createNotificationWorker } from './notifications'
import { paymentWebhooks } from './payments'
import { createConnection, createHeartbeat } from './queues'

const env = loadEnv(process.env)
const db = createDb(env.DATABASE_URL)
const redis = createConnection(env.REDIS_URL)
const { queue, worker } = createHeartbeat(redis)
const notifications = createNotificationQueue(redis)
const notificationWorker = createNotificationWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})

await queue.upsertJobScheduler('heartbeat-every-minute', { every: 60_000 }, { name: 'tick' })

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
