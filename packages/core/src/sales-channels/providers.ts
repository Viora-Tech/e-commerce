/** SOURCE OF TRUTH: sales channel platform APIs — WHAT: Meta Graph and Google Merchant calls over fetch / WHY: no SDKs, server side only */
/**
 * The platform APIs behind Sales channels, over plain `fetch` (no SDKs), server side only:
 *
 * - Meta Graph API (`META_GRAPH_VERSION`): Facebook Login for Business, then one business
 *   product catalog that Facebook Shops, Instagram Shopping and the WhatsApp catalog all read
 *   (`/{catalog}/items_batch`, `/{waba}/product_catalogs`). With a login configuration
 *   (`META_LOGIN_CONFIG_ID`) the sign-in asks for that configuration's permissions and hands
 *   back a business integration system user token, which does not expire.
 * - Google Merchant API v1: in `google-merchant.ts`.
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

export async function request<T>(
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

/**
 * The Graph API version every Meta call uses. v26.0 is the newest (29 Jul 2026); v21.0, which
 * this used before, stops on 21 Jan 2027 (developers.facebook.com/docs/graph-api/changelog/versions).
 */
export const META_GRAPH_VERSION = 'v26.0'
const META_GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`
/** Asked for by name only when no login configuration is set (user tokens, about 60 days). */
const META_SCOPES = [
  'catalog_management',
  'business_management',
  'whatsapp_business_management',
] as const

export type MetaApp = {
  appId: string
  appSecret: string
  /** Facebook Login for Business configuration: its permissions and a system user token. */
  loginConfigId?: string | null
}

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

export function metaAuthorizeUrl(input: {
  appId: string
  redirectUri: string
  state: string
  configId?: string | null
}) {
  const q = new URLSearchParams({
    client_id: input.appId,
    redirect_uri: input.redirectUri,
    state: input.state,
    response_type: 'code',
    ...(input.configId ? { config_id: input.configId } : { scope: META_SCOPES.join(',') }),
  })
  return `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth?${q}`
}

/**
 * The code → a token. A login configuration's system user token is kept as it is (it does
 * not expire); a user token is swapped for a long-lived (about 60 day) one.
 */
export async function metaExchangeCode(
  fetchImpl: typeof fetch,
  app: MetaApp,
  input: { code: string; redirectUri: string },
): Promise<{ token: string; expiresAt: Date | null }> {
  const short = await request<{ access_token: string; expires_in?: number }>(
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
  if (app.loginConfigId)
    return {
      token: short.access_token,
      expiresAt: short.expires_in ? new Date(Date.now() + short.expires_in * 1000) : null,
    }
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

export async function graph<T>(
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
  /** The Facebook user (or system user) the token belongs to: Meta's deletion callbacks name it. */
  userId: string | null
}

/**
 * The business a login configuration's system user token belongs to. That token is a business
 * integration system user's, so `/me/businesses` is refused ("Missing Permission"); Meta puts the
 * merchant's business on the token instead (`/me?fields=client_business_id`, Facebook Login for
 * Business docs). Null for a user token, which lists its businesses itself.
 */
async function metaClientBusiness(
  fetchImpl: typeof fetch,
  app: MetaApp,
  token: string,
): Promise<{ id: string; name: string } | null> {
  if (!app.loginConfigId) return null
  const me = await graph<{ id?: string; client_business_id?: string }>(
    fetchImpl,
    app,
    token,
    '/me?fields=id,client_business_id',
  )
  const id = me.client_business_id
  if (!id) return null
  // The name is only for display: the system user may not be allowed to read it.
  const named = await graph<{ name?: string }>(fetchImpl, app, token, `/${id}?fields=name`).catch(
    () => ({ name: undefined }),
  )
  return { id, name: named.name ?? id }
}

/** Names the Graph step in a failure, so a refusal says which call it was. */
const step = <T>(name: string, call: Promise<T>) =>
  call.catch((e: unknown) => {
    if (e instanceof ChannelApiError) throw new ChannelApiError(e.kind, `${name}: ${e.message}`)
    throw e
  })

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
  const client = await step('business', metaClientBusiness(fetchImpl, app, token))
  const business =
    client ??
    (
      await step(
        'businesses',
        graph<{ data: { id: string; name: string }[] }>(
          fetchImpl,
          app,
          token,
          '/me/businesses?fields=id,name',
        ),
      )
    ).data[0]
  if (!business)
    throw new ChannelApiError(
      'api',
      'No Meta business account found. Create one in Meta Business Suite, then connect again.',
    )
  const catalogs = await step(
    'catalogs',
    graph<{ data: { id: string; name: string }[] }>(
      fetchImpl,
      app,
      token,
      `/${business.id}/owned_product_catalogs?fields=id,name`,
    ),
  )
  const found = catalogs.data.find((c) => c.name === catalogName)
  const catalogId =
    found?.id ??
    (
      await step(
        'create catalog',
        graph<{ id: string }>(fetchImpl, app, token, `/${business.id}/owned_product_catalogs`, {
          method: 'POST',
          form: { name: catalogName },
        }),
      )
    ).id
  const wabas = await graph<{ data: { id: string }[] }>(
    fetchImpl,
    app,
    token,
    `/${business.id}/owned_whatsapp_business_accounts?fields=id`,
  ).catch(() => ({ data: [] }))
  const me = await graph<{ id?: string }>(fetchImpl, app, token, '/me?fields=id').catch(() => ({
    id: undefined,
  }))
  return {
    businessId: business.id,
    businessName: business.name,
    catalogId,
    wabaId: wabas.data[0]?.id ?? null,
    userId: me.id ?? null,
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

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

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
