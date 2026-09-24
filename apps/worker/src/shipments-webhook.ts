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
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

/** A courier can retry the same scan several times; generous and per IP, like the payment webhook. */
const WEBHOOK_IP_RULE = { limit: 120, windowMs: 60_000 }

/**
 * POST /webhooks/shipments/:provider/:storeId
 * Registered in the courier's own dashboard (Delhivery: Merchant Portal →
 * API → Webhooks). The store id is in the URL the same way the payment
 * webhook does it; `provider.parseWebhook` is what actually authenticates
 * the call (a shared secret for Delhivery today - see
 * `DelhiveryConfig.webhookSecret`).
 */
export function shipmentWebhooks(db: Db, settingsSecret: string, rateLimitStore: RateLimitStore) {
  const app = new Hono()
  app.post('/webhooks/shipments/:provider/:storeId', async (c) => {
    const { provider: providerId, storeId } = c.req.param()
    const ip = clientIp(c.req.raw.headers)
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
    })

    if (!outcome.ok) {
      console.warn(`[shipment-webhook] ${providerId}/${storeId} rejected: ${outcome.reason}`)
      return c.json({ ok: false, reason: outcome.reason }, 400)
    }
    console.log(`[shipment-webhook] ${providerId} applied ${outcome.applied.length} notice(s)`)
    return c.json(outcome)
  })
  return app
}
