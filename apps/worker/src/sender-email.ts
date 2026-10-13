import { getPlatformEmail, pollSenderEmails } from '@commerce/core'
import type { Db } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { type IORedis, Queue, SENDER_EMAIL_VERIFY_QUEUE, Worker } from '@commerce/queue'

/** How often sender domains are checked. SES itself looks for the records for up to 72 hours. */
export const SENDER_CHECK_EVERY_MS = 5 * 60_000

/**
 * One repeat job asks SES about every sender domain still pending, and about
 * verified ones once a day (someone may delete the DKIM records later). A
 * merchant who adds the records and walks away still ends up verified, and a
 * domain that stops verifying falls back to the platform sender on its own.
 */
export function createSenderEmailPoller(connection: IORedis, db: Db) {
  const queue = new Queue(SENDER_EMAIL_VERIFY_QUEUE, { connection })
  const worker = new Worker(
    SENDER_EMAIL_VERIFY_QUEUE,
    async () => {
      const platform = getPlatformEmail()
      const r = await pollSenderEmails(db, {
        identities: platform.identities,
        reservedDomains: platform.reservedDomains,
        log: (m) => logger.warn(m, { area: 'sender-email' }),
      })
      if (r.checked > 0 || r.failed > 0) logger.info('sender emails checked', { ...r })
      return r
    },
    { connection },
  )
  return { queue, worker }
}
