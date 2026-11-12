import {
  checkRateLimit,
  clientIp,
  handleShipmentWebhook,
  parseShippingSettings,
  type RateLimitStore,
  rateLimitKey,
  resolveShippingProviders,
  retryAfterSeconds,
} from '@commerce/core'
import { courierForWebhookCode } from '@commerce/core/courier-webhook-path'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, withStore } from '@commerce/db'
import { CourierError } from '@commerce/shipping'
import { eq } from 'drizzle-orm'
import { type Context, Hono } from 'hono'
import { isStoreId, peerAddress, rejectWebhook } from './webhook-reply'

/**
 * A wrong or missing webhook token (`CourierError` of kind `auth` from `parseWebhook`) is the
 * sender's fault: rejected with the same generic answer as any other bad call
 * (`webhook-reply.ts`), never a 500 the courier keeps retrying. Anything else rethrows.
 */
export function courierAuthFailure(err: unknown): {
  ok: false
  reason: string
  applied: []
} {
  if (err instanceof CourierError && err.kind === 'auth') {
    return { ok: false, reason: 'unauthorised', applied: [] }
  }
  throw err
}

/** A courier can retry the same scan several times; generous and per IP, like the payment webhook. */
const WEBHOOK_IP_RULE = { limit: 120, windowMs: 60_000 }

/**
 * POST /webhooks/shipments/:provider/:storeId
 * POST /webhooks/shipments/c/:code/:storeId (neutral alias, `COURIER_WEBHOOK_CODES`)
 * Registered in the courier's own dashboard (Delhivery: Merchant Portal →
 * API → Webhooks). The store id is in the URL the same way the payment
 * webhook does it; `provider.parseWebhook` is what actually authenticates
 * the call (a shared secret for Delhivery today - see
 * `DelhiveryConfig.webhookSecret`).
 */
export function shipmentWebhooks(db: Db, settingsSecret: string, rateLimitStore: RateLimitStore) {
  const app = new Hono()

  const handle = async (c: Context, providerId: string | null, storeId: string) => {
    const ip = clientIp(c.req.raw.headers, { peer: peerAddress(c) })
    const limit = await checkRateLimit(
      rateLimitStore,
      rateLimitKey('shipment-webhook:ip', ip),
      WEBHOOK_IP_RULE,
    )
    if (!limit.ok) {
      return c.json({ ok: false, reason: 'rate limited' }, 429, {
        'retry-after': String(retryAfterSeconds(limit)),
      })
    }
    if (!providerId) {
      // Same generic answer as any other bad call: the alias code was never issued.
      return rejectWebhook(
        c,
        'shipment-webhook',
        { providerId: '', storeId },
        'unknown courier code',
      )
    }
    const where = { providerId, storeId }
    if (!isStoreId(storeId)) {
      return rejectWebhook(c, 'shipment-webhook', where, 'store id is not a uuid')
    }
    const rawBody = await c.req.text()
    const headers: Record<string, string | undefined> = {}
    c.req.raw.headers.forEach((v, k) => {
      headers[k.toLowerCase()] = v
    })

    const outcome = await withStore(db, storeId, async (tx) => {
      const [s] = await tx
        .select({ shipping: store.shipping })
        .from(store)
        .where(eq(store.id, storeId))
      if (!s) return { ok: false as const, reason: 'unknown store', applied: [] }
      const { shipping } = await registriesForStore(tx, storeId)
      const { providers } = resolveShippingProviders(
        shipping,
        parseShippingSettings(s.shipping),
        settingsSecret,
      )
      const provider = providers.find((p) => p.id === providerId)
      if (!provider)
        return { ok: false as const, reason: 'provider not enabled for store', applied: [] }
      return handleShipmentWebhook({ storeId, tx }, provider, { rawBody, headers })
    }).catch(courierAuthFailure)

    if (!outcome.ok) {
      return rejectWebhook(c, 'shipment-webhook', where, outcome.reason ?? 'rejected')
    }
    c.var.log?.set({
      storeId,
      webhook: { provider: providerId, applied: outcome.applied.length },
    })
    return c.json(outcome)
  }

  app.post('/webhooks/shipments/:provider/:storeId', (c) => {
    const { provider, storeId } = c.req.param()
    return handle(c, provider, storeId)
  })
  // The neutral alias (`courierWebhookPath`): no courier name in the URL, for a courier whose
  // webhook form refuses its own name (Shiprocket). Same handler, same authentication.
  app.post('/webhooks/shipments/c/:code/:storeId', (c) => {
    const { code, storeId } = c.req.param()
    return handle(c, courierForWebhookCode(code), storeId)
  })
  return app
}
