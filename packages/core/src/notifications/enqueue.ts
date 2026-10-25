import type { CustomMessage, TemplateId } from '@commerce/notifications'

/** BullMQ queue name. Braces keep every key on one Dragonfly/Redis slot. */
export const NOTIFICATIONS_QUEUE = '{notifications}-send'

export type NotificationJob = {
  storeId: string
  /** Empty for the one message without an order (`newsletter_confirm`, see `signupId`). */
  orderId: string
  template: TemplateId
  /**
   * Set for messages an order may get more than once (balance request,
   * reminders): the outbox row id. Makes each one its own job, and the
   * worker sends it even when the same template went out before.
   */
  key?: string | undefined
  /** For return messages: which return the message is about. */
  returnId?: string | undefined
  /** For refund_issued: which refund the message reports. */
  refundId?: string | undefined
  /** A hand-sent message's edited subject and note. */
  custom?: CustomMessage | undefined
  /** For newsletter_confirm: the pending `newsletter_signup`. */
  signupId?: string | undefined
  /** For contact_message: the `contact_message` row (Forms app). */
  contactMessageId?: string | undefined
  /** For review_reply: the `review` the store answered (Reviews app). */
  reviewId?: string | undefined
  /** For affiliate_update: the affiliate it goes to and what happened (Affiliates app). */
  affiliateId?: string | undefined
  affiliateNotice?: 'approved' | 'sale' | 'payout' | 'rejected' | undefined
  /** The commission (`sale`) or payout (`payout`) the message reports. */
  commissionId?: string | undefined
  payoutId?: string | undefined
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

// BullMQ allows ':' in a custom id only as exactly three parts: the key joins the third.
export const notificationJobId = (job: NotificationJob): string =>
  `${job.storeId}:${job.orderId}:${job.template}${job.key ? `-${job.key}` : ''}`

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
