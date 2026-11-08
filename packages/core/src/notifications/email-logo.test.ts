/** SOURCE OF TRUTH: email logo tests — WHAT: an imported (Liquid) theme's own logo reaches every email, else our theme's brand logo, else the checkout branding logo / WHY: Waimers' imported theme keeps its logo in its own settings, and emails went out with none */
import { createDb, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fixtureThemeZip, PNG_1X1 } from '../../test/theme-import-fixture'
import { publishTheme } from '../theme/library'
import { importShopifyTheme } from '../theme-import/import'
import { storeEmailBrand } from './email-brand'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

beforeEach(async () => {
  await resetDb(owner)
})

const inStore = <T>(storeId: string, fn: (tx: StoreTx) => Promise<T>) => withStore(app, storeId, fn)

async function seedStore(preferences: unknown = null) {
  const [s] = await owner
    .insert(store)
    .values({ slug: 'waimers', name: 'Waimers', preferences })
    .returning()
  if (!s) throw new Error('seed')
  return s.id
}

/** The old store's CDN: every image is a 1x1 PNG. */
const shopify = {
  fetch: (async (input: string | URL | Request) => {
    const url = String(input instanceof Request ? input.url : input)
    return url.includes('/cdn/shop/files/') || url.includes('shop_images')
      ? new Response(PNG_1X1, { status: 200, headers: { 'content-type': 'image/png' } })
      : new Response('nope', { status: 404 })
  }) as typeof globalThis.fetch,
  lookup: async () => ['93.184.216.34'],
}

describe('storeEmailBrand logo', () => {
  it("uses a live imported theme's own logo setting (Theme settings, Logo)", async () => {
    const storeId = await seedStore()
    const extra = {
      // Theme settings → Logo, as Waimers has it: a light and a dark-mode logo.
      'config/settings_data.json': JSON.stringify({
        current: {
          logo: 'https://cdn.example/waimers-logo.png',
          logo_dark: 'https://cdn.example/waimers-logo-dark.png',
        },
      }),
      'config/settings_schema.json': JSON.stringify([
        { name: 'theme_info', theme_name: 'Revamp' },
        {
          name: 'Logo',
          settings: [
            { type: 'image_picker', id: 'logo', label: 'Logo image' },
            { type: 'image_picker', id: 'logo_dark', label: 'Logo image (dark mode)' },
          ],
        },
      ]),
    }
    const { themeId } = await inStore(storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: fixtureThemeZip({ extra }), fileName: 'revamp.zip', shopifyHost: null },
        { storage: new MemoryStorageProvider(), fetch: shopify.fetch, lookup: shopify.lookup },
      ),
    )
    await inStore(storeId, (tx) => publishTheme(tx, themeId))
    const brand = await inStore(storeId, (tx) => storeEmailBrand(tx, storeId))
    expect(brand.logoUrl).toBe('https://cdn.example/waimers-logo.png')
  })

  it('falls back to the checkout branding logo when the theme has none', async () => {
    const storeId = await seedStore({
      checkout: { branding: { logo: { mediaId: 'm1', url: 'https://cdn.example/checkout.png' } } },
    })
    const brand = await inStore(storeId, (tx) => storeEmailBrand(tx, storeId))
    expect(brand.logoUrl).toBe('https://cdn.example/checkout.png')
  })

  it('leaves the logo out when nothing is set, or a path has no domain to sit on', async () => {
    const storeId = await seedStore({
      checkout: { branding: { logo: { mediaId: 'm1', url: '/media/logo.png' } } },
    })
    const brand = await inStore(storeId, (tx) => storeEmailBrand(tx, storeId))
    expect(brand.logoUrl ?? null).toBeNull()
  })
})
