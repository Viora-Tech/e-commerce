import {
  deliverPixelAlertRow,
  PIXEL_SEND_ATTEMPTS,
  PIXELS_ORDER_QUEUE,
  PIXELS_SEND_QUEUE,
  type PixelOrderJob,
  type PixelSendJob,
  runPixelOrderJob,
  runPixelPruneJob,
  runPixelSendJob,
} from '@commerce/core/pixels/server'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import {
  fairProcessor,
  type IORedis,
  KEEP_FINISHED,
  QUEUE_LIMITS,
  Queue,
  Worker,
} from '@commerce/queue'

export { PIXELS_PRUNE_EVERY_MS } from '@commerce/core/pixels/server'

type Opts = {
  settingsSecret: string
  /** For the link in the owner alert email. */
  adminUrl: string
}

/**
 * The Pixels app on three queues (design §5). The outbox relay queues one order job per
 * order placed / paid / delivered row (stores with the app only); it picks the pixels whose
 * Purchase trigger matches and queues one send job each. The storefront's `/api/px` queues
 * send jobs for browser events. A send job makes one Conversions API call; Meta's throttling
 * and 5xx are retried with backoff, a refused token turns the pixel to Error and emails the
 * owner once. Jobs carry ids only: customer details are read from Postgres when sending, and
 * nothing here logs a token or a customer value.
 */
export function createPixelsWorker(connection: IORedis, db: Db, opts: Opts) {
  const orderQueue = new Queue<PixelOrderJob>(PIXELS_ORDER_QUEUE, { connection })
  const sendQueue = new Queue<PixelSendJob>(PIXELS_SEND_QUEUE, { connection })

  const order = new Worker<PixelOrderJob>(
    PIXELS_ORDER_QUEUE,
    fairProcessor(connection, PIXELS_ORDER_QUEUE, QUEUE_LIMITS.pixelsOrder, async (job) =>
      (await deliverPixelAlertRow(db, job.data, opts))
        ? { alert: true }
        : runPixelOrderJob(db, job.data, sendQueue),
    ),
    { connection, concurrency: QUEUE_LIMITS.pixelsOrder.concurrency, ...KEEP_FINISHED },
  )

  const send = new Worker<PixelSendJob>(
    PIXELS_SEND_QUEUE,
    fairProcessor(connection, PIXELS_SEND_QUEUE, QUEUE_LIMITS.pixelsSend, async (job) => {
      const outcome = await runPixelSendJob(
        db,
        job.data,
        { settingsSecret: opts.settingsSecret },
        {
          attempt: job.attemptsMade + 1,
          maxAttempts: job.opts.attempts ?? PIXEL_SEND_ATTEMPTS,
        },
      )
      return { outcome }
    }),
    { connection, concurrency: QUEUE_LIMITS.pixelsSend.concurrency, ...KEEP_FINISHED },
  )

  const prune = async () => {
    const r = await runPixelPruneJob(db, new Date(), (m) => logger.warn(m, { area: 'pixels' }))
    if (r.logs || r.days || r.orders) logger.info('pixels pruned', { area: 'pixels', ...r })
    return r
  }

  return { order, send, prune, orderQueue, sendQueue }
}
