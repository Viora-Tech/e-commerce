/**
 * The Koomerce migration app on Shopify: the platform's own Shopify app (one per deployment,
 * `integrations/shopify/shopify.app.toml`), installed on a merchant's shop through Shopify's
 * authorization code grant. The merchant types their shop address, approves the read scopes
 * on Shopify, and comes back connected: no Dev Dashboard app or token to make by hand.
 *
 * - Install URL: `https://{shop}/admin/oauth/authorize?client_id&scope&redirect_uri&state`.
 * - Callback: Shopify's `hmac` over the query (`verifyShopifyQueryHmac`), our signed state
 *   (store, shop, nonce, 30 minutes), then the code exchange.
 * - Launch: an install Shopify starts (the App Store's Install button, or "Open app") lands on
 *   the app URL with Shopify's signed `shop`; it goes straight to the authorize screen with a
 *   state for no store yet (`LAUNCH_STORE`). Back from Shopify, a signed-in member connects their
 *   current store; a signed-out one gets a sealed grant (`sealInstallGrant`) to claim after
 *   signing in, since the code can be swapped only once and soon.
 * - Tokens: expiring offline tokens (`expiring=1`): an access token for about an hour and a
 *   refresh token, swapped again with `grant_type=refresh_token` before it lapses. A response
 *   without `expires_in` (a non-expiring offline token) is kept as is.
 *
 * Verified against https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant
 * and https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/offline-access-tokens
 * Every call takes `fetchImpl`, so tests never reach Shopify.
 */
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { decryptSecret, encryptSecret, verifyShopifyQueryHmac } from '@commerce/core'
import { ALL_SCOPE_HANDLES } from './client'
import { ShopifyOAuthError } from './oauth'
import { normaliseShopDomain } from './shopify-client'

/** The platform's Shopify app, from `SHOPIFY_APP_CLIENT_ID` / `SHOPIFY_APP_CLIENT_SECRET`. */
export type ShopifyApp = { clientId: string; clientSecret: string }

/** Null (both keys needed) keeps the merchant on the Dev Dashboard and token ways in. */
export function shopifyAppFromEnv(env: Record<string, string | undefined>): ShopifyApp | null {
  const clientId = env.SHOPIFY_APP_CLIENT_ID?.trim()
  const clientSecret = env.SHOPIFY_APP_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** Where Shopify sends the merchant back; listed under `[auth] redirect_urls` in the toml. */
const shopifyAppRedirectUri = (adminUrl: string) =>
  `${adminUrl.replace(/\/+$/, '')}/api/apps/shopify-import/oauth/callback`

/** Every read scope the importer uses; the app's toml asks for the same list. */
const SHOPIFY_APP_SCOPES = ALL_SCOPE_HANDLES.join(',')

/* ---------- the signed state ---------- */

const STATE_TTL_MS = 30 * 60_000

type InstallState = { storeId: string; shop: string; n: string; exp: number }

const mac = (payload: string, secret: string) =>
  createHmac('sha256', `shopify-app-install:${secret}`).update(payload).digest('base64url')

export function signInstallState(
  input: { storeId: string; shop: string },
  secret: string,
  now = new Date(),
): string {
  const payload = Buffer.from(
    JSON.stringify({
      ...input,
      n: randomBytes(12).toString('base64url'),
      exp: now.getTime() + STATE_TTL_MS,
    }),
  ).toString('base64url')
  return `${payload}.${mac(payload, secret)}`
}

function verifyInstallState(raw: string, secret: string, now = new Date()): InstallState | null {
  const [payload, given] = raw.split('.')
  if (!payload || !given) return null
  const expected = Buffer.from(mac(payload, secret))
  const actual = Buffer.from(given)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null
  try {
    const s = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as InstallState
    if (typeof s.storeId !== 'string' || typeof s.shop !== 'string' || s.exp < now.getTime())
      return null
    return s
  } catch {
    return null
  }
}

/* ---------- install and callback ---------- */

/** The URL that asks the merchant to install the app on their shop. */
export function shopifyInstallUrl(
  app: ShopifyApp,
  input: { shopDomain: string; storeId: string; adminUrl: string; secret: string },
  now = new Date(),
): string {
  const shop = normaliseShopDomain(input.shopDomain)
  if (!shop) throw new ShopifyOAuthError('Enter your store address, like your-store.myshopify.com')
  const q = new URLSearchParams({
    client_id: app.clientId,
    scope: SHOPIFY_APP_SCOPES,
    redirect_uri: shopifyAppRedirectUri(input.adminUrl),
    state: signInstallState({ storeId: input.storeId, shop }, input.secret, now),
  })
  return `https://${shop}/admin/oauth/authorize?${q}`
}

/** The state's store for an install Shopify started: the member's store is known only after sign-in. */
export const LAUNCH_STORE = ''

/**
 * Shopify opened the app URL (an install from the App Store, or "Open app"): with Shopify's
 * hmac over the query and a real shop, the authorize URL for that shop; otherwise null.
 */
export function shopifyLaunchUrl(
  app: ShopifyApp,
  query: URLSearchParams,
  input: { adminUrl: string; secret: string },
  now = new Date(),
): string | null {
  if (!query.get('hmac') || !verifyShopifyQueryHmac(query, app.clientSecret)) return null
  const shop = normaliseShopDomain(query.get('shop') ?? '')
  if (!shop) return null
  return shopifyInstallUrl(app, { shopDomain: shop, storeId: LAUNCH_STORE, ...input }, now)
}

export type InstallCallback = { storeId: string; shop: string; code: string }

/**
 * Shopify's redirect after the merchant approved: its `hmac`, a real `*.myshopify.com` shop
 * that matches the one in our state, and an unexpired state. Throws a readable error.
 */
export function checkInstallCallback(
  query: URLSearchParams,
  app: ShopifyApp,
  secret: string,
  now = new Date(),
): InstallCallback {
  if (!verifyShopifyQueryHmac(query, app.clientSecret))
    throw new ShopifyOAuthError('Shopify’s reply could not be verified. Start the install again.')
  const shop = normaliseShopDomain(query.get('shop') ?? '')
  const state = verifyInstallState(query.get('state') ?? '', secret, now)
  const code = query.get('code')
  if (!shop || !state || state.shop !== shop || !code)
    throw new ShopifyOAuthError('This install link expired. Start the install again.')
  return { storeId: state.storeId, shop, code }
}

export type AppToken = {
  accessToken: string
  scope: string
  /** ISO time the access token lapses; null for a non-expiring offline token. */
  expiresAt: string | null
  refreshToken: string | null
  refreshExpiresAt: string | null
}

type TokenResponse = {
  access_token?: string
  scope?: string
  expires_in?: number
  refresh_token?: string
  refresh_token_expires_in?: number
}

const inSeconds = (s: number | undefined, now: number) =>
  typeof s === 'number' && s > 0 ? new Date(now + s * 1000).toISOString() : null

async function tokenCall(
  shop: string,
  body: Record<string, string>,
  fetchImpl: typeof fetch,
): Promise<AppToken> {
  let res: Response
  try {
    res = await fetchImpl(`https://${shop}/admin/oauth/access_token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
      body: new URLSearchParams(body).toString(),
      signal: AbortSignal.timeout(30_000),
    })
  } catch {
    throw new ShopifyOAuthError('Could not reach Shopify. Try again in a moment.')
  }
  if (res.status === 400 || res.status === 401)
    throw new ShopifyOAuthError('Shopify refused the app’s access. Install the app again.')
  if (!res.ok) throw new ShopifyOAuthError(`Shopify could not issue access (${res.status}).`)
  const t = (await res.json().catch(() => ({}))) as TokenResponse
  if (!t.access_token) throw new ShopifyOAuthError('Shopify did not return an access token.')
  const now = Date.now()
  return {
    accessToken: t.access_token,
    scope: t.scope ?? '',
    expiresAt: inSeconds(t.expires_in, now),
    refreshToken: t.refresh_token ?? null,
    refreshExpiresAt: inSeconds(t.refresh_token_expires_in, now),
  }
}

/** The one-time code → an (expiring) offline access token and its refresh token. */
export const exchangeInstallCode = (
  app: ShopifyApp,
  shop: string,
  code: string,
  fetchImpl: typeof fetch = fetch,
) =>
  tokenCall(
    shop,
    { client_id: app.clientId, client_secret: app.clientSecret, code, expiring: '1' },
    fetchImpl,
  )

/** A fresh access token (and a new refresh token) before the old one lapses. */
export const refreshAppToken = (
  app: ShopifyApp,
  shop: string,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
) =>
  tokenCall(
    shop,
    {
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    fetchImpl,
  )

/**
 * A non-expiring offline token → an expiring one and its refresh token (Shopify's token
 * exchange; required for public apps from 1 Jan 2027). No merchant session is needed. Shopify
 * retires the old token on success; repeating the call with it within seven days returns the
 * same pair, so a lost response can be recovered.
 * https://shopify.dev/docs/apps/build/authentication-authorization/migrate-to-expiring-offline-access-tokens
 */
export const migrateAppToken = (
  app: ShopifyApp,
  shop: string,
  nonExpiringToken: string,
  fetchImpl: typeof fetch = fetch,
) =>
  tokenCall(
    shop,
    {
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: nonExpiringToken,
      subject_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      expiring: '1',
    },
    fetchImpl,
  )

/* ---------- a launch grant, claimed after sign-in ---------- */

const GRANT_TTL_MS = 30 * 60_000

const grantKey = (secret: string) => `shopify-app-grant:${secret}`

export type InstallGrant = { shop: string; token: AppToken }

/** The swapped token for a signed-out launch, encrypted for a short-lived cookie. */
export function sealInstallGrant(grant: InstallGrant, secret: string, now = new Date()): string {
  return encryptSecret(
    JSON.stringify({ ...grant, exp: now.getTime() + GRANT_TTL_MS }),
    grantKey(secret),
  )
}

/** The grant back, or null when it was tampered with, is malformed or expired. */
export function openInstallGrant(
  raw: string,
  secret: string,
  now = new Date(),
): InstallGrant | null {
  try {
    const g = JSON.parse(decryptSecret(raw, grantKey(secret))) as InstallGrant & { exp: number }
    if (typeof g.shop !== 'string' || !g.token?.accessToken || g.exp < now.getTime()) return null
    return { shop: g.shop, token: g.token }
  } catch {
    return null
  }
}
