import { loadEnv } from '@commerce/config'
import { enqueueNotification, type NotificationJob } from '@commerce/core'
import { notificationQueue } from '@commerce/queue'

/**
 * Queue an order event for the worker. Never throws: a Redis hiccup must not
 * turn a placed order into an error page; the worker's reconcile can resend.
 */
export async function notify(job: NotificationJob): Promise<void> {
  try {
    await enqueueNotification(notificationQueue(loadEnv(process.env).REDIS_URL), job)
  } catch (err) {
    console.error(`[notify] could not enqueue ${job.template} for ${job.orderId}`, err)
  }
}
