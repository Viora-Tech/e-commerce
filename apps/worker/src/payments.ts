import {
  enqueueNotification,
  handlePaymentWebhook,
  type NotificationQueue,
  parsePaymentSettings,
  resolvePaymentProviders,
} from '@commerce/core'
import { registriesForStore } from '@commerce/core/registries'
import { type Db, store, withStore } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { Hono } from 'hono'

/**
 * POST /webhooks/payments/:provider/:storeId
 * The store id is in the URL because a gateway's dashboard is configured per
 * merchant; the signature check inside the adapter is what authenticates it.
 */
export function paymentWebhooks(db: Db, settingsSecret: string, notifications: NotificationQueue) {
  const app = new Hono()
  app.post('/webhooks/payments/:provider/:storeId', async (c) => {
    const { provider: providerId, storeId } = c.req.param()
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
      const provider = providers.find((p) => p.id === providerId)
      if (!provider) return { ok: false as const, reason: 'provider not enabled for store' }
      return handlePaymentWebhook({ storeId, tx }, provider, { rawBody, headers })
    })

    if (!outcome.ok) {
      console.warn(`[webhook] ${providerId}/${storeId} rejected: ${outcome.reason}`)
      return c.json({ ok: false, reason: outcome.reason }, 400)
    }
    console.log(
      `[webhook] ${providerId} ${outcome.eventId} applied=${outcome.applied} duplicate=${outcome.duplicate}`,
    )
    if (outcome.capturedOrderId) {
      await enqueueNotification(notifications, {
        storeId,
        orderId: outcome.capturedOrderId,
        template: 'payment_received',
      })
    }
    return c.json(outcome)
  })
  return app
}
