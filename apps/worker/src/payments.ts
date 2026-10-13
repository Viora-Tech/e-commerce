import {
  checkRateLimit,
  clientIp,
  handlePaymentWebhook,
  parsePaymentSettings,
  type RateLimitStore,
  rateLimitKey,
  resolvePaymentProviders,
  retryAfterSeconds,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'
import { isStoreId, peerAddress, rejectWebhook } from './webhook-reply'

/**
 * Generous and per IP only (not per store): a gateway can legitimately retry
 * the same event several times, and one busy store's webhooks should not
 * starve another's on a shared IP allowlist.
 */
const WEBHOOK_IP_RULE = { limit: 120, windowMs: 60_000 }

/**
 * POST /webhooks/payments/:provider/:storeId
 * The store id is in the URL because a gateway's dashboard is configured per
 * merchant; the signature check inside the adapter is what authenticates it.
 */
export function paymentWebhooks(db: Db, settingsSecret: string, rateLimitStore: RateLimitStore) {
  const app = new Hono()
  app.post('/webhooks/payments/:provider/:storeId', async (c) => {
    const { provider: providerId, storeId } = c.req.param()
    const ip = clientIp(c.req.raw.headers, { peer: peerAddress(c) })
    const limit = await checkRateLimit(
      rateLimitStore,
      rateLimitKey('payment-webhook:ip', ip),
      WEBHOOK_IP_RULE,
    )
    if (!limit.ok) {
      return c.json({ ok: false, reason: 'rate limited' }, 429, {
        'retry-after': String(retryAfterSeconds(limit)),
      })
    }
    if (!isStoreId(storeId)) {
      return rejectWebhook(c, 'webhook', { providerId, storeId }, 'store id is not a uuid')
    }
    const rawBody = await c.req.text()
    const headers: Record<string, string | undefined> = {}
    c.req.raw.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v
    })

    const outcome = await withStore(db, storeId, async (tx) => {
      const [s] = await tx
        .select({ payments: store.payments })
        .from(store)
        .where(eq(store.id, storeId))
      if (!s) return { ok: false as const, reason: 'unknown store' }
      const { payments } = await registriesForStore(tx, storeId)
      const { providers } = resolvePaymentProviders(
        payments,
        parsePaymentSettings(s.payments),
        settingsSecret,
      )
      // A second method on the same gateway (Razorpay UPI QR) answers on the gateway's URL.
      const provider =
        providers.find((p) => p.id === providerId) ??
        providers.find((p) => p.webhookId === providerId)
      if (!provider) return { ok: false as const, reason: 'provider not enabled for store' }
      // handlePaymentWebhook -> applyPaymentStatus already writes the
      // order.paid outbox row in this same transaction when it captures.
      const handled = await handlePaymentWebhook({ storeId, tx }, provider, { rawBody, headers })
      return { ...handled, ack: provider.webhookAck }
    })

    if (!outcome.ok) return rejectWebhook(c, 'webhook', { providerId, storeId }, outcome.reason)
    c.var.log?.set({
      storeId,
      webhook: {
        provider: providerId,
        eventId: outcome.eventId,
        applied: outcome.applied,
        duplicate: outcome.duplicate,
      },
    })
    // Some gateways (Decentro) keep retrying unless the reply carries their acknowledgement.
    const { ack, ...result } = outcome
    return c.json({ ...result, ...ack })
  })
  return app
}
