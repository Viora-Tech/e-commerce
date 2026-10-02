import {
  AI_BULK_QUEUE,
  type AiBulkJob,
  type AiBulkQueue,
  APP_EVENTS_QUEUE,
  APP_JOBS_QUEUE,
  type AppEventJob,
  type AppEventQueue,
  type AppJobData,
  type AppJobQueue,
  type MediaProcessJob,
  type MediaProcessQueue,
  NOTIFICATIONS_QUEUE,
  type NotificationJob,
  type NotificationQueue,
  STORE_EXPORT_QUEUE,
  type StoreExportJob,
  type StoreExportQueue,
} from '@commerce/core'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'
import type { QueueLimits } from './fair'

export const HEARTBEAT_QUEUE = '{system}-heartbeat'
/** Repeat job that polls open shipments. Braces keep every key on one slot. */
export const SHIPPING_TRACK_QUEUE = '{shipping}-track'
/** Repeat job that cancels online-payment orders left unpaid past the store's window. */
export const UNPAID_EXPIRY_QUEUE = '{payments}-unpaid-expiry'
/** Repeat job that requests, reminds and applies the unpaid rule for pre-order balances. */
export const PREORDER_BALANCE_QUEUE = '{payments}-preorder-balance'
/** Repeat job that nudges shoppers who left a basket behind. */
export const ABANDONED_SWEEP_QUEUE = '{abandoned}-sweep'
/** Repeat job that checks custom domains still waiting on DNS or a certificate. */
export const DOMAIN_VERIFY_QUEUE = '{domains}-verify'
/** Repeat job that checks store sender email domains (pending, and verified ones daily). */
export const SENDER_EMAIL_VERIFY_QUEUE = '{sender-email}-verify'
/** Repeat job that claims undispatched outbox rows and fans them out. */
export const OUTBOX_RELAY_QUEUE = '{outbox}-relay'
/** Repeat tick that starts scheduled campaigns and runs due automation steps. */
export const MARKETING_TICK_QUEUE = '{marketing}-tick'
/** One job per sending campaign; works through recipients in batches. */
export const MARKETING_SEND_QUEUE = '{marketing}-send'
/** One job per confirmed image upload (or Shopify-import media row); runs the upload-time pipeline. */
export const MEDIA_PROCESS_QUEUE = '{media}-process'

/**
 * Worker concurrency and the per-store cap for every queue that carries store jobs (see
 * `./fair.ts`). The cap is what keeps one store's import, campaign or restock blast from
 * taking every slot: the rest stay free for other stores. Raising `concurrency` without
 * raising `perStore` gives other stores more room; raising `perStore` lets one busy store
 * go faster when it is alone. Documented in developer docs, Architecture, section 3.
 */
export const QUEUE_LIMITS = {
  notifications: { concurrency: 5, perStore: 3 },
  appEvents: { concurrency: 3, perStore: 2 },
  /** Shopify import runs and invoice PDF batches: one store's import never blocks its own PDFs. */
  appJobs: { concurrency: 4, perStore: 2 },
  marketingSend: { concurrency: 2, perStore: 1 },
  /** Two at once at most to protect a small 2-vCPU box, so one store gets one. */
  mediaProcess: { concurrency: 2, perStore: 1 },
  backInStock: { concurrency: 2, perStore: 1 },
  storeExport: { concurrency: 2, perStore: 1 },
  /** Bulk "Write with AI" runs: one product at a time per store, so a 200-product run never starves another store's. */
  aiBulkWrite: { concurrency: 2, perStore: 1 },
} as const satisfies Record<string, QueueLimits>

export function createConnection(redisUrl: string): IORedis {
  return new IORedis(redisUrl, { maxRetriesPerRequest: null })
}

/** Producer side of the notifications queue; satisfies core's NotificationQueue. */
export function createNotificationQueue(
  connection: IORedis,
): Queue<NotificationJob> & NotificationQueue {
  return new Queue<NotificationJob>(NOTIFICATIONS_QUEUE, { connection })
}

/**
 * One process-wide queue per app. Next.js re-evaluates modules in dev, so the
 * instance is cached on globalThis the same way the db client is.
 */
export function notificationQueue(redisUrl: string): NotificationQueue {
  const g = globalThis as { __notificationQueue?: NotificationQueue }
  if (!g.__notificationQueue) {
    g.__notificationQueue = createNotificationQueue(createConnection(redisUrl))
  }
  return g.__notificationQueue
}

export function createAppEventQueue(connection: IORedis): Queue<AppEventJob> & AppEventQueue {
  return new Queue<AppEventJob>(APP_EVENTS_QUEUE, { connection })
}

export function createAppJobQueue(connection: IORedis): Queue<AppJobData> & AppJobQueue {
  return new Queue<AppJobData>(APP_JOBS_QUEUE, { connection })
}

export type OutboxRelayJob = { storeId?: string }
export type { MediaProcessJob, MediaProcessQueue }

export function createOutboxRelayQueue(connection: IORedis): Queue<OutboxRelayJob> {
  return new Queue<OutboxRelayJob>(OUTBOX_RELAY_QUEUE, { connection })
}

/** Process-wide outbox relay queue, cached like the others. */
export function outboxRelayQueue(redisUrl: string): Queue<OutboxRelayJob> {
  const g = globalThis as { __outboxRelayQueue?: Queue<OutboxRelayJob> }
  if (!g.__outboxRelayQueue) {
    g.__outboxRelayQueue = createOutboxRelayQueue(createConnection(redisUrl))
  }
  return g.__outboxRelayQueue
}

/**
 * Best-effort immediate nudge for one store, meant to be called right after
 * a commit that wrote outbox rows (checkout, an admin action). The worker's
 * periodic sweep (every few seconds) is what guarantees delivery; this only
 * shaves the wait down to near-immediate. Cheap: one `add` call with a
 * per-second-bucket job id, so a burst of nudges for the same store
 * collapses into at most one extra relay run. Never throws: a Redis hiccup
 * must not turn a placed order into an error page.
 */
export async function nudgeOutboxRelay(
  queue: Queue<OutboxRelayJob>,
  storeId: string,
): Promise<void> {
  const bucket = Math.floor(Date.now() / 1000)
  try {
    await queue.add(
      'nudge',
      { storeId },
      { jobId: `nudge:${storeId}:${bucket}`, removeOnComplete: true, removeOnFail: true },
    )
  } catch (err) {
    console.error(`[outbox] could not nudge relay for store ${storeId}`, err)
  }
}

export function createMediaProcessQueue(
  connection: IORedis,
): Queue<MediaProcessJob> & MediaProcessQueue {
  return new Queue<MediaProcessJob>(MEDIA_PROCESS_QUEUE, { connection })
}

/** Process-wide media-processing queue, cached like the others. */
export function mediaProcessQueue(redisUrl: string): MediaProcessQueue {
  const g = globalThis as { __mediaProcessQueue?: MediaProcessQueue }
  if (!g.__mediaProcessQueue) {
    g.__mediaProcessQueue = createMediaProcessQueue(createConnection(redisUrl))
  }
  return g.__mediaProcessQueue
}

export type { StoreExportJob, StoreExportQueue }

export function createStoreExportQueue(
  connection: IORedis,
): Queue<StoreExportJob> & StoreExportQueue {
  return new Queue<StoreExportJob>(STORE_EXPORT_QUEUE, { connection })
}

/** Process-wide full-store-export queue, cached like the others. */
export function storeExportQueue(redisUrl: string): StoreExportQueue {
  const g = globalThis as { __storeExportQueue?: StoreExportQueue }
  if (!g.__storeExportQueue) {
    g.__storeExportQueue = createStoreExportQueue(createConnection(redisUrl))
  }
  return g.__storeExportQueue
}

export type { AiBulkJob, AiBulkQueue }

export function createAiBulkQueue(connection: IORedis): Queue<AiBulkJob> & AiBulkQueue {
  return new Queue<AiBulkJob>(AI_BULK_QUEUE, { connection })
}

/** Process-wide bulk AI queue, cached like the others. */
export function aiBulkQueue(redisUrl: string): AiBulkQueue {
  const g = globalThis as { __aiBulkQueue?: AiBulkQueue }
  if (!g.__aiBulkQueue) g.__aiBulkQueue = createAiBulkQueue(createConnection(redisUrl))
  return g.__aiBulkQueue
}

/** Process-wide app jobs queue. */
export function appJobQueue(redisUrl: string): AppJobQueue {
  const g = globalThis as { __appJobQueue?: AppJobQueue }
  if (!g.__appJobQueue) g.__appJobQueue = createAppJobQueue(createConnection(redisUrl))
  return g.__appJobQueue
}

/** Process-wide app events queue, cached like the notification queue. */
export function appEventQueue(redisUrl: string): AppEventQueue {
  const g = globalThis as { __appEventQueue?: AppEventQueue }
  if (!g.__appEventQueue) g.__appEventQueue = createAppEventQueue(createConnection(redisUrl))
  return g.__appEventQueue
}

/** One process-wide Redis connection for caches; same globalThis caching as the queue. */
export function sharedRedis(redisUrl: string): IORedis {
  const g = globalThis as { __commerceRedis?: IORedis }
  if (!g.__commerceRedis) g.__commerceRedis = createConnection(redisUrl)
  return g.__commerceRedis
}

export { Queue, Worker } from 'bullmq'
export type { default as IORedis } from 'ioredis'
export * from './cache'
export * from './fair'
export { redisRateLimiter } from './rate-limit'
export * from './visitors'
