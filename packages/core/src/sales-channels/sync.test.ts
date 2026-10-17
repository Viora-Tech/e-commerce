import {
  channelConnection,
  createDb,
  inventoryLevel,
  product,
  store,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { buildChannelCatalog } from './catalog'
import { channelState, defaultAgentControls } from './client'
import {
  type ChannelDeps,
  completeChannelConnect,
  disconnectChannel,
  saveOpenAiFeed,
  signChannelState,
  startChannelConnect,
  verifyChannelState,
} from './connect'
import { loadSalesChannelSettings } from './service'
import { syncChannelProvider } from './sync'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const SECRET = 'test-secret-test-secret-test-secret'

type Call = { url: string; method: string; body: string }

/** A pretend Meta / Google / OpenAI: answers by URL and records every call. */
function platform(overrides: Record<string, unknown> = {}) {
  const calls: Call[] = []
  const fake = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input)
    const body = init?.body ? String(init.body) : ''
    calls.push({ url, method: init?.method ?? 'GET', body })
    const answer = (json: unknown, status = 200) =>
      new Response(JSON.stringify(json), {
        status,
        headers: { 'content-type': 'application/json' },
      })
    for (const [part, json] of Object.entries(overrides)) {
      if (url.includes(part)) return answer(json, (json as { _status?: number })._status ?? 200)
    }
    if (url.includes('/oauth/access_token'))
      return answer({ access_token: 'meta-token', expires_in: 5_000_000 })
    if (url.includes('/me/businesses'))
      return answer({ data: [{ id: 'biz1', name: 'Asha Business' }] })
    if (url.includes('/owned_product_catalogs') && init?.method === 'POST')
      return answer({ id: 'cat1' })
    if (url.includes('/owned_product_catalogs')) return answer({ data: [] })
    if (url.includes('/owned_whatsapp_business_accounts'))
      return answer({ data: [{ id: 'waba1' }] })
    if (url.includes('/items_batch')) return answer({ handles: ['h1'] })
    if (url.includes('/product_catalogs')) return answer({ success: true })
    if (url.includes('oauth2.googleapis.com/token'))
      return answer({ access_token: 'g-access', refresh_token: 'g-refresh', expires_in: 3600 })
    if (url.includes('/accounts/v1/accounts'))
      return answer({ accounts: [{ name: 'accounts/42', accountName: 'Asha GMC' }] })
    if (url.includes('/dataSources') && init?.method === 'POST')
      return answer({ name: 'accounts/42/dataSources/7' })
    if (url.includes('/dataSources')) return answer({ dataSources: [] })
    if (url.includes('productInputs')) return answer({})
    if (url.includes('openai.example')) return answer({ ok: true })
    return answer({ error: { message: `unexpected ${url}` } }, 500)
  }) as typeof fetch
  return { fetch: fake, calls }
}

function deps(fetchImpl: typeof fetch, apps = true): ChannelDeps {
  return {
    fetch: fetchImpl,
    secret: SECRET,
    meta: apps ? { appId: 'app1', appSecret: 'meta-secret' } : null,
    google: apps ? { clientId: 'gid', clientSecret: 'gsecret' } : null,
    adminUrl: 'https://admin.example.com',
    storefrontUrl: 'https://asha.example.com',
  }
}

async function seedStore() {
  const [s] = await owner.insert(store).values({ slug: 'asha', name: 'Asha Handlooms' }).returning()
  const storeId = s?.id as string
  const [p] = await owner
    .insert(product)
    .values({
      storeId,
      handle: 'silk-saree',
      title: 'Silk Saree',
      status: 'active',
      vendor: 'Asha',
    })
    .returning()
  const [v] = await owner
    .insert(variant)
    .values({
      storeId,
      productId: p?.id as string,
      title: 'Default',
      pricePaise: 499_900,
      mrpPaise: 599_900,
      barcode: '8901234567890',
    })
    .returning()
  await owner.insert(inventoryLevel).values({
    storeId,
    variantId: v?.id as string,
    onHand: 5,
  })
  const [hidden] = await owner
    .insert(product)
    .values({ storeId, handle: 'secret', title: 'Secret', status: 'active', tags: ['no-ai'] })
    .returning()
  await owner
    .insert(variant)
    .values({ storeId, productId: hidden?.id as string, title: 'Default', pricePaise: 100 })
  return { storeId, productId: p?.id as string, variantId: v?.id as string }
}

const stateOf = (storeId: string, channel: 'instagram' | 'google' | 'chatgpt' | 'whatsapp') =>
  withStore(app, storeId, async (tx) =>
    channelState(await loadSalesChannelSettings({ tx, storeId }), channel),
  )

async function connectMeta(
  storeId: string,
  fake: typeof fetch,
  channel: 'instagram' | 'whatsapp' = 'instagram',
) {
  const { state } = signChannelState({ storeId, channel, catalog: 'all' }, SECRET)
  return completeChannelConnect(app, { provider: 'meta', code: 'code1', state }, deps(fake))
}

describe('channel catalog', () => {
  it('sends live variants with stock and MRP, and hides tagged products from AI agents', async () => {
    const { storeId, variantId } = await seedStore()
    const items = await withStore(app, storeId, (tx) =>
      buildChannelCatalog(tx, storeId, { origin: 'https://asha.example.com' }),
    )
    expect(items).toHaveLength(2)
    expect(items.find((i) => i.id === variantId)).toMatchObject({
      title: 'Silk Saree',
      link: 'https://asha.example.com/products/silk-saree',
      pricePaise: 499_900,
      mrpPaise: 599_900,
      availability: 'in_stock',
      quantity: 5,
      brand: 'Asha',
      gtin: '8901234567890',
    })
    const agents = await withStore(app, storeId, (tx) =>
      buildChannelCatalog(tx, storeId, {
        origin: 'https://asha.example.com',
        agents: defaultAgentControls,
      }),
    )
    expect(agents.map((i) => i.title)).toEqual(['Silk Saree'])
  })
})

describe('connecting', () => {
  it('asks for access when no platform app is set up, and signs in when one is', async () => {
    const { storeId } = await seedStore()
    const fake = platform()
    const asked = await withStore(app, storeId, (tx) =>
      startChannelConnect(
        { tx, storeId },
        { channel: 'instagram', shares: [], account: '@asha', catalog: 'all' },
        deps(fake.fetch, false),
      ),
    )
    expect(asked.kind).toBe('requested')
    const go = await withStore(app, storeId, (tx) =>
      startChannelConnect(
        { tx, storeId },
        { channel: 'instagram', shares: [], account: null, catalog: 'all' },
        deps(fake.fetch),
      ),
    )
    if (go.kind !== 'redirect') throw new Error('expected a redirect')
    const url = new URL(go.url)
    expect(url.hostname).toBe('www.facebook.com')
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://admin.example.com/api/channels/meta/callback',
    )
    expect(verifyChannelState(url.searchParams.get('state') as string, SECRET)).toMatchObject({
      storeId,
      channel: 'instagram',
    })
    expect(verifyChannelState(`${url.searchParams.get('state')}x`, SECRET)).toBeNull()
  })

  it('saves Meta access encrypted, makes the catalog, and starts the first sync', async () => {
    const { storeId } = await seedStore()
    const fake = platform()
    await connectMeta(storeId, fake.fetch, 'whatsapp')
    const [row] = await owner
      .select()
      .from(channelConnection)
      .where(eq(channelConnection.storeId, storeId))
    expect(row).toMatchObject({ provider: 'meta', target: 'cat1', accountName: 'Asha Business' })
    expect(row?.accessToken).not.toContain('meta-token')
    expect(fake.calls.some((c) => c.url.includes('/waba1/product_catalogs'))).toBe(true)
    expect((await stateOf(storeId, 'whatsapp')).status).toBe('first_sync')

    // A second Meta channel joins the same connection without signing in again.
    const joined = await withStore(app, storeId, (tx) =>
      startChannelConnect(
        { tx, storeId },
        { channel: 'instagram', shares: [], account: null, catalog: 'all' },
        deps(fake.fetch),
      ),
    )
    expect(joined.kind).toBe('connected')
  })
})

describe('syncChannelProvider', () => {
  it('sends the catalog, then only changes, and deletes what left', async () => {
    const { storeId, productId, variantId } = await seedStore()
    const fake = platform()
    await connectMeta(storeId, fake.fetch)
    const first = await syncChannelProvider(app, storeId, 'meta', deps(fake.fetch))
    expect(first).toMatchObject({ state: 'synced', items: 2, sent: 2 })
    expect(await stateOf(storeId, 'instagram')).toMatchObject({
      status: 'connected',
      sync: { sent: 2, total: 2 },
    })
    const batch = fake.calls.find((c) => c.url.includes('/cat1/items_batch'))
    const requests = JSON.parse(new URLSearchParams(batch?.body).get('requests') as string)
    expect(requests[0].data).toMatchObject({ price: '5999.00 INR', sale_price: '4999.00 INR' })

    fake.calls.length = 0
    expect(await syncChannelProvider(app, storeId, 'meta', deps(fake.fetch))).toMatchObject({
      sent: 0,
    })
    expect(fake.calls.some((c) => c.url.includes('items_batch'))).toBe(false)

    await owner.update(product).set({ status: 'archived' }).where(eq(product.id, productId))
    expect(await syncChannelProvider(app, storeId, 'meta', deps(fake.fetch))).toMatchObject({
      removed: 1,
    })
    const del = fake.calls.find((c) => c.url.includes('items_batch'))
    expect(JSON.parse(new URLSearchParams(del?.body).get('requests') as string)).toEqual([
      { method: 'DELETE', data: { id: variantId } },
    ])
  })

  it('marks the channel expired when Meta refuses the token, and paused channels are left alone', async () => {
    const { storeId } = await seedStore()
    await connectMeta(storeId, platform().fetch)
    const refused = platform({
      items_batch: { _status: 400, error: { code: 190, message: 'Session expired' } },
    })
    expect(await syncChannelProvider(app, storeId, 'meta', deps(refused.fetch))).toMatchObject({
      state: 'failed',
      reconnect: true,
    })
    expect((await stateOf(storeId, 'instagram')).status).toBe('expired')
  })

  it('syncs Google Merchant Center with a refreshed token', async () => {
    const { storeId } = await seedStore()
    const fake = platform()
    const { state } = signChannelState({ storeId, channel: 'google', catalog: 'all' }, SECRET)
    await completeChannelConnect(app, { provider: 'google', code: 'c', state }, deps(fake.fetch))
    await owner
      .update(channelConnection)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(channelConnection.storeId, storeId))
    fake.calls.length = 0
    expect(await syncChannelProvider(app, storeId, 'google', deps(fake.fetch))).toMatchObject({
      state: 'synced',
    })
    expect(fake.calls[0]?.url).toContain('oauth2.googleapis.com/token')
    const insert = fake.calls.find((c) => c.url.includes('productInputs:insert'))
    expect(insert?.url).toContain('/products/v1/accounts/42/')
    expect(JSON.parse(insert?.body ?? '{}').productAttributes).toMatchObject({
      availability: 'IN_STOCK',
    })
  })

  it('pushes the ChatGPT feed with the saved key, and disconnect forgets the access', async () => {
    const { storeId } = await seedStore()
    const fake = platform()
    await withStore(app, storeId, (tx) =>
      saveOpenAiFeed(
        { tx, storeId },
        { endpoint: 'https://openai.example/feed', apiKey: 'sk-feed-123' },
        SECRET,
      ),
    )
    expect(await syncChannelProvider(app, storeId, 'openai', deps(fake.fetch))).toMatchObject({
      items: 1,
    })
    const push = fake.calls.find((c) => c.url === 'https://openai.example/feed')
    expect(JSON.parse(push?.body ?? '{}').products[0]).toMatchObject({
      title: 'Silk Saree',
      enable_search: true,
    })

    await withStore(app, storeId, (tx) => disconnectChannel({ tx, storeId }, 'chatgpt'))
    expect((await stateOf(storeId, 'chatgpt')).status).toBe('disconnected')
    expect(
      await owner.select().from(channelConnection).where(eq(channelConnection.storeId, storeId)),
    ).toEqual([])
  })
})
