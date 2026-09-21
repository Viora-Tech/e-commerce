import { NOTIFICATIONS_QUEUE, type NotificationJob, type NotificationQueue } from '@commerce/core'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'

export const HEARTBEAT_QUEUE = '{system}-heartbeat'
/** Repeat job that polls open shipments. Braces keep every key on one slot. */
export const SHIPPING_TRACK_QUEUE = '{shipping}-track'

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

/** One process-wide Redis connection for caches; same globalThis caching as the queue. */
export function sharedRedis(redisUrl: string): IORedis {
  const g = globalThis as { __commerceRedis?: IORedis }
  if (!g.__commerceRedis) g.__commerceRedis = createConnection(redisUrl)
  return g.__commerceRedis
}

export * from './cache'
export { Queue, Worker } from 'bullmq'
export type { default as IORedis } from 'ioredis'
