/**
 * "Connect Razorpay": Razorpay's Technology Partner OAuth. The merchant approves
 * our app on Razorpay, we swap the one-time code for tokens, and the store runs
 * on those tokens instead of pasted API keys.
 *
 * Every endpoint, parameter and response field here is from Razorpay's docs:
 * - https://razorpay.com/docs/partners/technology-partners/onboard-businesses/integrate-oauth/integration-steps/
 *   authorize: GET https://auth.razorpay.com/authorize?client_id&response_type=code&redirect_uri&scope&state
 *   token:     POST https://auth.razorpay.com/token (authorization_code with optional mode test|live,
 *              or refresh_token); response access_token, token_type Bearer, expires_in (90 days),
 *              public_token (rzp_test_oauth_...), refresh_token (180 days), razorpay_account_id.
 * - https://razorpay.com/docs/api/partners/webhooks/create/
 *   POST https://api.razorpay.com/v2/accounts/{account_id}/webhooks { url, alert_email?, secret, events }.
 *
 * Nothing here runs without `RAZORPAY_OAUTH_CLIENT_ID` and `RAZORPAY_OAUTH_CLIENT_SECRET`.
 */

const RAZORPAY_AUTHORIZE_URL = 'https://auth.razorpay.com/authorize'
const RAZORPAY_TOKEN_URL = 'https://auth.razorpay.com/token'
const RAZORPAY_API = 'https://api.razorpay.com'

/** Create orders, take payments, refund: the documented read-write scope. */
const RAZORPAY_OAUTH_SCOPE = 'read_write'

/** Refresh when the access token has less than this left (it lives 90 days). */
const REFRESH_BEFORE_MS = 7 * 24 * 60 * 60 * 1000

/** Events the platform processes (see RazorpayProvider.normalise). */
export const RAZORPAY_WEBHOOK_EVENTS = [
  'payment.authorized',
  'payment.captured',
  'payment.failed',
  'refund.processed',
  'qr_code.credited',
  'qr_code.closed',
] as const

export type RazorpayOAuthApp = { clientId: string; clientSecret: string }

export type RazorpayTokens = {
  accessToken: string
  refreshToken: string
  /** Checkout key (`key` option); plays the part of the key id. */
  publicToken: string
  accountId: string
  /** ISO time the access token stops working. */
  expiresAt: string
}

type TokenResponse = {
  access_token?: string
  token_type?: string
  expires_in?: number
  public_token?: string
  refresh_token?: string
  razorpay_account_id?: string
  error?: { description?: string } | string
  error_description?: string
}

/** The OAuth app's credentials from the environment, or null when "Connect Razorpay" is off. */
export function razorpayOAuthApp(env: Record<string, string | undefined>): RazorpayOAuthApp | null {
  const clientId = env.RAZORPAY_OAUTH_CLIENT_ID?.trim()
  const clientSecret = env.RAZORPAY_OAUTH_CLIENT_SECRET?.trim()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** Where the merchant's browser goes to approve the connection. */
export function razorpayAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const q = new URLSearchParams({
    client_id: input.clientId,
    response_type: 'code',
    redirect_uri: input.redirectUri,
    scope: RAZORPAY_OAUTH_SCOPE,
    state: input.state,
  })
  return `${RAZORPAY_AUTHORIZE_URL}?${q.toString()}`
}

function describeError(body: TokenResponse, status: number): string {
  if (typeof body.error === 'string') return body.error_description ?? body.error
  return body.error?.description ?? body.error_description ?? `Razorpay answered ${status}`
}

async function tokenRequest(
  fetchImpl: typeof fetch,
  body: Record<string, string>,
  now: Date,
): Promise<RazorpayTokens> {
  const res = await fetchImpl(RAZORPAY_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = (await res.json().catch(() => ({}))) as TokenResponse
  if (!res.ok || !json.access_token || !json.refresh_token || !json.public_token) {
    throw new Error(describeError(json, res.status))
  }
  const ttlSeconds = Number(json.expires_in ?? 0) || 90 * 24 * 60 * 60
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    publicToken: json.public_token,
    accountId: json.razorpay_account_id ?? '',
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
  }
}

/** Swap the one-time code from the redirect for tokens. `mode` picks Razorpay's test or live side. */
export function exchangeRazorpayCode(
  app: RazorpayOAuthApp,
  input: { code: string; redirectUri: string; mode: 'test' | 'live' },
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<RazorpayTokens> {
  return tokenRequest(
    fetchImpl,
    {
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: 'authorization_code',
      redirect_uri: input.redirectUri,
      code: input.code,
      mode: input.mode,
    },
    now,
  )
}

/** A fresh access token (and refresh token) before the old one runs out. */
export function refreshRazorpayToken(
  app: RazorpayOAuthApp,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<RazorpayTokens> {
  return tokenRequest(
    fetchImpl,
    {
      client_id: app.clientId,
      client_secret: app.clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    },
    now,
  )
}

/** True when a saved access token should be refreshed now. Missing or unreadable expiry counts as due. */
export function tokenRefreshDue(expiresAt: string | undefined, now: Date = new Date()): boolean {
  const t = expiresAt ? Date.parse(expiresAt) : Number.NaN
  return !Number.isFinite(t) || t - now.getTime() < REFRESH_BEFORE_MS
}

/** The saved-config fields a token response fills in (the public token doubles as the key id). */
export function oauthConfigFields(tokens: RazorpayTokens): Record<string, string> {
  return {
    keyId: tokens.publicToken,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    accessExpiresAt: tokens.expiresAt,
    ...(tokens.accountId ? { accountId: tokens.accountId } : {}),
  }
}

/**
 * The factory's `refreshCredentials`: for an OAuth connection whose access
 * token has under a week left (or already ran out; the refresh token lives
 * 180 days), fetch new tokens. Null when there is nothing to do, or when the
 * OAuth app is not configured on this deployment.
 */
export async function refreshOAuthConfig(
  saved: Record<string, string>,
  env: Record<string, string | undefined>,
  fetchImpl: typeof fetch = fetch,
  now: Date = new Date(),
): Promise<Record<string, string> | null> {
  if (!saved.accessToken || !saved.refreshToken) return null
  if (!tokenRefreshDue(saved.accessExpiresAt, now)) return null
  const app = razorpayOAuthApp(env)
  if (!app) return null
  return oauthConfigFields(await refreshRazorpayToken(app, saved.refreshToken, fetchImpl, now))
}

/**
 * Point the connected account's payment updates at our webhook URL, signed
 * with `secret`. Returns the Razorpay webhook id. The "Fix" button on
 * Settings → Payments calls this again when updates stop arriving.
 */
export async function registerRazorpayWebhook(
  input: { accessToken: string; accountId: string; url: string; secret: string },
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const res = await fetchImpl(
    `${RAZORPAY_API}/v2/accounts/${encodeURIComponent(input.accountId)}/webhooks`,
    {
      method: 'POST',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        url: input.url,
        secret: input.secret,
        events: [...RAZORPAY_WEBHOOK_EVENTS],
      }),
    },
  )
  const json = (await res.json().catch(() => ({}))) as {
    id?: string
    error?: { description?: string }
  }
  if (!res.ok || !json.id) {
    throw new Error(json.error?.description ?? `Razorpay answered ${res.status}`)
  }
  return json.id
}

/**
 * Re-point an existing webhook at our URL and re-tick our events, keeping its
 * secret (PATCH /v2/accounts/{account_id}/webhooks/{webhook_id}, documented at
 * https://razorpay.com/docs/api/partners/webhooks/). Returns false when
 * Razorpay no longer has that webhook, so the caller creates a new one.
 */
export async function updateRazorpayWebhook(
  input: { accessToken: string; accountId: string; webhookId: string; url: string },
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  const res = await fetchImpl(
    `${RAZORPAY_API}/v2/accounts/${encodeURIComponent(input.accountId)}/webhooks/${encodeURIComponent(input.webhookId)}`,
    {
      method: 'PATCH',
      headers: {
        authorization: `Bearer ${input.accessToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ url: input.url, events: [...RAZORPAY_WEBHOOK_EVENTS] }),
    },
  )
  if (res.status === 404) return false
  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { error?: { description?: string } }
    throw new Error(json.error?.description ?? `Razorpay answered ${res.status}`)
  }
  return true
}
