import {
  checkRateLimit,
  clientIp,
  handleSesSnsWebhook,
  type RateLimitStore,
  rateLimitKey,
  retryAfterSeconds,
  type SesWebhookDeps,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { peerAddress, rejectWebhook } from './webhook-reply'

/** SNS retries a failed delivery a few times; generous and per IP, like the other webhooks. */
const WEBHOOK_IP_RULE = { limit: 120, windowMs: 60_000 }

/** SES notifications are a few kilobytes; core refuses anything over 256 KB too. */
const MAX_BODY_BYTES = 256 * 1024

/** The message names its store only once it is verified, so a rejection logs none. */
const NO_STORE = { providerId: 'ses', storeId: '' }

/**
 * POST /webhooks/email/ses
 * The HTTPS subscription of the SNS topic that the SES configuration set publishes bounces and
 * complaints to (`SES_EVENTS_TOPIC_ARN`). Core's `handleSesSnsWebhook` checks the signature and
 * topic, confirms the subscription and updates the store's suppression list. A refused call gets
 * the generic rejection; a database failure is a 500 so SNS retries.
 */
export function emailFeedbackWebhooks(
  db: Db,
  deps: Pick<SesWebhookDeps, 'topicArn'> & Partial<SesWebhookDeps>,
  rateLimitStore: RateLimitStore,
) {
  const app = new Hono()
  const limitBody = bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: (c) => rejectWebhook(c, 'ses-feedback', NO_STORE, 'body too large'),
  })
  app.post('/webhooks/email/ses', limitBody, async (c) => {
    const ip = clientIp(c.req.raw.headers, { peer: peerAddress(c) })
    const limit = await checkRateLimit(
      rateLimitStore,
      rateLimitKey('email-feedback-webhook:ip', ip),
      WEBHOOK_IP_RULE,
    )
    if (!limit.ok) {
      return c.json({ ok: false, reason: 'rate limited' }, 429, {
        'retry-after': String(retryAfterSeconds(limit)),
      })
    }
    const outcome = await handleSesSnsWebhook(db, await c.req.text(), deps)
    if (outcome.status === 'rejected') {
      return rejectWebhook(c, 'ses-feedback', NO_STORE, outcome.reason)
    }
    c.var.log?.set({
      ...(outcome.status === 'recorded' ? { storeId: outcome.storeId } : {}),
      webhook: { provider: 'ses', outcome: outcome.status },
    })
    return c.json({ ok: true })
  })
  return app
}
