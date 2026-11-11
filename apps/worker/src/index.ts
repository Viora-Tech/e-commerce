import { resolve } from 'node:path'
import { loadEnv } from '@commerce/config'
import {
  cloudflareConfigFrom,
  cloudflarePurgeConfigFrom,
  createRedisRateLimitStore,
  dokployConfigFrom,
  FX_RATES_QUEUE,
  platformRoots,
  RETENTION_QUEUE,
  ROLLOUTS_EVERY_MS,
  ROLLOUTS_QUEUE,
} from '@commerce/core'
import { AUTOMATION_PRUNE_QUEUE, AUTOMATION_TICK_QUEUE } from '@commerce/core/automations/server'
import { PIXELS_PRUNE_QUEUE } from '@commerce/core/pixels/server'
import { createDb } from '@commerce/db'
import { reportWorkerFailures } from '@commerce/observability'
import { flushLogs, initLogging, logger, logWorkerJobs } from '@commerce/observability/logging'
import {
  AFFILIATE_COMMISSIONS_QUEUE,
  API_ACTIVITY_PRUNE_QUEUE,
  BILLING_SWEEP_QUEUE,
  BUG_REPORT_SYNC_QUEUE,
  createAppEventQueue,
  createNotificationQueue,
  DOMAIN_CERTIFICATE_QUEUE,
  DOMAIN_VERIFY_QUEUE,
  HOME_CARDS_QUEUE,
  IMPORT_SNAPSHOT_CLEANUP_QUEUE,
  MARKETING_TICK_QUEUE,
  MEMBER_DAILY_SUMMARY_QUEUE,
  ORDER_PUSH_QUEUE,
  PAYMENT_FEES_QUEUE,
  PREORDER_BALANCE_QUEUE,
  Queue,
  REVIEW_REQUESTS_QUEUE,
  REVIEW_SUMMARIES_QUEUE,
  SEARCH_CONSOLE_SWEEP_QUEUE,
  SENDER_EMAIL_VERIFY_QUEUE,
  SHIPPING_TRACK_QUEUE,
  SHOPIFY_TOKEN_SWEEP_QUEUE,
  STORE_ACTIVITY_PRUNE_QUEUE,
  trimFinishedJobs,
  UNPAID_EXPIRY_QUEUE,
} from '@commerce/queue'
import { sql } from 'drizzle-orm'
import { evlog } from 'evlog/hono'
import { Hono } from 'hono'
import { AFFILIATE_COMMISSIONS_EVERY_MS, createAffiliateCommissionSweep } from './affiliates'
import { createAiBulkWriteWorker } from './ai-bulk-write'
import { API_ACTIVITY_PRUNE_EVERY_MS, createApiActivityPrune } from './api-activity'
import { createAppEventWorker, createAppJobWorker } from './app-events'
import { AUTOMATIONS_TICK_MS, createAutomationsWorker } from './automations'
import { AUTOMATION_PRUNE_EVERY_MS, createAutomationsPrune } from './automations-prune'
import { createBackInStockWorker } from './back-in-stock'
import { BILLING_EVERY_MS, createBillingSweep } from './billing'
import { BUG_REPORT_SYNC_EVERY_MS, createBugReportSync } from './bug-report-sync'
import { CHANNEL_SYNC_EVERY_MS, createChannelSync } from './channel-sync'
import {
  CERTIFICATE_EVERY_MS,
  createCertificateSweep,
  createDomainPoller,
  createDomainRouteWorker,
  VERIFY_EVERY_MS,
} from './domains'
import { startEdgePurge } from './edge-purge'
import { emailFeedbackWebhooks } from './email-feedback'
import { createFxRates, FX_RATES_SCHEDULE } from './fx-rates'
import { createHomeCardsRefresh, HOME_CARDS_EVERY_MS } from './home-cards'
import { createImportSnapshotCleanup, SNAPSHOT_CLEANUP_EVERY_MS } from './import-snapshots'
import { createInboxAiReplyWorker } from './inbox-ai-reply'
import { createMarketingWorker, MARKETING_TICK_MS, retireAbandonedSweep } from './marketing'
import { mediaProcessLimits } from './media-limits'
import { createMediaProcessWorker } from './media-process'
import { createMemberDailySummary, DAILY_SUMMARY_EVERY_MS } from './member-daily-summary'
import { createMemoryGuard, type MemoryLevel, readMemoryLimit, sweepRuns } from './memory-guard'
import { createNotificationWorker } from './notifications'
import { initSentry, reportError } from './observability'
import { createOrderPusher, PUSH_EVERY_MS } from './order-push'
import { createOutboxRelay, RELAY_EVERY_MS } from './outbox-relay'
import { createPaymentFeeSync, PAYMENT_FEES_EVERY_MS } from './payment-fees'
import { paymentWebhooks } from './payments'
import { createUnpaidOrderExpiry, EXPIRY_EVERY_MS } from './payments-expiry'
import { createPixelsWorker, PIXELS_PRUNE_EVERY_MS } from './pixels'
import { platformWebhooks } from './platform-webhooks'
import { BALANCE_EVERY_MS, createPreorderBalanceJob } from './preorder-balance'
import { createPurchaseDocumentWorker } from './purchase-documents'
import { createConnection, createHeartbeat } from './queues'
import { createRetentionPrune, RETENTION_SCHEDULE } from './retention'
import { createReviewSummarySweep, REVIEW_SUMMARIES_EVERY_MS } from './review-summaries'
import { createReviewRequestSweep, REVIEW_REQUESTS_EVERY_MS } from './reviews'
import { createRolloutsTick } from './rollouts'
import { createSearchConsoleSweep, SEARCH_CONSOLE_EVERY_MS } from './search-console'
import { createSenderEmailPoller, SENDER_CHECK_EVERY_MS } from './sender-email'
import { shipmentWebhooks } from './shipments-webhook'
import { createShippingTracker, TRACK_EVERY_MS } from './shipping'
import { createShopifyTokenSweep, SHOPIFY_TOKEN_SWEEP_EVERY_MS } from './shopify-token-sweep'
import { createStoreActivityPrune, STORE_ACTIVITY_PRUNE_EVERY_MS } from './store-activity'
import { createStoreExportWorker } from './store-export'
import { createSweepWorker, type Sweep, scheduleSweeps } from './sweeps'
import { createThemeScreenshotWorker } from './theme-screenshot'

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
  mediaCpus: env.MEDIA_CPUS,
})
const appJobWorker = createAppJobWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
  mediaProcess: mediaProcess.queue,
})

const unpaidExpiry = createUnpaidOrderExpiry(db, { settingsSecret: env.SETTINGS_SECRET })
const preorderBalance = createPreorderBalanceJob(db, { settingsSecret: env.SETTINGS_SECRET })
const paymentFees = createPaymentFeeSync(db, { settingsSecret: env.SETTINGS_SECRET })
const tracker = createShippingTracker(db, { settingsSecret: env.SETTINGS_SECRET })
const orderPusher = createOrderPusher(db, { settingsSecret: env.SETTINGS_SECRET })
// Unset Dokploy keys: no routes are asked for and every route job is a no-op (added by hand).
const dokploy = dokployConfigFrom(env)
const cloudflare = env.DOMAIN_PROVIDER === 'cloudflare' ? cloudflareConfigFrom(env) : null
// Cloudflare cache purge after a store's pages change: off without CLOUDFLARE_CACHE_PURGE_TOKEN.
const purgeConfig = cloudflarePurgeConfigFrom(env)
const edgePurge = purgeConfig
  ? startEdgePurge(db, env.DATABASE_URL_DIRECT ?? env.DATABASE_URL, purgeConfig)
  : null
const domainTargets = { aRecord: env.STOREFRONT_A_RECORD, cnameTarget: env.STOREFRONT_CNAME_TARGET }
const domainGuard = {
  platformRoots: platformRoots(env),
  cnameTarget: env.STOREFRONT_CNAME_TARGET,
  storeDomain: env.PLATFORM_STORE_DOMAIN,
}
const domains = createDomainPoller(db, {
  provider: env.DOMAIN_PROVIDER,
  cloudflare,
  targets: domainTargets,
  requestRoutes: dokploy !== null,
})
const domainRoutes = createDomainRouteWorker(redis, db, {
  dokploy,
  cloudflare,
  guard: domainGuard,
  targets: domainTargets,
})
const certificates = createCertificateSweep(db, {
  dokploy,
  guard: domainGuard,
  targets: domainTargets,
})
const senderEmails = createSenderEmailPoller(db)
const marketing = createMarketingWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const backInStock = createBackInStockWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const storeExport = createStoreExportWorker(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const themeScreenshots = createThemeScreenshotWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
  chromiumPath: env.THEME_SCREENSHOT_CHROMIUM,
  // A production image has no Playwright download: only the Chromium the env names.
  disabled: env.NODE_ENV === 'production' && !env.THEME_SCREENSHOT_CHROMIUM,
})
const aiBulkWrite = createAiBulkWriteWorker(redis, db, { settingsSecret: env.SETTINGS_SECRET })
const inboxAi = createInboxAiReplyWorker(redis, db)
const purchaseDocuments = createPurchaseDocumentWorker(redis, db)
const importSnapshots = createImportSnapshotCleanup(db, {
  settingsSecret: env.SETTINGS_SECRET,
})
const reviewRequests = createReviewRequestSweep(db)
const reviewSummaries = createReviewSummarySweep(db)
const affiliateCommissions = createAffiliateCommissionSweep(db)
const memberDailySummary = createMemberDailySummary(db, {
  settingsSecret: env.SETTINGS_SECRET,
  adminUrl: env.ADMIN_URL,
})
const homeCards = createHomeCardsRefresh(db)
const searchConsole = createSearchConsoleSweep(redis, db)
const billing = createBillingSweep(db, {
  salesStoreId: env.PLATFORM_SALES_STORE_ID,
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
})
const apiActivityPrune = createApiActivityPrune(db)
const storeActivityPrune = createStoreActivityPrune(db)
const shopifyTokenSweep = createShopifyTokenSweep(db, {
  settingsSecret: env.SETTINGS_SECRET,
})
const bugReportSync = createBugReportSync(db, env)
const automationsPrune = createAutomationsPrune(db)
const retentionPrune = createRetentionPrune(db)
const rolloutsTick = createRolloutsTick(db)
const fxRates = createFxRates(db)
const channelSync = createChannelSync(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  adminUrl: env.ADMIN_URL,
  storefrontUrl: env.STOREFRONT_URL,
})
const automations = createAutomationsWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  storefrontUrl: env.STOREFRONT_URL,
  adminUrl: env.ADMIN_URL,
  mediaProcess: mediaProcess.queue,
})
const pixels = createPixelsWorker(redis, db, {
  settingsSecret: env.SETTINGS_SECRET,
  adminUrl: env.ADMIN_URL,
})
const outboxRelay = createOutboxRelay(redis, db, {
  notifications,
  appEvents,
  automationTriggers: automations.triggerQueue,
  pixelOrders: pixels.orderQueue,
  inventoryRestock: backInStock.queue,
  domainRoutes: domainRoutes.queue,
})

/*
 * Every scheduled sweep, on one shared queue and one worker (`./sweeps.ts`). `name` is the label
 * its jobs log under (the queue label each had before); `legacy` is the queue and scheduler it
 * had then, retired on boot. Outbox relay, channel sync and the heartbeat keep their own queues:
 * other apps add jobs to the first two, and the heartbeat is the liveness signal.
 */
const every = (ms: number) => ({ every: ms })
const noop = async () => ({ skipped: 1 })
const sweepList: Sweep[] = [
  {
    name: 'shipping-tracker',
    schedule: every(TRACK_EVERY_MS),
    run: tracker.run,
    legacy: { queue: SHIPPING_TRACK_QUEUE, scheduler: 'track-open-shipments' },
  },
  {
    name: 'order-push',
    schedule: every(PUSH_EVERY_MS),
    run: orderPusher.run,
    legacy: { queue: ORDER_PUSH_QUEUE, scheduler: 'push-new-orders' },
  },
  {
    name: 'unpaid-order-expiry',
    schedule: every(EXPIRY_EVERY_MS),
    run: unpaidExpiry.run,
    legacy: { queue: UNPAID_EXPIRY_QUEUE, scheduler: 'expire-unpaid-orders' },
  },
  {
    name: 'preorder-balance',
    schedule: every(BALANCE_EVERY_MS),
    run: preorderBalance.run,
    legacy: { queue: PREORDER_BALANCE_QUEUE, scheduler: 'preorder-balance' },
  },
  {
    name: 'payment-fees',
    schedule: every(PAYMENT_FEES_EVERY_MS),
    run: paymentFees.run,
    legacy: { queue: PAYMENT_FEES_QUEUE, scheduler: 'sync-payment-fees' },
  },
  {
    name: 'domain-verify',
    schedule: every(VERIFY_EVERY_MS),
    run: domains.run,
    legacy: { queue: DOMAIN_VERIFY_QUEUE, scheduler: 'verify-pending-domains' },
  },
  // Real network checks only: with the dev provider there is nothing to ask.
  {
    name: 'domain-certificate',
    schedule: every(CERTIFICATE_EVERY_MS),
    run: certificates.run,
    legacy: { queue: DOMAIN_CERTIFICATE_QUEUE, scheduler: 'check-domain-certificates' },
    enabled: env.DOMAIN_PROVIDER !== 'dev',
  },
  {
    name: 'sender-email-verify',
    schedule: every(SENDER_CHECK_EVERY_MS),
    run: senderEmails.run,
    legacy: { queue: SENDER_EMAIL_VERIFY_QUEUE, scheduler: 'verify-sender-emails' },
  },
  {
    name: 'marketing-tick',
    schedule: every(MARKETING_TICK_MS),
    run: marketing.tick,
    legacy: { queue: MARKETING_TICK_QUEUE, scheduler: 'marketing-tick' },
  },
  {
    name: 'automations-tick',
    schedule: every(AUTOMATIONS_TICK_MS),
    run: automations.tick,
    legacy: { queue: AUTOMATION_TICK_QUEUE, scheduler: 'automations-tick' },
  },
  {
    name: 'import-snapshot-cleanup',
    schedule: every(SNAPSHOT_CLEANUP_EVERY_MS),
    run: importSnapshots.run,
    legacy: { queue: IMPORT_SNAPSHOT_CLEANUP_QUEUE, scheduler: 'clean-import-snapshots' },
  },
  {
    name: 'review-requests',
    schedule: every(REVIEW_REQUESTS_EVERY_MS),
    run: reviewRequests.run,
    legacy: { queue: REVIEW_REQUESTS_QUEUE, scheduler: 'queue-review-requests' },
  },
  {
    name: 'review-summaries',
    schedule: every(REVIEW_SUMMARIES_EVERY_MS),
    run: reviewSummaries.run,
    legacy: { queue: REVIEW_SUMMARIES_QUEUE, scheduler: 'refresh-review-summaries' },
  },
  {
    name: 'affiliate-commissions',
    schedule: every(AFFILIATE_COMMISSIONS_EVERY_MS),
    run: affiliateCommissions.run,
    legacy: { queue: AFFILIATE_COMMISSIONS_QUEUE, scheduler: 'approve-affiliate-commissions' },
  },
  {
    name: 'member-daily-summary',
    schedule: every(DAILY_SUMMARY_EVERY_MS),
    run: memberDailySummary.run,
    legacy: { queue: MEMBER_DAILY_SUMMARY_QUEUE, scheduler: 'member-daily-summary' },
  },
  {
    name: 'home-cards',
    schedule: every(HOME_CARDS_EVERY_MS),
    run: homeCards.run,
    legacy: { queue: HOME_CARDS_QUEUE, scheduler: 'home-cards' },
  },
  {
    name: 'search-console-sweep',
    schedule: every(SEARCH_CONSOLE_EVERY_MS),
    run: searchConsole.run,
    legacy: { queue: SEARCH_CONSOLE_SWEEP_QUEUE, scheduler: 'search-console-sweep' },
  },
  {
    name: 'billing-sweep',
    schedule: every(BILLING_EVERY_MS),
    run: billing.run,
    legacy: { queue: BILLING_SWEEP_QUEUE, scheduler: 'billing-sweep' },
  },
  {
    name: 'automations-prune',
    schedule: every(AUTOMATION_PRUNE_EVERY_MS),
    run: automationsPrune.run,
    legacy: { queue: AUTOMATION_PRUNE_QUEUE, scheduler: 'automations-prune' },
  },
  {
    name: 'pixels-prune',
    schedule: every(PIXELS_PRUNE_EVERY_MS),
    run: pixels.prune,
    legacy: { queue: PIXELS_PRUNE_QUEUE, scheduler: 'pixels-prune' },
  },
  {
    name: 'api-activity-prune',
    schedule: every(API_ACTIVITY_PRUNE_EVERY_MS),
    run: apiActivityPrune.run,
    legacy: { queue: API_ACTIVITY_PRUNE_QUEUE, scheduler: 'api-activity-prune' },
  },
  {
    name: 'store-activity-prune',
    schedule: every(STORE_ACTIVITY_PRUNE_EVERY_MS),
    run: storeActivityPrune.run,
    legacy: { queue: STORE_ACTIVITY_PRUNE_QUEUE, scheduler: 'store-activity-prune' },
  },
  {
    name: 'shopify-token-sweep',
    schedule: every(SHOPIFY_TOKEN_SWEEP_EVERY_MS),
    run: shopifyTokenSweep.run,
    legacy: { queue: SHOPIFY_TOKEN_SWEEP_QUEUE, scheduler: 'shopify-token-sweep' },
  },
  // Carts, outbox rows and webhook payloads past retention: 03:30 India time, when stores are quiet.
  {
    name: 'retention-prune',
    schedule: RETENTION_SCHEDULE,
    run: retentionPrune.run,
    legacy: { queue: RETENTION_QUEUE, scheduler: 'retention-prune' },
  },
  // Rollouts due to start or end (Markets → Rollouts): checked every minute.
  {
    name: 'rollouts-tick',
    schedule: every(ROLLOUTS_EVERY_MS),
    run: rolloutsTick.run,
    legacy: { queue: ROLLOUTS_QUEUE, scheduler: 'rollouts-tick' },
  },
  // Markets' reference exchange rates: 21:30 India time, after the ECB publishes; once at boot too.
  {
    name: 'fx-rates',
    schedule: FX_RATES_SCHEDULE,
    run: fxRates.run,
    legacy: { queue: FX_RATES_QUEUE, scheduler: 'fx-rates' },
  },
  // Open bug reports re-read from GitHub; off without GITHUB_ISSUES_TOKEN.
  {
    name: 'bug-report-sync',
    schedule: every(BUG_REPORT_SYNC_EVERY_MS),
    run: bugReportSync?.run ?? noop,
    legacy: { queue: BUG_REPORT_SYNC_QUEUE, scheduler: 'bug-report-sync' },
    enabled: bugReportSync !== null,
  },
]
// The memory guard holds back sweeps one job at a time (it never pauses this mixed worker):
// payment sweeps run at every level. It starts below, so this reads `normal` until then.
let memoryLevel = (): MemoryLevel => 'normal'
const sweeps = createSweepWorker(redis, sweepList, (name) => sweepRuns(memoryLevel(), name))

// Each worker reports its failures to Sentry and logs one wide event per job (docs/ops/logging.md).
const watched = [
  [worker, 'heartbeat'],
  [notificationWorker, 'notifications'],
  [appEventWorker, 'app-events'],
  [appJobWorker, 'app-jobs'],
  [domainRoutes.worker, 'domain-route'],
  [marketing.send, 'marketing-send'],
  [outboxRelay.worker, 'outbox-relay'],
  [automations.trigger, 'automations-trigger'],
  [automations.step, 'automations-step'],
  [pixels.order, 'pixels-order'],
  [pixels.send, 'pixels-send'],
  [backInStock.worker, 'back-in-stock'],
  [mediaProcess.worker, 'media-process'],
  [storeExport.worker, 'store-export'],
  [themeScreenshots.worker, 'theme-screenshot'],
  [aiBulkWrite.worker, 'ai-bulk-write'],
  [inboxAi.worker, 'inbox-ai-reply'],
  [purchaseDocuments.worker, 'purchase-documents'],
  [channelSync.worker, 'channel-sync'],
  // One worker for every scheduled sweep; each job's name is the sweep (`unpaid-order-expiry`…).
  [sweeps.worker, 'sweeps'],
] as const
for (const [w, queueName] of watched) {
  reportWorkerFailures(w, queueName, reportError)
  logWorkerJobs(w, queueName)
}

// The worker backs off before its container limit instead of being OOM-killed on a shared box:
// bulk queues pause first, then all but payments and order emails (./memory-guard.ts).
const memoryLimit = readMemoryLimit(env.WORKER_MEMORY_LIMIT_MB)
const memoryGuard = createMemoryGuard({
  workers: watched,
  limitBytes: memoryLimit.bytes,
  thresholds: {
    slow: env.WORKER_MEMORY_SLOW_PCT / 100,
    critical: env.WORKER_MEMORY_CRITICAL_PCT / 100,
    resume: env.WORKER_MEMORY_RESUME_PCT / 100,
    exit: env.WORKER_MEMORY_EXIT_PCT / 100,
    exitAfterMs: env.WORKER_MEMORY_EXIT_AFTER_S * 1000,
  },
  exit: () => {
    // Running jobs get time to finish; past that, leave anyway so Docker restarts the worker.
    setTimeout(() => process.exit(1), 30_000).unref()
    void shutdown()
  },
})
memoryGuard.start()
memoryLevel = memoryGuard.level
logger.info('memory guard on', {
  area: 'memory',
  limitMb: Math.round(memoryLimit.bytes / 1024 / 1024),
  source: memoryLimit.source,
})
// Finished jobs kept from before KEEP_FINISHED; in the background so start-up does not wait.
trimFinishedJobs(
  redis,
  watched.map(([w]) => w.name),
).catch((err) => {
  logger.error('could not trim finished jobs', { error: err })
  reportError(err, { where: 'trimFinishedJobs' })
})

await queue.upsertJobScheduler('heartbeat-every-minute', { every: 60_000 }, { name: 'tick' })
// Abandoned-cart recovery now runs as a Marketing automation; drop the old sweep's schedule.
await retireAbandonedSweep(redis)
await outboxRelay.queue.upsertJobScheduler(
  'relay-outbox-events',
  { every: RELAY_EVERY_MS },
  { name: 'relay' },
)
// Every sweep on the shared queue; the first boot after the move retires their old queues.
await scheduleSweeps(sweeps.queue, sweepList, (name) => new Queue(name, { connection: redis }))
await sweeps.queue.add('fx-rates', {})
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
app.route('/', emailFeedbackWebhooks(db, { topicArn: env.SES_EVENTS_TOPIC_ARN }, rateLimitStore))
app.route(
  '/',
  platformWebhooks(
    db,
    {
      metaAppSecret: env.META_APP_SECRET ?? null,
      metaVerifyToken: env.META_WEBHOOK_VERIFY_TOKEN ?? null,
      shopifySecret: env.SHOPIFY_APP_CLIENT_SECRET ?? null,
      settingsSecret: env.SETTINGS_SECRET,
      adminUrl: env.ADMIN_URL,
    },
    rateLimitStore,
  ),
)

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
  await edgePurge?.close()
  memoryGuard.stop()
  await sweeps.worker.close()
  await sweeps.queue.close()
  await worker.close()
  await notificationWorker.close()
  await appEventWorker.close()
  await appJobWorker.close()
  await domainRoutes.worker.close()
  await domainRoutes.queue.close()
  await automations.trigger.close()
  await automations.step.close()
  await automations.triggerQueue.close()
  await automations.stepQueue.close()
  await pixels.order.close()
  await pixels.send.close()
  await pixels.orderQueue.close()
  await pixels.sendQueue.close()
  await marketing.send.close()
  await marketing.sendQueue.close()
  await outboxRelay.worker.close()
  await outboxRelay.queue.close()
  await outboxRelay.appJobs.close()
  await backInStock.worker.close()
  await backInStock.queue.close()
  await storeExport.worker.close()
  await storeExport.queue.close()
  await themeScreenshots.worker.close()
  await themeScreenshots.queue.close()
  await aiBulkWrite.worker.close()
  await aiBulkWrite.queue.close()
  await inboxAi.worker.close()
  await inboxAi.queue.close()
  await purchaseDocuments.worker.close()
  await purchaseDocuments.queue.close()
  await searchConsole.appJobs.close()
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
