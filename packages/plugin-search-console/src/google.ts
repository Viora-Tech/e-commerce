import { createHash } from 'node:crypto'
import { CommerceError } from '@commerce/core'
import type { SearchConsoleSite } from './settings'

/**
 * Google sign-in (OAuth 2.0 with PKCE) and the Search Console API, over plain `fetch`: no
 * Google client library. Server side only: it carries the store's tokens.
 *
 * Every endpoint, parameter and response field is from Google's docs:
 * - OAuth for web server apps: https://developers.google.com/identity/protocols/oauth2/web-server
 *   authorize GET https://accounts.google.com/o/oauth2/v2/auth (client_id, redirect_uri,
 *   response_type=code, scope, access_type=offline, prompt=consent, include_granted_scopes,
 *   state, code_challenge, code_challenge_method=S256); token POST
 *   https://oauth2.googleapis.com/token (form: authorization_code + code_verifier, or
 *   refresh_token); revoke POST https://oauth2.googleapis.com/revoke (form: token).
 * - Search Console API v3: https://developers.google.com/webmaster-tools/v1/api_reference_index
 *   sites.list, searchanalytics.query, sitemaps.list, sitemaps.submit.
 */

const AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const REVOKE_URL = 'https://oauth2.googleapis.com/revoke'
const API = 'https://searchconsole.googleapis.com/webmasters/v3'

/**
 * `webmasters` (not `webmasters.readonly`): submitting a sitemap needs it, and it covers every
 * read. `openid email` only to show which Google account is connected.
 */
const WEBMASTERS_SCOPE = 'https://www.googleapis.com/auth/webmasters'
const SCOPES = ['openid', 'email', WEBMASTERS_SCOPE]

/** Google answers within seconds; a hung call must not hold a request or a job. */
const TIMEOUT_MS = 20_000

/**
 * `GOOGLE_AUTH`: Google refused the saved access (revoked, expired, scope removed), so the
 * merchant must connect again. `GOOGLE_API`: any other refusal, in Google's own words.
 */
export class SearchConsoleError extends CommerceError {
  constructor(code: 'GOOGLE_AUTH' | 'GOOGLE_API', message: string) {
    super(code, message)
  }
}

export type GoogleOAuthApp = { clientId: string; clientSecret: string }

/**
 * The Google OAuth client for Search Console: `GSC_GOOGLE_CLIENT_ID`/`_SECRET`, or, when both
 * are unset, the merchant sign-in client (`MERCHANT_GOOGLE_CLIENT_ID`/`_SECRET`). Null turns
 * "Connect Google Search Console" off.
 */
export function searchConsoleOAuthApp(
  env: Record<string, string | undefined>,
): GoogleOAuthApp | null {
  const own = { id: env.GSC_GOOGLE_CLIENT_ID?.trim(), secret: env.GSC_GOOGLE_CLIENT_SECRET?.trim() }
  if (own.id && own.secret) return { clientId: own.id, clientSecret: own.secret }
  if (own.id || own.secret) return null
  const id = env.MERCHANT_GOOGLE_CLIENT_ID?.trim()
  const secret = env.MERCHANT_GOOGLE_CLIENT_SECRET?.trim()
  return id && secret ? { clientId: id, clientSecret: secret } : null
}

/** Where Google sends the merchant back; must be listed on the OAuth client. */
export const searchConsoleRedirectUri = (adminUrl: string): string =>
  `${adminUrl.replace(/\/+$/, '')}/api/apps/google-search-console/oauth/callback`

/** PKCE S256: the challenge Google gets now for the verifier we send with the code. */
export const pkceChallenge = (verifier: string): string =>
  createHash('sha256').update(verifier).digest('base64url')

/** Where the merchant's browser goes to approve the connection. */
export function googleAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
  codeVerifier: string
}): string {
  const q = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: SCOPES.join(' '),
    // A refresh token, every time: the worker reads the numbers while nobody is signed in.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
    code_challenge: pkceChallenge(input.codeVerifier),
    code_challenge_method: 'S256',
  })
  return `${AUTHORIZE_URL}?${q.toString()}`
}

type TokenResponse = {
  access_token?: string
  refresh_token?: string
  id_token?: string
  scope?: string
  error?: string
  error_description?: string
}

async function tokenRequest(
  fetchImpl: typeof fetch,
  form: Record<string, string>,
): Promise<TokenResponse> {
  let res: Response
  try {
    res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(form).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
  } catch {
    throw new SearchConsoleError('GOOGLE_API', 'Could not reach Google. Try again in a minute.')
  }
  const json = (await res.json().catch(() => ({}))) as TokenResponse
  if (res.ok && json.access_token) return json
  if (json.error === 'invalid_grant') {
    throw new SearchConsoleError(
      'GOOGLE_AUTH',
      'Google no longer accepts this connection. Connect Google Search Console again.',
    )
  }
  throw new SearchConsoleError(
    'GOOGLE_API',
    json.error_description ?? json.error ?? `Google answered ${res.status}`,
  )
}

/** The email inside Google's ID token. It came straight from Google over TLS, so it is not re-verified. */
function emailOf(idToken: string | undefined): string {
  const payload = idToken?.split('.')[1]
  if (!payload) return ''
  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      email?: unknown
    }
    return typeof claims.email === 'string' ? claims.email : ''
  } catch {
    return ''
  }
}

export type GoogleConnection = { refreshToken: string; accessToken: string; email: string }

/** Swap the one-time code from the redirect for tokens. Refuses a grant without Search Console access. */
export async function exchangeGoogleCode(
  app: GoogleOAuthApp,
  input: { code: string; redirectUri: string; codeVerifier: string },
  fetchImpl: typeof fetch = fetch,
): Promise<GoogleConnection> {
  const json = await tokenRequest(fetchImpl, {
    grant_type: 'authorization_code',
    code: input.code,
    redirect_uri: input.redirectUri,
    client_id: app.clientId,
    client_secret: app.clientSecret,
    code_verifier: input.codeVerifier,
  })
  if (!json.scope?.split(' ').includes(WEBMASTERS_SCOPE)) {
    throw new SearchConsoleError(
      'GOOGLE_AUTH',
      'Search Console access was not ticked on Google. Connect again and allow it.',
    )
  }
  if (!json.refresh_token) {
    throw new SearchConsoleError(
      'GOOGLE_API',
      'Google did not hand over lasting access. Try again.',
    )
  }
  return {
    refreshToken: json.refresh_token,
    accessToken: json.access_token ?? '',
    email: emailOf(json.id_token),
  }
}

/** A fresh access token (it lives an hour) from the saved refresh token. */
export async function refreshGoogleAccessToken(
  app: GoogleOAuthApp,
  refreshToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const json = await tokenRequest(fetchImpl, {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: app.clientId,
    client_secret: app.clientSecret,
  })
  return json.access_token ?? ''
}

/** Ends the grant at Google. Best effort: a token Google already dropped is fine. */
export async function revokeGoogleToken(
  token: string,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const res = await fetchImpl(REVOKE_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    return res.ok
  } catch {
    return false
  }
}

/** One Search Analytics row as Google sends it. */
export type GoogleSearchRow = {
  keys?: string[]
  clicks?: number
  impressions?: number
  ctr?: number
  position?: number
}

export type GoogleSearchQuery = {
  startDate: string
  endDate: string
  dimensions: ('page' | 'query' | 'device' | 'country')[]
  rowLimit?: number
}

/** One sitemap as Search Console lists it. Counts arrive as strings (int64). */
export type GoogleSitemap = {
  path?: string
  lastSubmitted?: string
  lastDownloaded?: string
  isPending?: boolean
  isSitemapsIndex?: boolean
  type?: string
  warnings?: string
  errors?: string
  contents?: { type?: string; submitted?: string; indexed?: string }[]
}

type ApiError = { error?: { code?: number; message?: string } }

/** The Search Console API for one access token. */
export function searchConsoleClient(accessToken: string, fetchImpl: typeof fetch = fetch) {
  const call = async <T>(path: string, init: { method: string; body?: unknown }): Promise<T> => {
    let res: Response
    try {
      res = await fetchImpl(`${API}${path}`, {
        method: init.method,
        headers: {
          authorization: `Bearer ${accessToken}`,
          ...(init.body ? { 'content-type': 'application/json' } : {}),
        },
        ...(init.body ? { body: JSON.stringify(init.body) } : {}),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
    } catch {
      throw new SearchConsoleError('GOOGLE_API', 'Could not reach Google. Try again in a minute.')
    }
    const json = (await res.json().catch(() => ({}))) as T & ApiError
    if (res.status === 401) {
      throw new SearchConsoleError(
        'GOOGLE_AUTH',
        'Google no longer accepts this connection. Connect Google Search Console again.',
      )
    }
    if (!res.ok) {
      throw new SearchConsoleError(
        'GOOGLE_API',
        json.error?.message ?? `Google Search Console answered ${res.status}`,
      )
    }
    return json
  }
  const site = (siteUrl: string) => `/sites/${encodeURIComponent(siteUrl)}`

  return {
    /** Every property the account can see, with its permission level. */
    async sites(): Promise<SearchConsoleSite[]> {
      const json = await call<{ siteEntry?: { siteUrl?: string; permissionLevel?: string }[] }>(
        '/sites',
        { method: 'GET' },
      )
      return (json.siteEntry ?? []).flatMap((s) =>
        s.siteUrl ? [{ siteUrl: s.siteUrl, permissionLevel: s.permissionLevel ?? '' }] : [],
      )
    },
    /** Search Analytics for web search, final numbers only. */
    async query(siteUrl: string, q: GoogleSearchQuery): Promise<GoogleSearchRow[]> {
      const json = await call<{ rows?: GoogleSearchRow[] }>(
        `${site(siteUrl)}/searchAnalytics/query`,
        {
          method: 'POST',
          body: {
            startDate: q.startDate,
            endDate: q.endDate,
            dimensions: q.dimensions,
            type: 'web',
            dataState: 'final',
            ...(q.rowLimit ? { rowLimit: q.rowLimit } : {}),
          },
        },
      )
      return json.rows ?? []
    },
    async sitemaps(siteUrl: string): Promise<GoogleSitemap[]> {
      const json = await call<{ sitemap?: GoogleSitemap[] }>(`${site(siteUrl)}/sitemaps`, {
        method: 'GET',
      })
      return json.sitemap ?? []
    },
    async submitSitemap(siteUrl: string, sitemapUrl: string): Promise<void> {
      await call(`${site(siteUrl)}/sitemaps/${encodeURIComponent(sitemapUrl)}`, { method: 'PUT' })
    },
  }
}

export type SearchConsoleClient = ReturnType<typeof searchConsoleClient>
