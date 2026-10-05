import { findRedirect } from '@commerce/core'
import {
  article,
  blog,
  collection,
  collectionProduct,
  customer,
  media,
  navigationMenu,
  order,
  orderLine,
  page,
  product,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { asc, eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { clientFor, connect, disconnect, getConnection, testConnection } from '../src/connection'
import { htmlToRichText } from '../src/html'
import { ShopifyOAuthError } from '../src/oauth'
import { executeRun } from '../src/run'
import type { InStore } from '../src/runtime'
import { importRun, shopifyConnection } from '../src/schema'
import { createApiRun, startRun } from '../src/service'
import { normaliseShopDomain, ShopifyClient, ShopifyError } from '../src/shopify-client'
import {
  ARTICLES,
  COLLECTIONS,
  CUSTOMERS,
  MENUS,
  ORDERS,
  PAGES,
  PRODUCT_PAGES,
  REDIRECTS,
  VARIANT_PAGES,
  VARIANT_STOCK,
} from './fixtures/graphql'
import {
  app,
  deps,
  type FetchLog,
  fakeFetch,
  fakeMediaQueue,
  json,
  MemoryStorageProvider,
  OAUTH_TOKEN,
  oauthSuccess,
  owner,
  SECRET,
  seedStore,
} from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const TOKEN = 'shpat_0123456789abcdef0123456789abcdef'
const cost = {
  requestedQueryCost: 50,
  throttleStatus: { maximumAvailable: 2000, currentlyAvailable: 1900, restoreRate: 100 },
}

/** The fake Admin API: answers each operation from the fixtures, by cursor. */
function shopify(query: string, variables: Record<string, unknown>): Response {
  const cursor = (variables.cursor as string | null) ?? 'first'
  const op = query.includes('currentAppInstallation')
    ? 'Scopes'
    : (/query (\w+)/.exec(query)?.[1] ?? 'Shop')
  const data: Record<string, unknown> = {
    Shop: { shop: { name: 'Waimers', myshopifyDomain: 'waimers.myshopify.com' } },
    Scopes: {
      shop: { name: 'Waimers' },
      currentAppInstallation: {
        accessScopes: [
          { handle: 'read_products' },
          { handle: 'read_inventory' },
          { handle: 'read_customers' },
          { handle: 'read_content' },
        ],
      },
    },
    Products: PRODUCT_PAGES[cursor],
    Variants: VARIANT_PAGES[cursor],
    VariantStock: VARIANT_STOCK,
    Collections: COLLECTIONS,
    Customers: CUSTOMERS,
    Orders: ORDERS,
    Pages: PAGES,
    Articles: ARTICLES,
    Menus: MENUS,
    Redirects: REDIRECTS,
  }
  return json({ data: data[op], extensions: { cost } })
}

async function connected(fetchImpl: typeof fetch) {
  const storeId = await seedStore()
  await withStore(app, storeId, (tx) =>
    connect(
      tx,
      storeId,
      { shopDomain: 'https://waimers.myshopify.com/admin', accessToken: TOKEN },
      SECRET,
      fetchImpl,
    ),
  )
  return storeId
}

describe('Shopify connection', () => {
  it('normalises the shop domain', () => {
    expect(normaliseShopDomain('waimers')).toBe('waimers.myshopify.com')
    expect(normaliseShopDomain('https://Waimers.myshopify.com/admin/products')).toBe(
      'waimers.myshopify.com',
    )
    expect(normaliseShopDomain('https://admin.shopify.com/store/waimers/orders')).toBe(
      'waimers.myshopify.com',
    )
    expect(normaliseShopDomain('waimers.com')).toBeNull()
  })

  it('verifies the token, stores it encrypted and shows only a hint', async () => {
    const log: FetchLog = []
    const storeId = await connected(fakeFetch(shopify, log))
    expect(log[0]?.url).toBe('https://waimers.myshopify.com/admin/api/2025-07/graphql.json')
    const [row] = await owner.select().from(shopifyConnection)
    expect(row?.accessToken).not.toContain('shpat_')
    expect(row?.accessToken.startsWith('v2.')).toBe(true)
    const view = await withStore(app, storeId, (tx) => getConnection(tx, SECRET))
    expect(view).toMatchObject({
      shopDomain: 'waimers.myshopify.com',
      shopName: 'Waimers',
      tokenHint: 'shpat_••••cdef',
    })
    await withStore(app, storeId, (tx) => disconnect(tx))
    expect(await withStore(app, storeId, (tx) => getConnection(tx, SECRET))).toBeNull()
  })

  it('refuses a bad token with a readable message', async () => {
    const storeId = await seedStore()
    const denied = fakeFetch(() => new Response('', { status: 401 }))
    await expect(
      withStore(app, storeId, (tx) =>
        connect(tx, storeId, { shopDomain: 'waimers', accessToken: TOKEN }, SECRET, denied),
      ),
    ).rejects.toThrow(/rejected the access token/)
    await expect(
      withStore(app, storeId, (tx) =>
        connect(tx, storeId, { shopDomain: 'waimers', accessToken: 'hello' }, SECRET, denied),
      ),
    ).rejects.toThrow(/shpat_/)
  })
})

describe('Shopify app (client credentials) connection', () => {
  it('exchanges the client id/secret for a token and stores it encrypted', async () => {
    const storeId = await seedStore()
    const log: FetchLog = []
    const fetchImpl = fakeFetch(shopify, log)
    await withStore(app, storeId, (tx) =>
      connect(
        tx,
        storeId,
        { shopDomain: 'waimers', clientId: 'my-client-id', clientSecret: 'my-client-secret' },
        SECRET,
        fetchImpl,
      ),
    )
    expect(log[0]?.url).toBe('https://waimers.myshopify.com/admin/oauth/access_token')
    expect(log[0]?.body).toContain('grant_type=client_credentials')
    const [row] = await owner.select().from(shopifyConnection)
    expect(row?.accessToken).not.toContain('my-client-secret')
    expect(row?.accessToken).not.toContain(OAUTH_TOKEN)
    expect(row?.accessToken.startsWith('v2.')).toBe(true)
    const view = await withStore(app, storeId, (tx) => getConnection(tx, SECRET))
    expect(view).toMatchObject({
      shopDomain: 'waimers.myshopify.com',
      shopName: 'Waimers',
      authMode: 'client_credentials',
      tokenHint: '••••t-id',
    })
  })

  it('refuses a bad client id/secret with a readable message', async () => {
    const storeId = await seedStore()
    const denied = fakeFetch(shopify, [], () => new Response('', { status: 400 }))
    await expect(
      withStore(app, storeId, (tx) =>
        connect(
          tx,
          storeId,
          { shopDomain: 'waimers', clientId: 'x', clientSecret: 'y' },
          SECRET,
          denied,
        ),
      ),
    ).rejects.toThrow(ShopifyOAuthError)
  })

  it('refreshes a token that is expiring soon, and persists the refresh', async () => {
    const storeId = await seedStore()
    let tokenCalls = 0
    const fetchImpl = fakeFetch(shopify, [], () => {
      tokenCalls++
      // First token is nearly expired already, so `clientFor` must refresh it.
      return oauthSuccess(tokenCalls === 1 ? 30 : 86399)
    })
    await withStore(app, storeId, (tx) =>
      connect(
        tx,
        storeId,
        { shopDomain: 'waimers', clientId: 'cid', clientSecret: 'sec' },
        SECRET,
        fetchImpl,
      ),
    )
    expect(tokenCalls).toBe(1)
    const inStore: InStore = (fn) => withStore(app, storeId, fn)
    const client = await withStore(app, storeId, (tx) =>
      clientFor(tx, SECRET, { fetch: fetchImpl, inStore }),
    )
    expect(tokenCalls).toBe(2)
    expect(client).not.toBeNull()
  })
})

describe('testConnection scope check', () => {
  it('reports the shop name and which of the import scopes are granted or missing', async () => {
    const storeId = await connected(fakeFetch(shopify))
    const check = await withStore(app, storeId, (tx) =>
      testConnection(tx, SECRET, { fetch: fakeFetch(shopify) }),
    )
    expect(check.shopName).toBe('Waimers')
    expect(check.granted).toEqual(
      expect.arrayContaining(['read_products', 'read_inventory', 'read_customers', 'read_content']),
    )
    expect(check.missing).toEqual(
      expect.arrayContaining(['read_orders', 'read_all_orders', 'read_online_store_navigation']),
    )
  })

  it('refuses when nothing is connected yet', async () => {
    const storeId = await seedStore()
    await expect(
      withStore(app, storeId, (tx) => testConnection(tx, SECRET, { fetch: fakeFetch(shopify) })),
    ).rejects.toThrow(/Connect your Shopify store first/)
  })
})

describe('ShopifyClient rate limits', () => {
  it('waits out THROTTLED and 429 responses, then succeeds', async () => {
    const slept: number[] = []
    let calls = 0
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: TOKEN,
      sleep: async (ms) => {
        slept.push(ms)
      },
      fetch: fakeFetch(() => {
        calls++
        if (calls === 1) return new Response('', { status: 429, headers: { 'retry-after': '2' } })
        if (calls === 2)
          return json({
            errors: [{ message: 'Throttled', extensions: { code: 'THROTTLED' } }],
            extensions: {
              cost: {
                throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 10, restoreRate: 50 },
              },
            },
          })
        return json({ data: { shop: { name: 'Waimers' } }, extensions: { cost } })
      }),
    })
    const data = await client.query<{ shop: { name: string } }>('{ shop { name } }', {}, 110)
    expect(data.shop.name).toBe('Waimers')
    expect(slept).toEqual([2000, 2000])
  })

  it('pauses before an expensive query when the bucket is low', async () => {
    const slept: number[] = []
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: TOKEN,
      sleep: async (ms) => {
        slept.push(ms)
      },
      fetch: fakeFetch(() =>
        json({
          data: { ok: true },
          extensions: {
            cost: {
              throttleStatus: { maximumAvailable: 1000, currentlyAvailable: 100, restoreRate: 50 },
            },
          },
        }),
      ),
    })
    await client.query('{ a }', {}, 10)
    await client.query('{ a }', {}, 600)
    expect(slept).toEqual([10_000])
  })

  it('refreshes the access token once on a 401 and retries', async () => {
    let calls = 0
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: 'stale-token',
      refreshToken: async () => 'fresh-token',
      sleep: async () => {},
      fetch: fakeFetch(() => {
        calls++
        if (calls === 1) return new Response('', { status: 401 })
        return json({ data: { shop: { name: 'Waimers' } }, extensions: { cost } })
      }),
    })
    const data = await client.query<{ shop: { name: string } }>('{ shop { name } }')
    expect(data.shop.name).toBe('Waimers')
    expect(calls).toBe(2)
  })

  it('does not retry a second 401 after the token has already been refreshed once', async () => {
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: 'stale-token',
      refreshToken: async () => 'still-bad',
      sleep: async () => {},
      fetch: fakeFetch(() => new Response('', { status: 401 })),
    })
    await expect(client.query('{ shop { name } }')).rejects.toThrow(ShopifyError)
  })

  it('gives up with a typed error on repeated 5xx', async () => {
    const client = new ShopifyClient({
      shopDomain: 'waimers.myshopify.com',
      accessToken: TOKEN,
      maxAttempts: 2,
      sleep: async () => {},
      fetch: fakeFetch(() => new Response('', { status: 502 })),
    })
    await expect(client.query('{ a }')).rejects.toBeInstanceOf(ShopifyError)
  })
})

describe('HTML to rich text', () => {
  it('keeps structure and formatting, drops scripts, and lists images', () => {
    const { doc, images } = htmlToRichText(
      '<h2>Title</h2><p>Hello <strong>bold</strong> &amp; <a href="/x">link</a><br>line</p><script>x()</script><ul><li>One</li><li>Two</li></ul><img src="https://cdn/i.png" alt="I">',
    )
    const root = doc?.root as unknown as {
      children: { type: string; tag?: string; children?: unknown[] }[]
    }
    expect(root.children.map((c) => c.type)).toEqual(['heading', 'paragraph', 'list', 'paragraph'])
    expect(root.children[0]?.tag).toBe('h2')
    expect(JSON.stringify(root)).not.toContain('x()')
    expect(JSON.stringify(root.children[1])).toContain('"format":1')
    expect(JSON.stringify(root.children[1])).toContain('"type":"link"')
    expect(images).toEqual([{ src: 'https://cdn/i.png', alt: 'I' }])
    expect(htmlToRichText('  ').doc).toBeNull()
  })
})

describe('API import run', () => {
  it('previews counts, then imports every resource with pagination, rules, menus and redirects', async () => {
    const log: FetchLog = []
    const fetchImpl = fakeFetch(shopify, log)
    const storeId = await connected(fetchImpl)
    const storage = new MemoryStorageProvider()
    const d = deps(storeId, storage, { fetch: fetchImpl, sleep: async () => {} })
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, {
        resources: [
          'products',
          'collections',
          'customers',
          'orders',
          'pages',
          'articles',
          'menus',
          'redirects',
        ],
        createdBy: null,
      }),
    )

    await executeRun(d, run.id)
    const [preview] = await owner.select().from(importRun).where(eq(importRun.id, run.id))
    expect(preview?.status).toBe('completed')
    expect(preview?.progress).toMatchObject({
      products: { total: 2, created: 2 },
      collections: { total: 3, created: 3 },
      customers: { total: 1, created: 1 },
      orders: { total: 1, created: 1 },
      pages: { total: 1 },
      articles: { total: 1 },
      menus: { total: 1 },
      redirects: { total: 1 },
    })
    expect(await owner.select().from(product)).toHaveLength(0)
    expect(log.some((l) => l.url.includes('cdn.shopify.com'))).toBe(false)

    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)
    const [done] = await owner.select().from(importRun).where(eq(importRun.id, run.id))
    expect(done?.status).toBe('completed')
    expect(done?.error).toBeNull()
    // The import read the preview's copy (plus changes), then deleted it.
    expect(preview?.snapshot?.streams).toHaveProperty('products')
    expect(done?.snapshotUse?.reused).toEqual([
      'products',
      'collections',
      'customers',
      'orders',
      'pages',
      'articles',
    ])
    expect(done?.snapshot).toBeNull()
    expect(storage.objects.size).toBeGreaterThan(0)
    expect([...storage.objects.keys()].some((k) => k.includes('/snapshot/'))).toBe(false)

    // Products, including the variant that arrived on the nested second page.
    const variants = await owner.select().from(variant).orderBy(asc(variant.sku))
    expect(variants.map((v) => [v.sku, v.weightGrams, v.hsCode])).toEqual([
      ['ARIA-BLK', 250, '851830'],
      ['KEY-BLU', 250, '8473'],
      ['KEY-RED', 250, '851830'],
    ])
    const [aria] = await owner.select().from(product).where(eq(product.handle, 'aria-headset'))
    expect(JSON.stringify(aria?.description)).toContain('https://media.test/stores/')

    // Smart rules we can express stay automatic; the rest fall back to manual membership.
    const cols = await owner.select().from(collection).orderBy(asc(collection.handle))
    expect(cols.map((c) => [c.handle, c.kind, c.sortOrder])).toEqual([
      ['audio', 'automatic', 'price_asc'],
      ['in-stock', 'manual', 'manual'],
      ['staff-picks', 'manual', 'manual'],
    ])
    expect(cols[0]?.rules).toEqual({
      match: 'all',
      conditions: [
        { field: 'type', op: 'eq', value: 'Audio' },
        { field: 'price', op: 'gt', value: '1000' },
      ],
    })
    const inStock = await owner
      .select()
      .from(collectionProduct)
      .where(eq(collectionProduct.collectionId, cols[1]?.id as string))
    expect(inStock).toHaveLength(2)
    const audio = await owner
      .select()
      .from(collectionProduct)
      .where(eq(collectionProduct.collectionId, cols[0]?.id as string))
    expect(audio.map((m) => m.productId)).toEqual([aria?.id])
    expect(cols[2]?.imageMediaId).not.toBeNull()

    const [meera] = await owner.select().from(customer)
    expect(meera).toMatchObject({ email: 'meera@example.com', acceptsMarketing: true })
    expect(meera?.defaultAddress?.stateCode).toBe('TN')

    const [o] = await owner.select().from(order)
    expect(o).toMatchObject({
      number: 2001,
      status: 'open',
      paymentStatus: 'paid',
      importedFrom: 'shopify',
      customerId: meera?.id,
    })
    const [line] = await owner.select().from(orderLine)
    expect(line?.variantId).toBe(variants.find((v) => v.sku === 'KEY-BLU')?.id)

    const [p] = await owner.select().from(page)
    expect(p).toMatchObject({ handle: 'shipping-policy', seoTitle: 'Shipping' })
    expect(p?.publishedAt).not.toBeNull()

    const [journal] = await owner.select().from(blog).where(eq(blog.handle, 'journal'))
    const [post] = await owner.select().from(article)
    expect(post).toMatchObject({
      blogId: journal?.id,
      handle: 'launch-day',
      status: 'published',
      author: 'Kuldeep',
      excerpt: 'Live now.',
    })
    expect(post?.imageMediaId).not.toBeNull()

    const [menu] = await owner
      .select()
      .from(navigationMenu)
      .where(eq(navigationMenu.handle, 'main-menu'))
    expect(menu?.items).toEqual([
      { id: 'i1', title: 'Home', type: 'home' },
      {
        id: 'i2',
        title: 'Shop',
        type: 'collection',
        value: 'audio',
        children: [
          { id: 'i3', title: 'Aria', type: 'product', value: 'aria-headset' },
          { id: 'i4', title: 'Shipping', type: 'page', value: 'shipping-policy' },
        ],
      },
      { id: 'i5', title: 'Discord', type: 'url', value: 'https://discord.gg/waimers' },
    ])

    const redirects = await withStore(app, storeId, async (tx) => ({
      custom: await findRedirect(tx, '/old-sale'),
      article: await findRedirect(tx, '/blogs/journal/launch_day'),
    }))
    expect(redirects).toEqual({
      custom: '/collections/audio',
      article: '/blogs/journal/launch-day',
    })

    // A second full run changes nothing but timestamps.
    const counts = async () =>
      Promise.all(
        [product, variant, collection, customer, order, page, article, navigationMenu, media].map(
          async (t) => (await owner.select().from(t)).length,
        ),
      )
    const before = await counts()
    const again = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, {
        resources: [
          'products',
          'collections',
          'customers',
          'orders',
          'pages',
          'articles',
          'menus',
          'redirects',
        ],
        createdBy: null,
      }),
    )
    await executeRun(d, again.id)
    await withStore(app, storeId, (tx) => startRun(tx, again.id))
    await executeRun(d, again.id)
    expect(await counts()).toEqual(before)
    const [second] = await owner.select().from(importRun).where(eq(importRun.id, again.id))
    expect(second?.progress.products).toMatchObject({ created: 0, updated: 2 })
    // Already here with the same target: in place, counted like any record a re-run finds (#272 notes).
    expect(second?.progress.redirects).toMatchObject({ updated: 1, skipped: 0 })
  })

  it('queues each hosted image once, nothing on a dry run, and nothing again on a re-run', async () => {
    const log: FetchLog = []
    const fetchImpl = fakeFetch(shopify, log)
    const storeId = await connected(fetchImpl)
    const storage = new MemoryStorageProvider()
    const q = fakeMediaQueue()
    const d = deps(storeId, storage, {
      fetch: fetchImpl,
      sleep: async () => {},
      processMedia: q.processMedia(storeId),
    })
    const resources = ['products', 'collections', 'pages', 'articles'] as const
    const newRun = () =>
      withStore(app, storeId, (tx) =>
        createApiRun(tx, storeId, { resources: [...resources], createdBy: null }),
      )

    const run = await newRun()
    await executeRun(d, run.id) // dry run
    expect(log.some((l) => l.url.includes('cdn.shopify.com'))).toBe(false)
    expect(q.adds).toHaveLength(0)

    await withStore(app, storeId, (tx) => startRun(tx, run.id))
    await executeRun(d, run.id)
    const images = (await owner.select().from(media)).filter((m) =>
      m.contentType?.startsWith('image/'),
    )
    expect(images.length).toBeGreaterThan(0)
    expect(q.adds.map((a) => a.jobId).sort()).toEqual(images.map((m) => m.id).sort())
    expect(q.adds.every((a) => a.data.storeId === storeId && a.jobId === a.data.mediaId)).toBe(true)

    const again = await newRun()
    await executeRun(d, again.id)
    await withStore(app, storeId, (tx) => startRun(tx, again.id))
    await executeRun(d, again.id)
    const [second] = await owner.select().from(importRun).where(eq(importRun.id, again.id))
    expect(second?.status).toBe('completed')
    expect(q.adds).toHaveLength(images.length)
    expect(q.jobs.size).toBe(images.length)
  })

  it('fails the run clearly when there is no connection', async () => {
    const storeId = await seedStore()
    const run = await withStore(app, storeId, (tx) =>
      createApiRun(tx, storeId, { resources: ['products'], createdBy: null }),
    )
    await executeRun(deps(storeId, new MemoryStorageProvider()), run.id)
    const [row] = await owner.select().from(importRun).where(eq(importRun.id, run.id))
    expect(row).toMatchObject({ status: 'failed', error: 'Connect your Shopify store first' })
  })
})
