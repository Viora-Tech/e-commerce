import { resolve } from 'node:path'
import { loadEnv } from '@commerce/config'
import { createRedisRateLimitStore, dokployConfigFrom, platformRoots } from '@commerce/core'
import { createDb } from '@commerce/db'
import { reportWorkerFailures } from '@commerce/observability'
import { flushLogs, initLogging, logger, logWorkerJobs } from '@commerce/observability/logging'
import { createAppEventQueue, createNotificationQueue, trimFinishedJobs } from '@commerce/queue'
import { sql } from 'drizzle-orm'
import { evlog } from 'evlog/hono'
import { Hono } from 'hono'
import { createAiBulkWriteWorker } from './ai-bulk-write'
import { API_ACTIVITY_PRUNE_EVERY_MS, createApiActivityPrune } from './api-activity'
import { createAppEventWorker, createAppJobWorker } from './app-events'
import { createBackInStockWorker } from './back-in-stock'
import { BILLING_EVERY_MS, createBillingSweep } from './billing'
import { CHANNEL_SYNC_EVERY_MS, createChannelSync } from './channel-sync'
import {
  CERTIFICATE_EVERY_MS,
  createCertificateSweep,
  createDomainPoller,
  createDomainRouteWorker,
  VERIFY_EVERY_MS,
} from './domains'
import { createImportSnapshotCleanup, SNAPSHOT_CLEANUP_EVERY_MS } from './import-snapshots'
import { createMarketingWorker, MARKETING_TICK_MS, retireAbandonedSweep } from './marketing'
import { mediaProcessLimits } from './media-limits'
import { createMediaProcessWorker } from './media-process'
import { createMemberDailySummary, DAILY_SUMMARY_EVERY_MS } from './member-daily-summary'
import { createNotificationWorker } from './notifications'
import { initSentry, reportError } from './observability'
import { createOutboxRelay, RELAY_EVERY_MS } from './outbox-relay'
import { createPaymentFeeSync, PAYMENT_FEES_EVERY_MS } from './payment-fees'
import { paymentWebhooks } from './payments'
import { createUnpaidOrderExpiry, EXPIRY_EVERY_MS } from './payments-expiry'
import { BALANCE_EVERY_MS, createPreorderBalanceJob } from './preorder-balance'
import { createPurchaseDocumentWorker } from './purchase-documents'
import { createConnection, createHeartbeat } from './queues'
import { createReviewRequestSweep, REVIEW_REQUESTS_EVERY_MS } from './reviews'
import { createSearchConsoleSweep, SEARCH_CONSOLE_EVERY_MS } from './search-console'
import { createSenderEmailPoller, SENDER_CHECK_EVERY_MS } from './sender-email'
import { shipmentWebhooks } from './shipments-webhook'
import { createShippingTracker, TRACK_EVERY_MS } from './shipping'
import { createStoreExportWorker } from './store-export'

/* The local storage provider writes relative to the admin app, which serves
   the folder; point this process at the same place for generated files. */
process.env.LOCAL_UPLOAD_ROOT ??= resolve(import.meta.dir, '../../admin')

const env = loadEnv(process.env)
initLogging('worker', env)
initSentry(env)
const db = createDb(env.DATABASE_URL, { pooled: env.DATABASE_POOLED })
const redis = createConnection(env.REDIS_URL)
const { queue, worker } = createHeartbeat(redis)
const notifications = createNotificationQueue(redis)
const appEvents = createAppEventQueue(redis)
// STOREFRONT_URL below is only the fallback: every job links to its store's own live primary
// domain (`storefrontOriginFor`), since one storefront serves every store by hostname.
const notificationWorker = createNotificationWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
  appEvents,
  adminUrl: env.ADMIN_URL,
})
const appEventWorker = createAppEventWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const mediaProcess = createMediaProcessWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  limits: mediaProcessLimits(env),
})
const appJobWorker = createAppJobWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
  mediaProcess: mediaProcess.queue,
})

const unpaidExpiry = createUnpaidOrderExpiry(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const preorderBalance = createPreorderBalanceJob(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const paymentFees = createPaymentFeeSync(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const tracker = createShippingTracker(redis, db, { settingsSecret: env.SETTINGS_SECRET })
// Unset Dokploy keys: no routes are asked for and every route job is a no-op (added by hand).
const dokploy = dokployConfigFrom(env)
const domainTargets = { aRecord: env.STOREFRONT_A_RECORD, cnameTarget: env.STOREFRONT_CNAME_TARGET }
const domainGuard = {
  platformRoots: platformRoots(env),
  cnameTarget: env.STOREFRONT_CNAME_TARGET,
  storeDomain: env.PLATFORM_STORE_DOMAIN,
}
const domains = createDomainPoller(redis, db, {
  provider: env.DOMAIN_PROVIDER,
  targets: domainTargets,
  requestRoutes: dokploy !== null,
})
const domainRoutes = createDomainRouteWorker(redis, db, {
  dokploy,
  guard: domainGuard,
  targets: domainTargets,
})
const certificates = createCertificateSweep(redis, db, {
  dokploy,
  guard: domainGuard,
  targets: domainTargets,
})
const senderEmails = createSenderEmailPoller(redis, db)
const marketing = createMarketingWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const backInStock = createBackInStockWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const storeExport = createStoreExportWorker(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const aiBulkWrite = createAiBulkWriteWorker(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const purchaseDocuments = createPurchaseDocumentWorker(redis, db)
const importSnapshots = createImportSnapshotCleanup(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
})
const reviewRequests = createReviewRequestSweep(redis, db)
const memberDailySummary = createMemberDailySummary(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  adminUrl: env.ADMIN_URL,
})
const searchConsole = createSearchConsoleSweep(redis, db)
const billing = createBillingSweep(redis, db, {
  salesStoreId: env.PLATFORM_SALES_STORE_ID,
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const apiActivityPrune = createApiActivityPrune(redis, db)
const channelSync = createChannelSync(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  adminUrl: env.ADMIN_URL,
  storefrontUrl: env.STOREFRONT_URL,
})
const outboxRelay = createOutboxRelay(redis, db, {
  notifications,
  appEvents,
  inventoryRestock: backInStock.queue,
  domainRoutes: domainRoutes.queue,
})

// Each worker reports its failures to Sentry and logs one wide event per job (docs/ops/logging.md).
const watched = [
  [worker, 'heartbeat'],
  [notificationWorker, 'notifications'],
  [appEventWorker, 'app-events'],
  [appJobWorker, 'app-jobs'],
  [tracker.worker, 'shipping-tracker'],
  [unpaidExpiry.worker, 'unpaid-order-expiry'],
  [preorderBalance.worker, 'preorder-balance'],
  [paymentFees.worker, 'payment-fees'],
  [domains.worker, 'domain-verify'],
  [domainRoutes.worker, 'domain-route'],
  [certificates.worker, 'domain-certificate'],
  [senderEmails.worker, 'sender-email-verify'],
  [marketing.tick, 'marketing-tick'],
  [marketing.send, 'marketing-send'],
  [outboxRelay.worker, 'outbox-relay'],
  [backInStock.worker, 'back-in-stock'],
  [mediaProcess.worker, 'media-process'],
  [storeExport.worker, 'store-export'],
  [aiBulkWrite.worker, 'ai-bulk-write'],
  [purchaseDocuments.worker, 'purchase-documents'],
  [importSnapshots.worker, 'import-snapshot-cleanup'],
  [reviewRequests.worker, 'review-requests'],
  [memberDailySummary.worker, 'member-daily-summary'],
  [searchConsole.worker, 'search-console-sweep'],
  [billing.worker, 'billing-sweep'],
  [apiActivityPrune.worker, 'api-activity-prune'],
  [channelSync.worker, 'channel-sync'],
] as const
for (const [w, queueName] of watched) {
  reportWorkerFailures(w, queueName, reportError)
  logWorkerJobs(w, queueName)
}
// Finished jobs kept from before KEEP_FINISHED; in the background so start-up does not wait.
trimFinishedJobs(
  redis,
  watched.map(([w]) => w.name),
).catch((err) => {
  logger.error('could not trim finished jobs', { error: err })
  reportError(err, { where: 'trimFinishedJobs' })
})

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
await paymentFees.queue.upsertJobScheduler(
  'sync-payment-fees',
  { every: PAYMENT_FEES_EVERY_MS },
  { name: 'sync' },
)
// Abandoned-cart recovery now runs as a Marketing automation; drop the old sweep's schedule.
await retireAbandonedSweep(redis)

await domains.queue.upsertJobScheduler(
  'verify-pending-domains',
  { every: VERIFY_EVERY_MS },
  { name: 'verify' },
)
// Real network checks only: with the dev provider there is nothing to ask.
if (env.DOMAIN_PROVIDER === 'dns') {
  await certificates.queue.upsertJobScheduler(
    'check-domain-certificates',
    { every: CERTIFICATE_EVERY_MS },
    { name: 'check' },
  )
} else {
  await certificates.queue.removeJobScheduler('check-domain-certificates')
}
await senderEmails.queue.upsertJobScheduler(
  'verify-sender-emails',
  { every: SENDER_CHECK_EVERY_MS },
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
await importSnapshots.queue.upsertJobScheduler(
  'clean-import-snapshots',
  { every: SNAPSHOT_CLEANUP_EVERY_MS },
  { name: 'clean' },
)
await reviewRequests.queue.upsertJobScheduler(
  'queue-review-requests',
  { every: REVIEW_REQUESTS_EVERY_MS },
  { name: 'sweep' },
)
await memberDailySummary.queue.upsertJobScheduler(
  'member-daily-summary',
  { every: DAILY_SUMMARY_EVERY_MS },
  { name: 'sweep' },
)
await searchConsole.queue.upsertJobScheduler(
  'search-console-sweep',
  { every: SEARCH_CONSOLE_EVERY_MS },
  { name: 'sweep' },
)
await billing.queue.upsertJobScheduler(
  'billing-sweep',
  { every: BILLING_EVERY_MS },
  { name: 'sweep' },
)
await apiActivityPrune.queue.upsertJobScheduler(
  'api-activity-prune',
  { every: API_ACTIVITY_PRUNE_EVERY_MS },
  { name: 'prune' },
)
await channelSync.queue.upsertJobScheduler(
  'channel-sync-sweep',
  { every: CHANNEL_SYNC_EVERY_MS },
  { name: 'sweep', data: { sweep: true } },
)

const rateLimitStore = createRedisRateLimitStore(redis)

const app = new Hono()
// One wide event per webhook call; Docker's health probe is left out.
app.use(evlog({ exclude: ['/health'] }))
app.route('/', paymentWebhooks(db, env.SETTINGS_SECRET, rateLimitStore))
app.route('/', shipmentWebhooks(db, env.SETTINGS_SECRET, rateLimitStore))

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
  await paymentFees.worker.close()
  await paymentFees.queue.close()
  await domains.worker.close()
  await domains.queue.close()
  await domainRoutes.worker.close()
  await domainRoutes.queue.close()
  await certificates.worker.close()
  await certificates.queue.close()
  await senderEmails.worker.close()
  await senderEmails.queue.close()
  await marketing.tick.close()
  await marketing.send.close()
  await marketing.tickQueue.close()
  await marketing.sendQueue.close()
  await outboxRelay.worker.close()
  await outboxRelay.queue.close()
  await backInStock.worker.close()
  await backInStock.queue.close()
  await storeExport.worker.close()
  await storeExport.queue.close()
  await aiBulkWrite.worker.close()
  await aiBulkWrite.queue.close()
  await purchaseDocuments.worker.close()
  await purchaseDocuments.queue.close()
  await importSnapshots.worker.close()
  await importSnapshots.queue.close()
  await reviewRequests.worker.close()
  await reviewRequests.queue.close()
  await memberDailySummary.worker.close()
  await memberDailySummary.queue.close()
  await searchConsole.worker.close()
  await searchConsole.queue.close()
  await searchConsole.appJobs.close()
  await billing.worker.close()
  await billing.queue.close()
  await apiActivityPrune.worker.close()
  await apiActivityPrune.queue.close()
  await channelSync.worker.close()
  await channelSync.queue.close()
  await queue.close()
  await notifications.close()
  redis.disconnect()
  await db.$client.end()
  await flushLogs()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

/*
 * A throw outside any job's promise chain (a library's stream internals, a timer)
 * must not take down every queue with it: Bun's stream piping once threw
 * "undefined is not a function" at the end of a Shopify import's video copy and
 * exited the worker twice. Report it and keep going; each job has its own
 * timeouts and watchdog (the importer's STUCK_MS), so one that lost its work
 * still ends.
 */
process.on('uncaughtException', (err) => {
  logger.error('uncaught exception, kept running', { error: err })
  reportError(err, { where: 'uncaughtException' })
})
process.on('unhandledRejection', (reason) => {
  logger.error('unhandled rejection, kept running', { error: reason })
  reportError(reason, { where: 'unhandledRejection' })
})

logger.info('worker listening', { port: env.WORKER_PORT })

export default { port: env.WORKER_PORT, fetch: app.fetch }
