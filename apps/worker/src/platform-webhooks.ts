import {
  checkRateLimit,
  clientIp,
  deletionCode,
  forgetMetaUser,
  handleMetaWebhook,
  type MetaWebhookPayload,
  parseMetaSignedRequest,
  type RateLimitStore,
  rateLimitKey,
  retryAfterSeconds,
  verifyMetaSignature,
  verifyShopifyWebhook,
} from '@commerce/core'
import type { Db } from '@commerce/db'
import { handleShopifyAppWebhook, isShopifyAppTopic } from '@commerce/plugin-shopify-import/server'
import { type Context, Hono } from 'hono'
import { peerAddress, WEBHOOK_REJECTED_BODY } from './webhook-reply'

/** Platform-wide apps are busier than one store's gateway, so the per-IP allowance is wider. */
const PLATFORM_IP_RULE = { limit: 600, windowMs: 60_000 }

export type PlatformWebhookConfig = {
  /** META_APP_SECRET: signs Meta's webhooks and `signed_request`. */
  metaAppSecret: string | null
  /** META_WEBHOOK_VERIFY_TOKEN: the string typed into the Meta app's webhook settings. */
  metaVerifyToken: string | null
  /** SHOPIFY_APP_CLIENT_SECRET: signs the Koomerce Shopify app's webhooks. */
  shopifySecret: string | null
  /** SETTINGS_SECRET: signs data deletion confirmation codes. */
  settingsSecret: string
  /** ADMIN_URL: the deletion status page lives there. */
  adminUrl: string
}

export type PlatformWebhookHandlers = {
  meta: (db: Db, payload: MetaWebhookPayload) => Promise<number>
  forgetMetaUser: (db: Db, userId: string) => Promise<number>
  shopify: typeof handleShopifyAppWebhook
}

const DEFAULT_HANDLERS: PlatformWebhookHandlers = {
  meta: (db, payload) => handleMetaWebhook(db, payload),
  forgetMetaUser: (db, userId) => forgetMetaUser(db, userId),
  shopify: handleShopifyAppWebhook,
}

function reject(c: Context, platform: string, reason: string, status: 400 | 401 | 403 = 400) {
  c.var.log?.warn('platform webhook rejected', { webhook: { kind: 'platform', platform, reason } })
  return c.json(WEBHOOK_REJECTED_BODY, status)
}

/**
 * Callbacks to the platform's own apps on Meta and Shopify (one URL each for every store):
 *
 * - `GET  /webhooks/platform/meta`: Meta's subscribe check (`hub.verify_token` → `hub.challenge`).
 * - `POST /webhooks/platform/meta`: WhatsApp account webhooks, `X-Hub-Signature-256` checked.
 * - `POST /webhooks/platform/meta/deauthorize` and `/data-deletion`: Meta's `signed_request`
 *   naming a Facebook user; their access goes. Data deletion answers `{ url, confirmation_code }`.
 * - `POST /webhooks/platform/shopify`: the Koomerce Shopify app's `app/uninstalled` and privacy
 *   webhooks, `X-Shopify-Hmac-Sha256` checked (a bad one answers 401, as Shopify asks).
 */
export function platformWebhooks(
  db: Db,
  config: PlatformWebhookConfig,
  rateLimitStore: RateLimitStore,
  handlers: PlatformWebhookHandlers = DEFAULT_HANDLERS,
) {
  const app = new Hono()

  app.use('/webhooks/platform/*', async (c, next) => {
    const ip = clientIp(c.req.raw.headers, { peer: peerAddress(c) })
    const limit = await checkRateLimit(
      rateLimitStore,
      rateLimitKey('platform-webhook:ip', ip),
      PLATFORM_IP_RULE,
    )
    if (!limit.ok)
      return c.json({ ok: false, reason: 'rate limited' }, 429, {
        'retry-after': String(retryAfterSeconds(limit)),
      })
    await next()
  })

  app.get('/webhooks/platform/meta', (c) => {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge') ?? ''
    if (!config.metaVerifyToken || mode !== 'subscribe' || token !== config.metaVerifyToken)
      return reject(c, 'meta', 'verify token mismatch', 403)
    return c.text(challenge)
  })

  app.post('/webhooks/platform/meta', async (c) => {
    const raw = await c.req.text()
    if (
      !config.metaAppSecret ||
      !verifyMetaSignature(raw, c.req.header('x-hub-signature-256'), config.metaAppSecret)
    )
      return reject(c, 'meta', 'bad signature')
    let payload: MetaWebhookPayload
    try {
      payload = JSON.parse(raw) as MetaWebhookPayload
    } catch {
      return reject(c, 'meta', 'not json')
    }
    const recorded = await handlers.meta(db, payload)
    c.var.log?.set({ webhook: { platform: 'meta', object: payload.object, recorded } })
    // Always 200 once verified: Meta retries anything else for days.
    return c.json({ ok: true })
  })

  const signedUser = async (c: Context) => {
    if (!config.metaAppSecret) return null
    const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>)
    const signed = typeof form.signed_request === 'string' ? form.signed_request : null
    return parseMetaSignedRequest(signed, config.metaAppSecret)?.user_id ?? null
  }

  app.post('/webhooks/platform/meta/deauthorize', async (c) => {
    const userId = await signedUser(c)
    if (!userId) return reject(c, 'meta', 'bad signed_request')
    const stores = await handlers.forgetMetaUser(db, userId)
    c.var.log?.set({ webhook: { platform: 'meta', event: 'deauthorize', stores } })
    return c.json({ ok: true })
  })

  app.post('/webhooks/platform/meta/data-deletion', async (c) => {
    const userId = await signedUser(c)
    if (!userId) return reject(c, 'meta', 'bad signed_request')
    const stores = await handlers.forgetMetaUser(db, userId)
    const code = deletionCode(config.settingsSecret)
    c.var.log?.set({ webhook: { platform: 'meta', event: 'data-deletion', stores } })
    return c.json({
      url: `${config.adminUrl.replace(/\/+$/, '')}/api/platform/meta/deletion?code=${encodeURIComponent(code)}`,
      confirmation_code: code,
    })
  })

  app.post('/webhooks/platform/shopify', async (c) => {
    const raw = await c.req.text()
    if (
      !config.shopifySecret ||
      !verifyShopifyWebhook(raw, c.req.header('x-shopify-hmac-sha256'), config.shopifySecret)
    )
      return reject(c, 'shopify', 'bad hmac', 401)
    const topic = c.req.header('x-shopify-topic') ?? ''
    const shop = c.req.header('x-shopify-shop-domain') ?? ''
    // Verified but not a topic we handle: still 200, so Shopify does not retry it.
    if (!isShopifyAppTopic(topic)) return c.json({ ok: true, ignored: topic })
    const outcome = await handlers.shopify(db, topic, shop)
    c.var.log?.set({ webhook: { platform: 'shopify', ...outcome } })
    return c.json({ ok: true })
  })

  return app
}
