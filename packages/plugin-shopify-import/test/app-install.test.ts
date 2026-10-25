import { createHmac } from 'node:crypto'
import { linkPlatformAccount } from '@commerce/core'
import { outboxEvent, storesForPlatformAccount, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  checkInstallCallback,
  exchangeInstallCode,
  LAUNCH_STORE,
  openInstallGrant,
  sealInstallGrant,
  shopifyAppFromEnv,
  shopifyInstallUrl,
  shopifyLaunchUrl,
  signInstallState,
} from '../src/app-install'
import { handleShopifyAppWebhook } from '../src/app-webhooks'
import { ALL_SCOPE_HANDLES } from '../src/client'
import { clientFor, connectApp, getConnection } from '../src/connection'
import { app, json, owner, SECRET, seedStore } from './helpers'

const APP = { clientId: 'koomerce-client', clientSecret: 'koomerce-secret' }
const SHOP = 'asha.myshopify.com'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** Shopify's own redirect: the query it sends, with its hmac over the rest. */
function shopifyRedirect(params: Record<string, string>, secret = APP.clientSecret) {
  const message = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&')
  const hmac = createHmac('sha256', secret).update(message).digest('hex')
  return new URLSearchParams({ ...params, hmac })
}

describe('the Koomerce app install', () => {
  it('is offered only with both app keys', () => {
    expect(shopifyAppFromEnv({ SHOPIFY_APP_CLIENT_ID: 'a' })).toBeNull()
    expect(
      shopifyAppFromEnv({ SHOPIFY_APP_CLIENT_ID: 'a', SHOPIFY_APP_CLIENT_SECRET: 'b' }),
    ).toEqual({ clientId: 'a', clientSecret: 'b' })
  })

  it('sends the merchant to their own shop with every read scope and our callback', () => {
    const url = new URL(
      shopifyInstallUrl(APP, {
        shopDomain: 'https://Asha.myshopify.com/admin',
        storeId: 'store-1',
        adminUrl: 'https://admin.example.com/',
        secret: SECRET,
      }),
    )
    expect(url.origin).toBe(`https://${SHOP}`)
    expect(url.pathname).toBe('/admin/oauth/authorize')
    expect(url.searchParams.get('client_id')).toBe(APP.clientId)
    expect(url.searchParams.get('scope')).toBe(ALL_SCOPE_HANDLES.join(','))
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://admin.example.com/api/apps/shopify-import/oauth/callback',
    )
    expect(() =>
      shopifyInstallUrl(APP, {
        shopDomain: 'evil.com',
        storeId: 's',
        adminUrl: 'https://a',
        secret: SECRET,
      }),
    ).toThrow()
  })

  it('accepts Shopify’s redirect only with its hmac, a matching shop and a fresh state', () => {
    const now = new Date('2026-10-23T10:00:00Z')
    const state = signInstallState({ storeId: 'store-1', shop: SHOP }, SECRET, now)
    const good = { code: 'c1', shop: SHOP, state, timestamp: '1792000000' }
    expect(checkInstallCallback(shopifyRedirect(good), APP, SECRET, now)).toEqual({
      storeId: 'store-1',
      shop: SHOP,
      code: 'c1',
    })
    // Signed with another app's secret.
    expect(() => checkInstallCallback(shopifyRedirect(good, 'x'), APP, SECRET, now)).toThrow()
    // Another shop than the one the install started for.
    expect(() =>
      checkInstallCallback(
        shopifyRedirect({ ...good, shop: 'other.myshopify.com' }),
        APP,
        SECRET,
        now,
      ),
    ).toThrow()
    // Thirty minutes later the state has lapsed.
    const later = new Date(now.getTime() + 31 * 60_000)
    expect(() => checkInstallCallback(shopifyRedirect(good), APP, SECRET, later)).toThrow()
  })

  it('asks for an expiring offline token and keeps its refresh token', async () => {
    const bodies: URLSearchParams[] = []
    const fake = (async (_url: string | URL | Request, init?: RequestInit) => {
      bodies.push(new URLSearchParams(String(init?.body)))
      return json({
        access_token: 'shpat_first',
        scope: 'read_products',
        expires_in: 3600,
        refresh_token: 'shprt_first',
        refresh_token_expires_in: 7_776_000,
      })
    }) as typeof fetch
    const token = await exchangeInstallCode(APP, SHOP, 'c1', fake)
    expect(bodies[0]?.get('expiring')).toBe('1')
    expect(bodies[0]?.get('code')).toBe('c1')
    expect(token.accessToken).toBe('shpat_first')
    expect(token.refreshToken).toBe('shprt_first')
    expect(token.expiresAt).not.toBeNull()
  })
})

describe('an app connection', () => {
  it('is saved encrypted, refreshed before it lapses, and the new refresh token kept', async () => {
    const storeId = await seedStore()
    const shopQuery = () => json({ data: { shop: { name: 'Asha', myshopifyDomain: SHOP } } })
    const tokenCalls: URLSearchParams[] = []
    const fake = (async (url: string | URL | Request, init?: RequestInit) => {
      if (String(url).endsWith('/admin/oauth/access_token')) {
        tokenCalls.push(new URLSearchParams(String(init?.body)))
        return json({
          access_token: 'shpat_second',
          expires_in: 3600,
          refresh_token: 'shprt_second',
          refresh_token_expires_in: 7_776_000,
        })
      }
      return shopQuery()
    }) as typeof fetch

    await withStore(app, storeId, (tx) =>
      connectApp(
        tx,
        storeId,
        SHOP,
        {
          accessToken: 'shpat_first',
          scope: '',
          // Already lapsing: the next client must refresh.
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          refreshToken: 'shprt_first',
          refreshExpiresAt: null,
        },
        SECRET,
        fake,
      ),
    )
    const view = await withStore(app, storeId, (tx) => getConnection(tx, SECRET))
    expect(view).toMatchObject({ shopDomain: SHOP, shopName: 'Asha', authMode: 'app' })

    await withStore(app, storeId, (tx) => clientFor(tx, SECRET, { fetch: fake, app: APP }))
    expect(tokenCalls[0]?.get('grant_type')).toBe('refresh_token')
    expect(tokenCalls[0]?.get('refresh_token')).toBe('shprt_first')

    // The second refresh uses the refresh token Shopify handed out the first time.
    await withStore(app, storeId, (tx) =>
      connectApp(
        tx,
        storeId,
        SHOP,
        {
          accessToken: 'shpat_third',
          scope: '',
          expiresAt: new Date(Date.now() + 60_000).toISOString(),
          refreshToken: 'shprt_third',
          refreshExpiresAt: null,
        },
        SECRET,
        fake,
      ),
    )
    await withStore(app, storeId, (tx) => clientFor(tx, SECRET, { fetch: fake, app: APP }))
    await withStore(app, storeId, (tx) => clientFor(tx, SECRET, { fetch: fake, app: APP }))
    expect(tokenCalls.map((b) => b.get('refresh_token'))).toEqual(['shprt_first', 'shprt_third'])
  })

  it('goes when the merchant uninstalls the app, with an event for automations', async () => {
    const storeId = await seedStore()
    const fake = (async () =>
      json({ data: { shop: { name: 'Asha', myshopifyDomain: SHOP } } })) as unknown as typeof fetch
    await withStore(app, storeId, async (tx) => {
      await connectApp(
        tx,
        storeId,
        SHOP,
        {
          accessToken: 'shpat_x',
          scope: '',
          expiresAt: null,
          refreshToken: null,
          refreshExpiresAt: null,
        },
        SECRET,
        fake,
      )
      await linkPlatformAccount({ tx, storeId }, 'shopify', SHOP)
    })

    const privacy = await handleShopifyAppWebhook(app, 'customers/redact', SHOP)
    expect(privacy.action).toBe('acknowledged')
    expect(await withStore(app, storeId, (tx) => getConnection(tx, SECRET))).not.toBeNull()

    const gone = await handleShopifyAppWebhook(app, 'app/uninstalled', SHOP)
    expect(gone).toMatchObject({ stores: 1, action: 'access removed' })
    expect(await withStore(app, storeId, (tx) => getConnection(tx, SECRET))).toBeNull()
    expect(await storesForPlatformAccount(app, 'shopify', SHOP)).toEqual([])
    const events = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    expect(events.map((e) => e.type)).toEqual(['shopify.app_uninstalled'])
  })
})

describe('an install Shopify starts', () => {
  const ADMIN = { adminUrl: 'https://admin.example.com', secret: SECRET }

  it('goes straight to the authorize screen for the signed shop, with no store in the state', () => {
    const query = shopifyRedirect({ shop: SHOP, timestamp: '1700000000', host: 'abc' })
    const url = new URL(shopifyLaunchUrl(APP, query, ADMIN) as string)
    expect(url.origin).toBe(`https://${SHOP}`)
    expect(url.pathname).toBe('/admin/oauth/authorize')
    const back = shopifyRedirect({
      code: 'c1',
      shop: SHOP,
      state: url.searchParams.get('state') as string,
      timestamp: '1700000001',
    })
    expect(checkInstallCallback(back, APP, SECRET)).toEqual({
      storeId: LAUNCH_STORE,
      shop: SHOP,
      code: 'c1',
    })
  })

  it('refuses an unsigned or forged launch', () => {
    expect(shopifyLaunchUrl(APP, new URLSearchParams({ shop: SHOP }), ADMIN)).toBeNull()
    const forged = shopifyRedirect({ shop: SHOP, timestamp: '1' }, 'not-the-secret')
    expect(shopifyLaunchUrl(APP, forged, ADMIN)).toBeNull()
    const notShopify = shopifyRedirect({ shop: 'evil.example.com', timestamp: '1' })
    expect(shopifyLaunchUrl(APP, notShopify, ADMIN)).toBeNull()
  })

  it('seals the access for after sign-in, and only for 30 minutes', () => {
    const token = {
      accessToken: 'shpat_x',
      scope: 'read_products',
      expiresAt: null,
      refreshToken: null,
      refreshExpiresAt: null,
    }
    const now = new Date('2026-10-24T10:00:00Z')
    const sealed = sealInstallGrant({ shop: SHOP, token }, SECRET, now)
    expect(sealed).not.toContain('shpat_x')
    expect(openInstallGrant(sealed, SECRET, now)).toEqual({ shop: SHOP, token })
    expect(openInstallGrant(sealed, 'another-secret-another-secret-123', now)).toBeNull()
    const parts = sealed.split('.')
    const body = parts.at(-1) as string
    const tampered = [...parts.slice(0, -1), `${body[0] === 'A' ? 'B' : 'A'}${body.slice(1)}`]
    expect(openInstallGrant(tampered.join('.'), SECRET, now)).toBeNull()
    expect(openInstallGrant(sealed, SECRET, new Date('2026-10-24T10:31:00Z'))).toBeNull()
  })
})
