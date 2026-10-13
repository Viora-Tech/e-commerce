import 'server-only'
import { loadEnv } from '@commerce/config'
import { enqueueNotification, type NotificationJob } from '@commerce/core'
import { logger } from '@commerce/observability/logging'
import { notificationQueue } from '@commerce/queue'

/**
 * Queue an order event for the worker. Never throws: a Redis hiccup must not
 * turn a placed order into an error page; the worker's reconcile can resend.
 */
export async function notify(job: NotificationJob): Promise<void> {
  try {
    await enqueueNotification(notificationQueue(loadEnv(process.env).REDIS_URL), job)
  } catch (err) {
    logger.error('could not enqueue a notification', {
      storeId: job.storeId,
      orderId: job.orderId,
      template: job.template,
      error: err,
    })
  }
}
