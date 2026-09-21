import type { TemplateId } from '@commerce/notifications'

/** BullMQ queue name. Braces keep every key on one Dragonfly/Redis slot. */
export const NOTIFICATIONS_QUEUE = '{notifications}-send'

export type NotificationJob = {
  storeId: string
  orderId: string
  template: TemplateId
}

/**
 * The slice of a BullMQ Queue core needs. Apps hand in the real queue; core
 * stays free of Redis. Tests pass an array-backed fake.
 */
export type NotificationQueue = {
  add(
    name: string,
    data: NotificationJob,
    opts?: {
      jobId?: string
      attempts?: number
      backoff?: { type: 'exponential' | 'fixed'; delay: number }
    },
  ): Promise<unknown>
}

export const notificationJobId = (job: NotificationJob): string =>
  `${job.storeId}:${job.orderId}:${job.template}`

/**
 * Queue one order event. The job id makes a repeat call for the same order and
 * template a no-op, so callers can enqueue from any path that observes the
 * event (webhook, client confirm, admin) without double-sending.
 */
export async function enqueueNotification(queue: NotificationQueue, job: NotificationJob) {
  await queue.add(job.template, job, {
    jobId: notificationJobId(job),
    attempts: 3,
    backoff: { type: 'exponential', delay: 5_000 },
  })
}
