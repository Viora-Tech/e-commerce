/** SOURCE OF TRUTH: sales channel platform APIs — WHAT: Meta Graph and Google Merchant calls over fetch / WHY: no SDKs, server side only */
/**
 * The platform APIs behind Sales channels, over plain `fetch` (no SDKs), server side only:
 *
 * - Meta Graph API: Facebook Login for Business, then one business product catalog that
 *   Facebook Shops, Instagram Shopping and the WhatsApp catalog all read
 *   (`/{catalog}/items_batch`, `/{waba}/product_catalogs`).
 * - Google Merchant API v1: OAuth (scope `content`), an API data source, then
 *   `productInputs:insert` / delete per item.
 * - OpenAI (ChatGPT merchants): the product feed pushed to the endpoint OpenAI gives the
 *   merchant after approval, with their key.
 *
 * Every call takes `fetchImpl` so tests never reach a platform. Errors are `ChannelApiError`:
 * `auth` means the saved access no longer works (the merchant must reconnect).
 */
import { createHmac } from 'node:crypto'
import { CommerceError } from '../errors'
import { type ChannelItem, priceText } from './catalog'

export class ChannelApiError extends CommerceError {
  constructor(
    readonly kind: 'auth' | 'api',
    message: string,
  ) {
    super(kind === 'auth' ? 'CHANNEL_AUTH' : 'CHANNEL_API', message)
  }
}

const TIMEOUT_MS = 30_000

async function request<T>(
  fetchImpl: typeof fetch,
  url: string,
  init: RequestInit,
  readError: (status: number, body: unknown) => ChannelApiError,
): Promise<T> {
  let res: Response
  try {
    res = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) })
  } catch {
    throw new ChannelApiError('api', 'Could not reach the platform. It will try again.')
  }
  const body = (await res.json().catch(() => ({}))) as unknown
  if (!res.ok) throw readError(res.status, body)
  return body as T
}

/* ---------- Meta ---------- */

const META_GRAPH = 'https://graph.facebook.com/v21.0'
const META_SCOPES = [
  'catalog_management',
  'business_management',
  'whatsapp_business_management',
] as const

export type MetaApp = { appId: string; appSecret: string }

type GraphError = { error?: { message?: string; code?: number; error_subcode?: number } }

/** Graph code 190 (and 102/463/467) is a token that no longer works. */
const metaError = (_status: number, body: unknown) => {
  const e = (body as GraphError).error
  const auth = e?.code === 190 || e?.code === 102 || e?.error_subcode === 463
  return new ChannelApiError(
    auth ? 'auth' : 'api',
    e?.message?.slice(0, 300) ?? 'Meta refused the request.',
  )
}

export function metaAuthorizeUrl(input: { appId: string; redirectUri: string; state: string }) {
  const q = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: 'code',
    scope: META_SCOPES.join(','),
  })
  return `https://www.facebook.com/v21.0/dialog/oauth?${q}`
}

/** The code → a short token → a long-lived (about 60 day) token. */
export async function metaExchangeCode(
  fetchImpl: typeof fetch,
  app: MetaApp,
  input: { code: string; redirectUri: string },
): Promise<{ token: string; expiresAt: Date | null }> {
  const short = await request<{ access_token: string }>(
    fetchImpl,
    `${META_GRAPH}/oauth/access_token?${new URLSearchParams({
      client_id: app.appId,
      client_secret: app.appSecret,
      redirect_uri: input.redirectUri,
      code: input.code,
    })}`,
    { method: 'GET' },
    metaError,
  )
  const long = await request<{ access_token: string; expires_in?: number }>(
    fetchImpl,
    `${META_GRAPH}/oauth/access_token?${new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: app.appId,
      client_secret: app.appSecret,
      fb_exchange_token: short.access_token,
    })}`,
    { method: 'GET' },
    metaError,
  )
  return {
    token: long.access_token,
    expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null,
  }
}

/** Graph calls are signed with appsecret_proof, as Meta recommends for server calls. */
const proof = (token: string, app: MetaApp) =>
  createHmac('sha256', app.appSecret).update(token).digest('hex')

async function graph<T>(
  fetchImpl: typeof fetch,
  app: MetaApp,
  token: string,
  path: string,
  init: { method?: 'GET' | 'POST'; form?: Record<string, string> } = {},
): Promise<T> {
  const auth = { access_token: token, appsecret_proof: proof(token, app) }
  if (init.method === 'POST') {
    return request<T>(
      fetchImpl,
      `${META_GRAPH}${path}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...auth, ...(init.form ?? {}) }),
      },
      metaError,
    )
  }
  const sep = path.includes('?') ? '&' : '?'
  return request<T>(
    fetchImpl,
    `${META_GRAPH}${path}${sep}${new URLSearchParams(auth)}`,
    { method: 'GET' },
    metaError,
  )
}

export type MetaAccount = {
  businessId: string
  businessName: string
  catalogId: string
  wabaId: string | null
}

/**
 * After sign-in: the merchant's first business, our catalog in it (made once, named after the
 * store), and their WhatsApp Business account if they have one.
 */
export async function metaDiscover(
  fetchImpl: typeof fetch,
  app: MetaApp,
  token: string,
  catalogName: string,
): Promise<MetaAccount> {
  const businesses = await graph<{ data: { id: string; name: string }[] }>(
    fetchImpl,
    app,
    token,
    '/me/businesses?fields=id,name',
  )
  const business = businesses.data[0]
  if (!business)
    throw new ChannelApiError(
      'api',
      'No Meta business account found. Create one in Meta Business Suite, then connect again.',
    )
  const catalogs = await graph<{ data: { id: string; name: string }[] }>(
    fetchImpl,
    app,
    token,
    `/${business.id}/owned_product_catalogs?fields=id,name`,
  )
  const found = catalogs.data.find((c) => c.name === catalogName)
  const catalogId =
    found?.id ??
    (
      await graph<{ id: string }>(fetchImpl, app, token, `/${business.id}/owned_product_catalogs`, {
        method: 'POST',
        form: { name: catalogName },
      })
    ).id
  const wabas = await graph<{ data: { id: string }[] }>(
    fetchImpl,
    app,
    token,
    `/${business.id}/owned_whatsapp_business_accounts?fields=id`,
  ).catch(() => ({ data: [] }))
  return {
    businessId: business.id,
    businessName: business.name,
    catalogId,
    wabaId: wabas.data[0]?.id ?? null,
  }
}

/** Shows the catalog on WhatsApp (the business's catalog tab and product messages). */
export async function metaLinkWhatsapp(
  fetchImpl: typeof fetch,
  app: MetaApp,
  token: string,
  wabaId: string,
  catalogId: string,
): Promise<void> {
  await graph(fetchImpl, app, token, `/${wabaId}/product_catalogs`, {
    method: 'POST',
    form: { catalog_id: catalogId },
  })
}

function metaItem(item: ChannelItem) {
  return {
    id: item.id,
    item_group_id: item.groupId,
    title: item.title,
    description: item.description,
    availability: item.availability === 'in_stock' ? 'in stock' : 'out of stock',
    condition: 'new',
    price: priceText(item.mrpPaise ?? item.pricePaise),
    ...(item.mrpPaise ? { sale_price: priceText(item.pricePaise) } : {}),
    link: item.link,
    ...(item.imageLink ? { image_link: item.imageLink } : {}),
    ...(item.additionalImages.length ? { additional_image_link: item.additionalImages } : {}),
    brand: item.brand,
    ...(item.gtin ? { gtin: item.gtin } : {}),
    ...(item.quantity !== null ? { quantity_to_sell_on_facebook: item.quantity } : {}),
  }
}

/** Meta takes up to 5,000 requests per batch; smaller batches fail less as a whole. */
const META_BATCH = 1000

/** Upserts and deletes in `items_batch` calls; Meta applies them in the background. */
export async function metaPushItems(
  fetchImpl: typeof fetch,
  app: MetaApp,
  token: string,
  catalogId: string,
  upserts: ChannelItem[],
  deletes: string[],
): Promise<void> {
  const requests = [
    ...upserts.map((item) => ({ method: 'UPDATE', data: metaItem(item) })),
    ...deletes.map((id) => ({ method: 'DELETE', data: { id } })),
  ]
  for (let i = 0; i < requests.length; i += META_BATCH) {
    await graph(fetchImpl, app, token, `/${catalogId}/items_batch`, {
      method: 'POST',
      form: {
        item_type: 'PRODUCT_ITEM',
        allow_upsert: 'true',
        requests: JSON.stringify(requests.slice(i, i + META_BATCH)),
      },
    })
  }
}

/* ---------- Google Merchant Center ---------- */

const GOOGLE_CONTENT_SCOPE = 'https://www.googleapis.com/auth/content'
const GOOGLE_AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
const MERCHANT_API = 'https://merchantapi.googleapis.com'

export type GoogleMerchantApp = { clientId: string; clientSecret: string }

const googleError = (status: number, body: unknown) => {
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

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

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

/* ---------- OpenAI (ChatGPT merchants) ---------- */

export type OpenAiFeed = { endpoint: string; apiKey: string }

function openAiItem(item: ChannelItem, seller: { name: string; url: string }) {
  return {
    enable_search: true,
    enable_checkout: false,
    id: item.id,
    item_group_id: item.groupId,
    title: item.title,
    description: item.description,
    link: item.link,
    ...(item.imageLink ? { image_link: item.imageLink } : {}),
    ...(item.additionalImages.length ? { additional_image_link: item.additionalImages } : {}),
    price: priceText(item.mrpPaise ?? item.pricePaise),
    ...(item.mrpPaise ? { sale_price: priceText(item.pricePaise) } : {}),
    availability: item.availability,
    ...(item.quantity !== null ? { inventory_quantity: item.quantity } : {}),
    brand: item.brand,
    ...(item.gtin ? { gtin: item.gtin } : {}),
    ...(item.sku ? { mpn: item.sku } : {}),
    condition: 'new',
    seller_name: seller.name,
    seller_url: seller.url,
  }
}

/** The whole feed, every time (OpenAI replaces the catalog with what it last received). */
export async function openAiPushFeed(
  fetchImpl: typeof fetch,
  feed: OpenAiFeed,
  items: ChannelItem[],
  seller: { name: string; url: string },
): Promise<void> {
  await request(
    fetchImpl,
    feed.endpoint,
    {
      method: 'POST',
      headers: { ...bearer(feed.apiKey), 'content-type': 'application/json' },
      body: JSON.stringify({ products: items.map((i) => openAiItem(i, seller)) }),
    },
    (status, body) => {
      const message = (body as { error?: { message?: string } }).error?.message
      return new ChannelApiError(
        status === 401 || status === 403 ? 'auth' : 'api',
        message?.slice(0, 300) ?? 'OpenAI refused the feed.',
      )
    },
  )
}
