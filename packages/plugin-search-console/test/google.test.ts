import { describe, expect, it } from 'vitest'
import {
  exchangeGoogleCode,
  googleAuthorizeUrl,
  refreshGoogleAccessToken,
  SearchConsoleError,
  searchConsoleClient,
  searchConsoleOAuthApp,
  searchConsoleRedirectUri,
} from '../src/google'

const APP = { clientId: 'client.apps.googleusercontent.com', clientSecret: 'shh' }

/** A fetch that records each call and answers with `body`. */
function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit | undefined }[] = []
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init })
    return new Response(body === undefined ? null : JSON.stringify(body), { status })
  }) as typeof fetch
  return { impl, calls }
}

const idToken = (claims: object) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.y`

describe('searchConsoleOAuthApp', () => {
  it('uses its own client, else the merchant sign-in client', () => {
    expect(
      searchConsoleOAuthApp({ GSC_GOOGLE_CLIENT_ID: 'a', GSC_GOOGLE_CLIENT_SECRET: 'b' }),
    ).toEqual({ clientId: 'a', clientSecret: 'b' })
    expect(
      searchConsoleOAuthApp({ MERCHANT_GOOGLE_CLIENT_ID: 'm', MERCHANT_GOOGLE_CLIENT_SECRET: 'n' }),
    ).toEqual({ clientId: 'm', clientSecret: 'n' })
    expect(searchConsoleOAuthApp({ GSC_GOOGLE_CLIENT_ID: 'a' })).toBeNull()
    expect(searchConsoleOAuthApp({})).toBeNull()
  })
})

describe('googleAuthorizeUrl', () => {
  it('asks for offline Search Console access with PKCE', () => {
    const url = new URL(
      googleAuthorizeUrl({
        clientId: APP.clientId,
        redirectUri: searchConsoleRedirectUri('https://admin.example.in/'),
        state: 'st',
        codeVerifier: 'v'.repeat(43),
      }),
    )
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://admin.example.in/api/apps/google-search-console/oauth/callback',
    )
    expect(url.searchParams.get('scope')).toContain('https://www.googleapis.com/auth/webmasters')
    expect(url.searchParams.get('access_type')).toBe('offline')
    expect(url.searchParams.get('code_challenge_method')).toBe('S256')
    expect(url.searchParams.get('code_challenge')).not.toBe('v'.repeat(43))
  })
})

describe('exchangeGoogleCode', () => {
  it('returns the refresh token and the account email', async () => {
    const { impl, calls } = fakeFetch(200, {
      access_token: 'at',
      refresh_token: 'rt',
      scope: 'openid https://www.googleapis.com/auth/webmasters email',
      id_token: idToken({ email: 'owner@example.in' }),
    })
    const got = await exchangeGoogleCode(
      APP,
      { code: 'c', redirectUri: 'https://a/cb', codeVerifier: 'cv' },
      impl,
    )
    expect(got).toEqual({ refreshToken: 'rt', accessToken: 'at', email: 'owner@example.in' })
    const form = new URLSearchParams(String(calls[0]?.init?.body))
    expect(form.get('code_verifier')).toBe('cv')
    expect(form.get('grant_type')).toBe('authorization_code')
  })

  it('refuses a grant without Search Console access', async () => {
    const { impl } = fakeFetch(200, { access_token: 'at', refresh_token: 'rt', scope: 'email' })
    await expect(
      exchangeGoogleCode(APP, { code: 'c', redirectUri: 'r', codeVerifier: 'v' }, impl),
    ).rejects.toMatchObject({ code: 'GOOGLE_AUTH' })
  })
})

describe('refreshGoogleAccessToken', () => {
  it('turns invalid_grant into "connect again"', async () => {
    const { impl } = fakeFetch(400, { error: 'invalid_grant', error_description: 'revoked' })
    const err = await refreshGoogleAccessToken(APP, 'rt', impl).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(SearchConsoleError)
    expect((err as SearchConsoleError).code).toBe('GOOGLE_AUTH')
  })
})

describe('searchConsoleClient', () => {
  it('encodes the property and asks for final web numbers', async () => {
    const { impl, calls } = fakeFetch(200, { rows: [{ keys: ['kurta'], clicks: 1 }] })
    const rows = await searchConsoleClient('at', impl).query('sc-domain:example.in', {
      startDate: '2026-09-01',
      endDate: '2026-09-28',
      dimensions: ['query'],
      rowLimit: 1000,
    })
    expect(rows).toEqual([{ keys: ['kurta'], clicks: 1 }])
    expect(calls[0]?.url).toBe(
      'https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Aexample.in/searchAnalytics/query',
    )
    expect(JSON.parse(String(calls[0]?.init?.body))).toMatchObject({
      type: 'web',
      dataState: 'final',
      rowLimit: 1000,
    })
  })

  it('reads Google error messages, and a 401 as "connect again"', async () => {
    const forbidden = fakeFetch(403, { error: { code: 403, message: 'No access to property' } })
    await expect(searchConsoleClient('at', forbidden.impl).sites()).rejects.toMatchObject({
      code: 'GOOGLE_API',
      message: 'No access to property',
    })
    const expired = fakeFetch(401, { error: { code: 401, message: 'Invalid Credentials' } })
    await expect(searchConsoleClient('at', expired.impl).sites()).rejects.toMatchObject({
      code: 'GOOGLE_AUTH',
    })
  })

  it('submits a sitemap with PUT on its encoded URL', async () => {
    const { impl, calls } = fakeFetch(204, undefined)
    await searchConsoleClient('at', impl).submitSitemap(
      'https://www.example.in/',
      'https://www.example.in/sitemap.xml',
    )
    expect(calls[0]?.init?.method).toBe('PUT')
    expect(calls[0]?.url).toContain('/sitemaps/https%3A%2F%2Fwww.example.in%2Fsitemap.xml')
  })
})
