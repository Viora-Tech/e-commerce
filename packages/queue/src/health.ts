import {
  AI_BULK_QUEUE,
  APP_EVENTS_QUEUE,
  APP_JOBS_QUEUE,
  CHANNEL_SYNC_QUEUE,
  NOTIFICATIONS_QUEUE,
  PURCHASE_DOCUMENT_QUEUE,
  STORE_EXPORT_QUEUE,
} from '@commerce/core'
import { AUTOMATION_STEP_QUEUE } from '@commerce/core/automations/server'
import { INBOX_AI_QUEUE } from '@commerce/core/inbox/server'
import { PIXELS_SEND_QUEUE } from '@commerce/core/pixels/server'
import { Queue } from 'bullmq'
import type IORedis from 'ioredis'

/**
 * The worker queues the platform console's Overview watches: the ones that carry store work a
 * merchant waits on (emails, apps, media, exports, AI, automations, pixels). Read-only counts.
 */
const WATCHED_QUEUES = [
  NOTIFICATIONS_QUEUE,
  APP_EVENTS_QUEUE,
  APP_JOBS_QUEUE,
  '{outbox}-relay',
  '{marketing}-send',
  '{media}-process',
  STORE_EXPORT_QUEUE,
  AI_BULK_QUEUE,
  PURCHASE_DOCUMENT_QUEUE,
  CHANNEL_SYNC_QUEUE,
  AUTOMATION_STEP_QUEUE,
  PIXELS_SEND_QUEUE,
  INBOX_AI_QUEUE,
] as const

export type QueueCounts = {
  name: string
  waiting: number
  active: number
  delayed: number
  failed: number
  oldestWaitingAt: Date | null
}

/** One reader per queue, kept for the process: opening a BullMQ Queue costs a round trip. */
function reader(connection: IORedis, name: string): Queue {
  const g = globalThis as { __queueReaders?: Map<string, Queue> }
  g.__queueReaders ??= new Map()
  let queue = g.__queueReaders.get(name)
  if (!queue) {
    queue = new Queue(name, { connection })
    g.__queueReaders.set(name, queue)
  }
  return queue
}

/** Job counts and the oldest waiting job of each queue, for the platform console. */
export async function queueHealth(
  connection: IORedis,
  names: readonly string[] = WATCHED_QUEUES,
): Promise<QueueCounts[]> {
  return Promise.all(
    names.map(async (name) => {
      const queue = reader(connection, name)
      const counts = await queue.getJobCounts('waiting', 'active', 'delayed', 'failed')
      const [oldest] = await queue.getJobs(['waiting'], 0, 0, true)
      return {
        name,
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        oldestWaitingAt: oldest?.timestamp ? new Date(oldest.timestamp) : null,
      }
    }),
  )
}
