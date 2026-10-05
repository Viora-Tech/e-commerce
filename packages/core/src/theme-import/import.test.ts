/** SOURCE OF TRUTH: Shopify theme import tests — a fixture zip becomes a new unpublished theme with its files, templates, copied images and videos and a report; the live theme is untouched; bundles, assets, numeric variant ids and duplicates work. No real network: fetch and DNS are fakes */
import {
  createDb,
  media,
  newId,
  product,
  type StoreTx,
  store,
  theme,
  themeFile,
  themeImport,
  variant,
  withStore,
} from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fixtureThemeZip, PNG_1X1 } from '../../test/theme-import-fixture'
import { duplicateTheme, ensureMainTheme, publishTheme } from '../theme/library'
import { loadTemplate } from '../theme/templates'
import { importedThemeIds, loadThemeBundle, themeAssetFile, themeImportFor } from './bundle-store'
import { resolveThemeVariantId, storeLiquidData } from './data'
import { LIQUID_SECTION } from './fields'
import { cleanShopifyHost, importShopifyTheme, ThemeImportError } from './import'
import { numericId } from './numeric-id'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

async function seedStore() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${Math.random().toString(36).slice(2, 8)}`, name: 'Waimers' })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

const LIVE_HOME = `<html><body>
<div id="shopify-section-template--123__hero" class="shopify-section">
  <video playsinline="true" poster="//old.example/cdn/shop/files/preview_images/p.jpg?v=1"><source src="//old.example/cdn/shop/videos/c/vp/abc/abc.HD-1080p.mp4?v=0" type="video/mp4"></video>
</div>
<div id="shopify-section-template--123__contact" class="shopify-section"></div>
</body></html>`

/** The old store's CDN and home page, from memory. Counts every request. */
function fakeShopify() {
  const requests: string[] = []
  const fetch = (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    requests.push(url)
    const reply = (body: BodyInit, type: string) =>
      new Response(body, { status: 200, headers: { 'content-type': type } })
    if (url === 'https://old.example/') return reply(LIVE_HOME, 'text/html; charset=utf-8')
    if (url.includes('/cdn/shop/videos/'))
      return reply(new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112]), 'video/mp4')
    if (url.includes('/cdn/shop/files/')) return reply(PNG_1X1, 'image/png')
    return new Response('nope', { status: 404 })
  }) as typeof globalThis.fetch
  return { fetch, requests, lookup: async () => ['93.184.216.34'] }
}

describe('importShopifyTheme', () => {
  it('imports a zip as a new unpublished theme, copying images and videos', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const shopify = fakeShopify()
    const live = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))

    const result = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip(), fileName: 'fixture.zip', shopifyHost: 'https://old.example/' },
        { storage, fetch: shopify.fetch, lookup: shopify.lookup },
      ),
    )

    expect(result.name).toBe('Fixture (imported)')
    const rows = await owner.select().from(theme).where(eq(theme.storeId, storeId))
    expect(rows.find((r) => r.id === result.themeId)?.role).toBe('unpublished')
    expect(rows.find((r) => r.id === live.id)?.role).toBe('main')

    // Files exactly as uploaded; binary ones in base64.
    const files = await owner.select().from(themeFile).where(eq(themeFile.themeId, result.themeId))
    expect(files.map((f) => f.path)).toContain('sections/hero.liquid')
    expect(files.every((f) => f.storeId === storeId)).toBe(true)

    // Home, header and footer as LiquidSection templates; disabled sections stay hidden.
    const home = await inStore(storeId, (tx) => loadTemplate(tx, result.themeId, 'home'))
    expect(home.data.content.map((s) => s.type)).toEqual([
      LIQUID_SECTION,
      LIQUID_SECTION,
      LIQUID_SECTION,
    ])
    const hero = home.data.content[0]?.props as Record<string, unknown>
    expect(hero).toMatchObject({
      sectionType: 'hero',
      sectionKey: 'hero',
      _name: 'Hero banner',
      heading: 'Welcome',
    })
    expect((hero.image as { url: string }).url).toMatch(/^https:\/\/media\.test\//)
    expect((hero.video as { url: string; poster: { url: string } }).url).toMatch(
      /^https:\/\/media\.test\//,
    )
    expect(home.data.content[2]?.props._hidden).toBe(true)
    const header = await inStore(storeId, (tx) => loadTemplate(tx, result.themeId, 'header'))
    expect(header.data.content[0]?.props.sectionKey).toBe('announce')

    // The report: plain statuses, swaps, what is missing here.
    const { report } = result
    expect(report.themeName).toBe('Fixture')
    expect(report.images).toMatchObject({ copied: 2, videosCopied: 1, failed: [] })
    expect(report.videos).toEqual([])
    expect(report.missing.menus).toEqual(['main-menu'])
    expect(report.missing.products).toEqual(['mouse'])
    const bySection = Object.fromEntries(report.sections.map((s) => [s.type, s]))
    expect(bySection.hero?.status).toBe('unavailable')
    expect(bySection.hero?.reasons).toEqual(expect.arrayContaining(['cart_add', 'app_blocks']))
    expect(bySection.contact?.status).toBe('unavailable')
    expect(bySection.footer?.status).toBe('replaced')
    expect(report.imported.unsupported).toBe(0)
    expect(report.templates).toEqual([
      { name: 'index', status: 'imported' },
      { name: 'product', status: 'ours' },
    ])
    expect(report.skippedFiles).toContain('README.md')
    expect(shopify.requests.filter((u) => u === 'https://old.example/')).toHaveLength(1)

    // Copied files are in Files (media), as ready images and a video.
    const copied = await owner.select().from(media).where(eq(media.storeId, storeId))
    expect(copied.map((m) => m.contentType).sort()).toEqual([
      'image/png',
      'image/png',
      'image/png',
      'video/mp4',
    ])

    // It reads back for the renderer and the asset route, and lists as imported.
    const record = await inStore(storeId, (tx) => themeImportFor(tx, result.themeId))
    expect(record?.themeInfo.shopifyHost).toBe('old.example')
    expect(await inStore(storeId, (tx) => importedThemeIds(tx))).toEqual(new Set([result.themeId]))
    const bundle = await inStore(storeId, (tx) => loadThemeBundle(tx, result.themeId))
    expect(bundle?.sections.has('hero')).toBe(true)
    expect(await inStore(storeId, (tx) => loadThemeBundle(tx, live.id))).toBeNull()
    const css = await inStore(storeId, (tx) => themeAssetFile(tx, result.themeId, 'base.css'))
    expect(new TextDecoder().decode(css?.body)).toBe('body { margin: 0; }')
    expect(await inStore(storeId, (tx) => themeAssetFile(tx, result.themeId, '../x'))).toBeNull()
  })

  it('renders an imported section from the database with this store data', async () => {
    const storeId = await seedStore()
    const storage = new MemoryStorageProvider()
    const shopify = fakeShopify()
    const { themeId } = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip(), fileName: 'f.zip' },
        { storage, ...shopify },
      ),
    )
    const [p] = await owner
      .insert(product)
      .values({ storeId, handle: 'mouse', title: 'Mouse', status: 'active' })
      .returning()
    const [v] = await owner
      .insert(variant)
      .values({
        storeId,
        productId: p?.id as string,
        title: 'Black',
        pricePaise: 749900,
        trackInventory: false,
      })
      .returning()
    const html = await inStore(storeId, async (tx) => {
      const bundle = await loadThemeBundle(tx, themeId)
      if (!bundle) throw new Error('bundle')
      const ctx = await createPageContext({
        bundle,
        data: await storeLiquidData(tx, {
          storeId,
          host: 'shop.example',
          origin: 'https://shop.example',
        }),
        request: {
          template: 'index',
          path: '/',
          host: 'shop.example',
          origin: 'https://shop.example',
          designMode: false,
          postedForm: null,
          nonce: '',
        },
        assetBase: '/theme-assets/x',
        shopifyHost: null,
        moneyFormat: null,
        paymentTypes: [],
      })
      return renderLiquidSection(ctx, {
        id: 'hero',
        type: 'hero',
        settings: { heading: 'Hi', product: 'mouse' },
        blocks: [],
        location: 'template',
        index: 0,
      })
    })
    expect(html).toContain('<h2>Hi</h2>')
    expect(html).toContain('₹7,499')
    // The theme saw a whole-number variant id; our cart gets the UUID back.
    expect(html).toContain(`value="${numericId(v?.id as string)}"`)
    const resolved = await inStore(storeId, (tx) =>
      resolveThemeVariantId(tx, String(numericId(v?.id as string))),
    )
    expect(resolved).toBe(v?.id)
    expect(await inStore(storeId, (tx) => resolveThemeVariantId(tx, v?.id as string))).toBe(v?.id)
    expect(await inStore(storeId, (tx) => resolveThemeVariantId(tx, 'nope'))).toBeNull()
  })

  it('copies the import with the theme, so a duplicate renders too', async () => {
    const storeId = await seedStore()
    const shopify = fakeShopify()
    const { themeId } = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip(), fileName: 'f.zip' },
        { storage: new MemoryStorageProvider(), ...shopify },
      ),
    )
    const copy = await inStore(storeId, (tx) => duplicateTheme(tx, storeId, themeId))
    const files = await owner.select().from(themeFile).where(eq(themeFile.themeId, copy.id))
    expect(files.length).toBeGreaterThan(5)
    const imports = await owner.select().from(themeImport).where(eq(themeImport.themeId, copy.id))
    expect(imports).toHaveLength(1)
  })

  it('without a store address copies nothing and says so', async () => {
    const storeId = await seedStore()
    const shopify = fakeShopify()
    const { report } = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip(), fileName: 'f.zip' },
        { storage: new MemoryStorageProvider(), ...shopify },
      ),
    )
    expect(shopify.requests).toEqual([])
    expect(report.images).toMatchObject({ copied: 0, skippedNoHost: 2 })
    expect(report.videos).toEqual(['intro.mp4'])
  })

  it('refuses a file that is not a theme', async () => {
    const storeId = await seedStore()
    await expect(
      inStore(storeId, (tx) =>
        importShopifyTheme(
          tx,
          storeId,
          { zip: new Uint8Array([1, 2, 3]), fileName: 'x.zip' },
          { storage: new MemoryStorageProvider() },
        ),
      ),
    ).rejects.toBeInstanceOf(ThemeImportError)
  })

  it('cleans the store address a merchant types', () => {
    expect(cleanShopifyHost('https://Waimers.in/collections')).toBe('waimers.in')
    expect(cleanShopifyHost('x.myshopify.com')).toBe('x.myshopify.com')
    expect(cleanShopifyHost('not a host')).toBeNull()
    expect(cleanShopifyHost('')).toBeNull()
  })
})

describe('importShopifyTheme with media the Shopify importer already copied', () => {
  async function seedImported(storeId: string) {
    const add = async (name: string, contentType: string, resource: string, sourceId: string) => {
      const [row] = await owner
        .insert(media)
        .values({
          storeId,
          url: `https://files.example/${name}`,
          key: `k/${name}`,
          provider: 'memory',
          contentType,
          size: 10,
          width: 4,
          height: 3,
          status: 'ready',
        })
        .returning()
      await owner.execute(
        sql`insert into shopify_import_mapping (id, store_id, resource, source_id, local_id)
          values (${newId()}, ${storeId}, ${resource}, ${sourceId}, ${row?.id})`,
      )
    }
    await add('banner.png', 'image/png', 'media', 'https://cdn.shopify.com/s/f/1/files/banner.png')
    await add('logo.png', 'image/png', 'media', 'https://cdn.shopify.com/s/f/1/files/Logo.png')
    await add('intro.mp4', 'video/mp4', 'file_name', 'intro.mp4')
  }

  it('reuses them without an address and without downloading anything', async () => {
    const storeId = await seedStore()
    await seedImported(storeId)
    const shopify = fakeShopify()
    const { report } = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip(), fileName: 'f.zip' },
        { storage: new MemoryStorageProvider(), ...shopify },
      ),
    )
    expect(shopify.requests).toEqual([])
    expect(report.images).toMatchObject({
      copied: 2,
      videosCopied: 1,
      skippedNoHost: 0,
      failed: [],
    })
    expect(report.videos).toEqual([])
    expect(await owner.select().from(media).where(eq(media.storeId, storeId))).toHaveLength(3)
  })

  it('leaves exactly one live theme after the imported theme is published', async () => {
    const storeId = await seedStore()
    const before = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    const { themeId } = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip(), fileName: 'f.zip' },
        { storage: new MemoryStorageProvider() },
      ),
    )
    await inStore(storeId, (tx) => publishTheme(tx, themeId))
    const mains = await owner.select().from(theme).where(eq(theme.role, 'main'))
    expect(mains.map((t) => t.id)).toEqual([themeId])
    expect(mains.some((t) => t.id === before.id)).toBe(false)
  })

  it('uses the connected Shopify store when no address is typed', async () => {
    const storeId = await seedStore()
    await owner.execute(
      sql`insert into shopify_import_connection (id, store_id, shop_domain, access_token)
        values (${newId()}, ${storeId}, 'old.example', 'x')`,
    )
    const shopify = fakeShopify()
    const { report } = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip(), fileName: 'f.zip' },
        { storage: new MemoryStorageProvider(), ...shopify },
      ),
    )
    expect(report.images).toMatchObject({ copied: 2, videosCopied: 1, skippedNoHost: 0 })
    expect(shopify.requests).toContain('https://old.example/')
  })
})
