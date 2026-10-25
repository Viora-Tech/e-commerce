import { createHmac } from 'node:crypto'
import { createMemoryRateLimitStore, isDeletionCode } from '@commerce/core'
import type { Db } from '@commerce/db'
import { describe, expect, it, vi } from 'vitest'
import { type PlatformWebhookHandlers, platformWebhooks } from './platform-webhooks'

const META_SECRET = 'meta-app-secret'
const SHOPIFY_SECRET = 'shopify-app-secret'
const SETTINGS = 'settings-secret-settings-secret'

const db = {} as Db

function setup() {
  const handlers: PlatformWebhookHandlers = {
    meta: vi.fn(async () => 1),
    forgetMetaUser: vi.fn(async () => 2),
    shopify: vi.fn(async (_db, topic) => ({ topic, stores: 1, action: 'access removed' })),
  }
  const app = platformWebhooks(
    db,
    {
      metaAppSecret: META_SECRET,
      metaVerifyToken: 'verify-token-verify-token',
      shopifySecret: SHOPIFY_SECRET,
      settingsSecret: SETTINGS,
      adminUrl: 'https://admin.example.com/',
    },
    createMemoryRateLimitStore(),
    handlers,
  )
  return { app, handlers }
}

const signedRequest = (userId: string, secret = META_SECRET) => {
  const payload = Buffer.from(
    JSON.stringify({ user_id: userId, algorithm: 'HMAC-SHA256' }),
  ).toString('base64url')
  return `${createHmac('sha256', secret).update(payload).digest('base64url')}.${payload}`
}

describe('Meta webhooks', () => {
  it('answers the subscribe check only with our verify token', async () => {
    const { app } = setup()
    const ok = await app.request(
      '/webhooks/platform/meta?hub.mode=subscribe&hub.verify_token=verify-token-verify-token&hub.challenge=42',
    )
    expect(ok.status).toBe(200)
    expect(await ok.text()).toBe('42')
    const bad = await app.request(
      '/webhooks/platform/meta?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42',
    )
    expect(bad.status).toBe(403)
  })

  it('reads a POST only with a valid X-Hub-Signature-256', async () => {
    const { app, handlers } = setup()
    const body = JSON.stringify({ object: 'whatsapp_business_account', entry: [] })
    const sig = `sha256=${createHmac('sha256', META_SECRET).update(body).digest('hex')}`
    const ok = await app.request('/webhooks/platform/meta', {
      method: 'POST',
      body,
      headers: { 'x-hub-signature-256': sig },
    })
    expect(ok.status).toBe(200)
    expect(handlers.meta).toHaveBeenCalledOnce()
    const bad = await app.request('/webhooks/platform/meta', {
      method: 'POST',
      body,
      headers: { 'x-hub-signature-256': 'sha256=00' },
    })
    expect(bad.status).toBe(400)
    expect(handlers.meta).toHaveBeenCalledOnce()
  })

  it('data deletion forgets the user and answers a status URL with a code we can check', async () => {
    const { app, handlers } = setup()
    const res = await app.request('/webhooks/platform/meta/data-deletion', {
      method: 'POST',
      body: new URLSearchParams({ signed_request: signedRequest('fb1') }),
    })
    expect(res.status).toBe(200)
    const out = (await res.json()) as { url: string; confirmation_code: string }
    expect(handlers.forgetMetaUser).toHaveBeenCalledWith(db, 'fb1')
    expect(out.url).toBe(
      `https://admin.example.com/api/platform/meta/deletion?code=${encodeURIComponent(out.confirmation_code)}`,
    )
    expect(isDeletionCode(out.confirmation_code, SETTINGS)).toBe(true)
  })

  it('refuses a deauthorize call signed with another secret', async () => {
    const { app, handlers } = setup()
    const res = await app.request('/webhooks/platform/meta/deauthorize', {
      method: 'POST',
      body: new URLSearchParams({ signed_request: signedRequest('fb1', 'other') }),
    })
    expect(res.status).toBe(400)
    expect(handlers.forgetMetaUser).not.toHaveBeenCalled()
  })
})

describe('Shopify app webhooks', () => {
  const post = (app: ReturnType<typeof setup>['app'], topic: string, hmac?: string) => {
    const body = JSON.stringify({ shop_domain: 'asha.myshopify.com' })
    return app.request('/webhooks/platform/shopify', {
      method: 'POST',
      body,
      headers: {
        'x-shopify-topic': topic,
        'x-shopify-shop-domain': 'asha.myshopify.com',
        'x-shopify-hmac-sha256':
          hmac ?? createHmac('sha256', SHOPIFY_SECRET).update(body).digest('base64'),
      },
    })
  }

  it('handles uninstall and the privacy topics with a valid HMAC', async () => {
    const { app, handlers } = setup()
    for (const topic of [
      'app/uninstalled',
      'shop/redact',
      'customers/redact',
      'customers/data_request',
    ])
      expect((await post(app, topic)).status).toBe(200)
    expect(handlers.shopify).toHaveBeenCalledTimes(4)
  })

  it('answers 401 to a bad HMAC, as Shopify requires', async () => {
    const { app, handlers } = setup()
    expect((await post(app, 'customers/redact', 'bm9wZQ==')).status).toBe(401)
    expect(handlers.shopify).not.toHaveBeenCalled()
  })

  it('acknowledges a verified topic it does not handle without acting', async () => {
    const { app, handlers } = setup()
    expect((await post(app, 'products/update')).status).toBe(200)
    expect(handlers.shopify).not.toHaveBeenCalled()
  })
})
