import { describe, expect, it, vi } from 'vitest'
import {
  exchangeRazorpayCode,
  RAZORPAY_WEBHOOK_EVENTS,
  razorpayAuthorizeUrl,
  razorpayOAuthApp,
  refreshOAuthConfig,
  refreshRazorpayToken,
  registerRazorpayWebhook,
  tokenRefreshDue,
  updateRazorpayWebhook,
} from '../src/oauth'

const app = { clientId: 'client_1', clientSecret: 'client_secret_1' }
const now = new Date('2026-09-26T10:00:00Z')

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const tokenBody = {
  access_token: 'at_1',
  token_type: 'Bearer',
  expires_in: 7776000,
  public_token: 'rzp_test_oauth_ABC',
  refresh_token: 'rt_1',
  razorpay_account_id: 'acc_123',
}

describe('razorpay oauth', () => {
  it('is off unless both env values are set', () => {
    expect(razorpayOAuthApp({})).toBeNull()
    expect(razorpayOAuthApp({ RAZORPAY_OAUTH_CLIENT_ID: 'x' })).toBeNull()
    expect(
      razorpayOAuthApp({ RAZORPAY_OAUTH_CLIENT_ID: 'x', RAZORPAY_OAUTH_CLIENT_SECRET: 'y' }),
    ).toEqual({ clientId: 'x', clientSecret: 'y' })
  })

  it('builds the documented authorize URL', () => {
    const url = new URL(
      razorpayAuthorizeUrl({
        clientId: 'client_1',
        redirectUri: 'https://admin.example/cb',
        state: 'st',
      }),
    )
    expect(url.origin + url.pathname).toBe('https://auth.razorpay.com/authorize')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: 'client_1',
      response_type: 'code',
      redirect_uri: 'https://admin.example/cb',
      scope: 'read_write',
      state: 'st',
    })
  })

  it('exchanges a code for tokens with the mode, and computes expiry', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, tokenBody))
    const t = await exchangeRazorpayCode(
      app,
      { code: 'code_1', redirectUri: 'https://admin.example/cb', mode: 'test' },
      fetchMock as unknown as typeof fetch,
      now,
    )
    expect(t).toEqual({
      accessToken: 'at_1',
      refreshToken: 'rt_1',
      publicToken: 'rzp_test_oauth_ABC',
      accountId: 'acc_123',
      expiresAt: new Date(now.getTime() + 7776000 * 1000).toISOString(),
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://auth.razorpay.com/token')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({
      client_id: 'client_1',
      client_secret: 'client_secret_1',
      grant_type: 'authorization_code',
      redirect_uri: 'https://admin.example/cb',
      code: 'code_1',
      mode: 'test',
    })
  })

  it('refreshes with the refresh_token grant', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { ...tokenBody, access_token: 'at_2', refresh_token: 'rt_2' }),
    )
    const t = await refreshRazorpayToken(app, 'rt_1', fetchMock as unknown as typeof fetch, now)
    expect(t.accessToken).toBe('at_2')
    expect(t.refreshToken).toBe('rt_2')
    const init = (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(String(init.body))).toEqual({
      client_id: 'client_1',
      client_secret: 'client_secret_1',
      grant_type: 'refresh_token',
      refresh_token: 'rt_1',
    })
  })

  it('surfaces Razorpay error descriptions', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, { error: { description: 'The code has expired' } }),
    )
    await expect(
      exchangeRazorpayCode(
        app,
        { code: 'old', redirectUri: 'https://a/cb', mode: 'live' },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('The code has expired')
  })

  it('refreshes a week before expiry, and when expiry is unknown', () => {
    const in3Days = new Date(now.getTime() + 3 * 86_400_000).toISOString()
    const in30Days = new Date(now.getTime() + 30 * 86_400_000).toISOString()
    expect(tokenRefreshDue(in3Days, now)).toBe(true)
    expect(tokenRefreshDue(in30Days, now)).toBe(false)
    expect(tokenRefreshDue(undefined, now)).toBe(true)
    expect(tokenRefreshDue('garbage', now)).toBe(true)
  })

  it('refreshes a saved OAuth config only when due and configured', async () => {
    const env = { RAZORPAY_OAUTH_CLIENT_ID: 'c', RAZORPAY_OAUTH_CLIENT_SECRET: 's' }
    const fetchMock = vi.fn(async () =>
      jsonResponse(200, { ...tokenBody, access_token: 'at_new', refresh_token: 'rt_new' }),
    )
    const f = fetchMock as unknown as typeof fetch
    const soon = new Date(now.getTime() + 86_400_000).toISOString()
    const later = new Date(now.getTime() + 60 * 86_400_000).toISOString()
    const saved = { keyId: 'rzp_test_oauth_ABC', accessToken: 'at', refreshToken: 'rt' }

    expect(
      await refreshOAuthConfig({ keyId: 'rzp_test_1', keySecret: 'k' }, env, f, now),
    ).toBeNull()
    expect(await refreshOAuthConfig({ ...saved, accessExpiresAt: later }, env, f, now)).toBeNull()
    expect(await refreshOAuthConfig({ ...saved, accessExpiresAt: soon }, {}, f, now)).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()

    const next = await refreshOAuthConfig({ ...saved, accessExpiresAt: soon }, env, f, now)
    expect(next).toMatchObject({
      keyId: 'rzp_test_oauth_ABC',
      accessToken: 'at_new',
      refreshToken: 'rt_new',
      accountId: 'acc_123',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('registers the webhook on the connected account with a Bearer token', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(200, { id: 'wh_1', active: true }))
    const id = await registerRazorpayWebhook(
      { accessToken: 'at_1', accountId: 'acc_123', url: 'https://w/hook', secret: 's3cret' },
      fetchMock as unknown as typeof fetch,
    )
    expect(id).toBe('wh_1')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.razorpay.com/v2/accounts/acc_123/webhooks')
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer at_1')
    expect(JSON.parse(String(init.body))).toEqual({
      url: 'https://w/hook',
      secret: 's3cret',
      events: [...RAZORPAY_WEBHOOK_EVENTS],
    })
  })

  it('patches an existing webhook, and reports a missing one', async () => {
    const ok = vi.fn(async () => jsonResponse(200, { id: 'wh_1' }))
    const input = { accessToken: 'at', accountId: 'acc_1', webhookId: 'wh_1', url: 'https://w' }
    expect(await updateRazorpayWebhook(input, ok as unknown as typeof fetch)).toBe(true)
    const [url, init] = ok.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.razorpay.com/v2/accounts/acc_1/webhooks/wh_1')
    expect(init.method).toBe('PATCH')
    const gone = vi.fn(async () => jsonResponse(404, { error: { description: 'not found' } }))
    expect(await updateRazorpayWebhook(input, gone as unknown as typeof fetch)).toBe(false)
  })

  it('throws a readable error when the webhook is refused', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse(400, { error: { description: 'url is not reachable' } }),
    )
    await expect(
      registerRazorpayWebhook(
        { accessToken: 'a', accountId: 'b', url: 'http://localhost', secret: 's' },
        fetchMock as unknown as typeof fetch,
      ),
    ).rejects.toThrow('url is not reachable')
  })
})
