/** SOURCE OF TRUTH: staff push sender — WHAT: the worker that sends staff browser push notifications (Account → Notifications → Push) with `web-push` (MPL-2.0, unmodified, see THIRD_PARTY_NOTICES.md) and the store's VAPID keys / WHY: the outbox relay queues one job per event, `deliverPushJob` picks who gets it, this file only speaks Web Push; without VAPID keys there is no queue and nothing is sent */
import { deliverPushJob, PUSH_QUEUE, type PushJob, type PushSender } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, KEEP_FINISHED, Queue, Worker } from '@commerce/queue'
import webpush from 'web-push'

type PushOptions = {
  settingsSecret: string
  vapid: { publicKey: string; privateKey: string; subject: string }
}

/** How long a push service keeps an undelivered push for a phone that is off (seconds). */
const TTL_SECONDS = 6 * 60 * 60

/** Sends through `web-push`; 404 and 410 mean the browser threw the subscription away. */
function webPushSender(vapid: PushOptions['vapid']): PushSender {
  return async (device, payload) => {
    try {
      await webpush.sendNotification({ endpoint: device.endpoint, keys: device.keys }, payload, {
        vapidDetails: vapid,
        TTL: TTL_SECONDS,
        urgency: 'high',
        timeout: 15_000,
      })
      return { ok: true }
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      const error = err instanceof Error ? err.message : String(err)
      return {
        ok: false,
        gone: status === 404 || status === 410,
        error: `${status ?? ''} ${error}`.trim(),
      }
    }
  }
}

export function createPushWorker(connection: IORedis, db: Db, opts: PushOptions) {
  const send = webPushSender(opts.vapid)
  const queue = new Queue<PushJob>(PUSH_QUEUE, { connection })
  const worker = new Worker<PushJob>(
    PUSH_QUEUE,
    async (job) => {
      const r = await deliverPushJob(db, job.data, {
        send,
        settingsSecret: opts.settingsSecret,
        log: (message, meta) => logger.warn(message, { area: 'push', ...meta }),
      })
      if (r.sent + r.failed + r.gone > 0) {
        logger.info('push sent', { area: 'push', storeId: job.data.storeId, ...r })
      }
      return r
    },
    { connection, concurrency: 4, ...KEEP_FINISHED },
  )
  return { queue, worker }
}

/** The push worker when the VAPID key pair is set (the same pair as the admin's), else null. */
export function pushWorkerFromEnv(
  connection: IORedis,
  db: Db,
  env: {
    SETTINGS_SECRET: string
    VAPID_PUBLIC_KEY?: string | undefined
    VAPID_PRIVATE_KEY?: string | undefined
    VAPID_SUBJECT?: string | undefined
  },
) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null
  return createPushWorker(connection, db, {
    settingsSecret: env.SETTINGS_SECRET,
    vapid: {
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
      subject: env.VAPID_SUBJECT ?? 'mailto:support@koomerce.app',
    },
  })
}
