/** SOURCE OF TRUTH: Google Merchant API calls — WHAT: OAuth, account and data source discovery, product inputs / WHY: the Google sales channel, over plain fetch */
/**
 * Google Merchant API v1 for Sales channels → Google: OAuth (scope `content`, PKCE), the first
 * Merchant Center account and our API data source in it, then `productInputs:insert` / delete
 * per item. The Content API for Shopping is sunset (18 Aug 2026). Every call takes `fetchImpl`.
 */
import type { ChannelItem } from './catalog'
import { bearer, ChannelApiError, request } from './providers'

const GOOGLE_CONTENT_SCOPE = 'https://www.googleapis.com/auth/content'
const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
export const MERCHANT_API = 'https://merchantapi.googleapis.com'

export type GoogleMerchantApp = { clientId: string; clientSecret: string }

export const googleError = (status: number, body: unknown) => {
  const b = body as { error?: { message?: string } | string; error_description?: string }
  const message =
    typeof b.error === 'object'
      ? b.error?.message
      : (b.error_description ?? (typeof b.error === 'string' ? b.error : undefined))
  const auth = status === 401 || b.error === 'invalid_grant'
  return new ChannelApiError(
    auth ? 'auth' : 'api',
    message?.slice(0, 300) ?? 'Google refused the request.',
  )
}

export function googleMerchantAuthorizeUrl(input: {
  clientId: string
  redirectUri: string
  state: string
  codeChallenge: string
}): string {
  const q = new URLSearchParams({
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    response_type: 'code',
    scope: ['openid', 'email', GOOGLE_CONTENT_SCOPE].join(' '),
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: input.state,
    code_challenge: input.codeChallenge,
    code_challenge_method: 'S256',
  })
  return `${GOOGLE_AUTHORIZE}?${q}`
}

type GoogleTokens = { access_token: string; refresh_token?: string; expires_in?: number }

export async function googleExchangeCode(
  fetchImpl: typeof fetch,
  app: GoogleMerchantApp,
  input: { code: string; redirectUri: string; codeVerifier: string },
): Promise<{ accessToken: string; refreshToken: string | null; expiresAt: Date }> {
  const t = await request<GoogleTokens>(
    fetchImpl,
    GOOGLE_TOKEN,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        redirect_uri: input.redirectUri,
        client_id: app.clientId,
        client_secret: app.clientSecret,
        code_verifier: input.codeVerifier,
      }),
    },
    googleError,
  )
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token ?? null,
    expiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000),
  }
}

export async function googleRefresh(
  fetchImpl: typeof fetch,
  app: GoogleMerchantApp,
  refreshToken: string,
): Promise<{ accessToken: string; expiresAt: Date }> {
  const t = await request<GoogleTokens>(
    fetchImpl,
    GOOGLE_TOKEN,
    {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: app.clientId,
        client_secret: app.clientSecret,
      }),
    },
    googleError,
  )
  return {
    accessToken: t.access_token,
    expiresAt: new Date(Date.now() + (t.expires_in ?? 3600) * 1000),
  }
}

export type GoogleAccount = { accountId: string; accountName: string; dataSource: string }

/** The first Merchant Center account the merchant can reach, and our API data source in it. */
export async function googleDiscover(
  fetchImpl: typeof fetch,
  token: string,
  dataSourceName: string,
): Promise<GoogleAccount> {
  const accounts = await request<{ accounts?: { name: string; accountName?: string }[] }>(
    fetchImpl,
    `${MERCHANT_API}/accounts/v1/accounts`,
    { headers: bearer(token) },
    googleError,
  )
  const account = accounts.accounts?.[0]
  if (!account)
    throw new ChannelApiError(
      'api',
      'No Google Merchant Center account found. Create one at merchants.google.com, then connect again.',
    )
  const accountId = account.name.split('/')[1] as string
  const sources = await request<{
    dataSources?: { name: string; displayName?: string }[]
  }>(
    fetchImpl,
    `${MERCHANT_API}/datasources/v1/accounts/${accountId}/dataSources`,
    { headers: bearer(token) },
    googleError,
  )
  const found = sources.dataSources?.find((d) => d.displayName === dataSourceName)
  const dataSource =
    found?.name ??
    (
      await request<{ name: string }>(
        fetchImpl,
        `${MERCHANT_API}/datasources/v1/accounts/${accountId}/dataSources`,
        {
          method: 'POST',
          headers: { ...bearer(token), 'content-type': 'application/json' },
          body: JSON.stringify({
            displayName: dataSourceName,
            primaryProductDataSource: { contentLanguage: 'en', feedLabel: 'IN', countries: ['IN'] },
          }),
        },
        googleError,
      )
    ).name
  return { accountId, accountName: account.accountName ?? accountId, dataSource }
}

const micros = (paise: number) => ({ amountMicros: String(paise * 10_000), currencyCode: 'INR' })

function googleInput(item: ChannelItem) {
  return {
    offerId: item.id,
    contentLanguage: 'en',
    feedLabel: 'IN',
    productAttributes: {
      title: item.title,
      description: item.description,
      link: item.link,
      ...(item.imageLink ? { imageLink: item.imageLink } : {}),
      ...(item.additionalImages.length ? { additionalImageLinks: item.additionalImages } : {}),
      availability: item.availability === 'in_stock' ? 'IN_STOCK' : 'OUT_OF_STOCK',
      condition: 'NEW',
      price: micros(item.mrpPaise ?? item.pricePaise),
      ...(item.mrpPaise ? { salePrice: micros(item.pricePaise) } : {}),
      brand: item.brand,
      itemGroupId: item.groupId,
      ...(item.gtin ? { gtins: [item.gtin] } : { identifierExists: false }),
      ...(item.sku ? { mpn: item.sku } : {}),
    },
  }
}

/** Items go one by one (the Merchant API has no batch insert), a few at a time. */
const GOOGLE_PARALLEL = 4

export async function googlePushItems(
  fetchImpl: typeof fetch,
  token: string,
  account: { accountId: string; dataSource: string },
  upserts: ChannelItem[],
  deletes: string[],
): Promise<void> {
  const ds = encodeURIComponent(account.dataSource)
  const jobs: (() => Promise<unknown>)[] = [
    ...upserts.map(
      (item) => () =>
        request(
          fetchImpl,
          `${MERCHANT_API}/products/v1/accounts/${account.accountId}/productInputs:insert?dataSource=${ds}`,
          {
            method: 'POST',
            headers: { ...bearer(token), 'content-type': 'application/json' },
            body: JSON.stringify(googleInput(item)),
          },
          googleError,
        ),
    ),
    ...deletes.map(
      (id) => () =>
        request(
          fetchImpl,
          `${MERCHANT_API}/products/v1/accounts/${account.accountId}/productInputs/en~IN~${encodeURIComponent(id)}?dataSource=${ds}`,
          { method: 'DELETE', headers: bearer(token) },
          (status, body) =>
            status === 404 ? new ChannelApiError('api', 'gone') : googleError(status, body),
        ).catch((err) => {
          // Already gone on Google's side is what we wanted.
          if (err instanceof ChannelApiError && err.message === 'gone') return null
          throw err
        }),
    ),
  ]
  for (let i = 0; i < jobs.length; i += GOOGLE_PARALLEL) {
    await Promise.all(jobs.slice(i, i + GOOGLE_PARALLEL).map((job) => job()))
  }
}
