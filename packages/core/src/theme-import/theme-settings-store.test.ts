/** SOURCE OF TRUTH: saving an imported theme's Theme settings — Customize's save cleans the values by the theme's `settings_schema.json`, keeps everything else of `settings_data.json`, moves the theme version on, and the theme's layout then renders the new favicon */
import { createDb, type StoreTx, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { fixtureThemeZip } from '../../test/theme-import-fixture'
import { ensureMainTheme, ThemeLibraryError } from '../theme/library'
import { loadThemeBundle, themeImportFor } from './bundle-store'
import { storeLiquidData } from './data'
import { importShopifyTheme } from './import'
import { createPageContext } from './page-context'
import { renderLiquidLayout } from './render'
import { saveImportedThemeSettings } from './theme-settings-store'

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

const LAYOUT = `<!doctype html>
<html lang="en">
  <head>
    <title>{{ page_title }}</title>
    {%- if settings.favicon != blank -%}
      <link rel="icon" type="image/png" href="{{ settings.favicon | image_url: width: 32, height: 32 }}">
    {%- endif -%}
    <style>:root { --logo-width: {{ settings.logo_width }}px; }</style>
  </head>
  <body>
    {% sections 'header-group' %}
    <main id="MainContent">{{ content_for_layout }}</main>
    {% sections 'footer-group' %}
  </body>
</html>`

const SCHEMA = JSON.stringify([
  { name: 'theme_info', theme_name: 'Fixture' },
  {
    name: 'Logo',
    settings: [
      { type: 'image_picker', id: 'logo', label: 'Logo' },
      { type: 'range', id: 'logo_width', min: 50, max: 300, step: 10, label: 'Width', default: 90 },
      { type: 'image_picker', id: 'favicon', label: 'Favicon' },
    ],
  },
  {
    name: 'Cart',
    settings: [{ type: 'checkbox', id: 'show_vendor', label: 'Show vendor' }],
  },
  {
    name: 'Colors',
    settings: [{ type: 'color_scheme_group', id: 'color_schemes', definition: [] }],
  },
])

async function importFixture() {
  const [s] = await owner
    .insert(store)
    .values({ slug: `s${Math.random().toString(36).slice(2, 8)}`, name: 'Waimers' })
    .returning()
  if (!s) throw new Error('seed')
  const storeId = s.id
  await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
  const { themeId } = await inStore(storeId, (tx) =>
    importShopifyTheme(
      tx,
      storeId,
      {
        zip: fixtureThemeZip({
          extra: { 'layout/theme.liquid': LAYOUT, 'config/settings_schema.json': SCHEMA },
        }),
        fileName: 'fixture.zip',
      },
      { storage: new MemoryStorageProvider() },
    ),
  )
  return { storeId, themeId }
}

/** The theme's layout as the storefront renders it now. */
const layoutOf = (storeId: string, themeId: string) =>
  inStore(storeId, async (tx) => {
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
    return renderLiquidLayout(ctx)
  })

describe('saveImportedThemeSettings', () => {
  it('stores cleaned values, keeps the rest, and the layout renders the new favicon', async () => {
    const { storeId, themeId } = await importFixture()
    const before = await inStore(storeId, (tx) => themeImportFor(tx, themeId))
    expect((await layoutOf(storeId, themeId)).favicon).toBeNull()

    const saved = await inStore(storeId, (tx) =>
      saveImportedThemeSettings(tx, {
        themeId,
        values: {
          favicon: { url: 'https://media.test/fav.png', alt: '' },
          logo_width: 999,
          show_vendor: 'yes',
          not_in_schema: 'x',
        },
        by: 'Owner',
      }),
    )

    expect(saved.favicon).toEqual({ url: 'https://media.test/fav.png', alt: '' })
    expect(saved.logo_width).toBe(300)
    expect('show_vendor' in saved).toBe(false)
    expect('not_in_schema' in saved).toBe(false)
    // What the import stored stays: the colour schemes and the body font.
    expect(Object.keys(saved.color_schemes as object)).toEqual(['scheme-1', 'scheme-2'])
    expect(saved.type_body_font).toBe('inter_n4')

    const after = await inStore(storeId, (tx) => themeImportFor(tx, themeId))
    expect(after?.settings).toEqual(saved)
    expect(after?.updatedAt.getTime()).toBeGreaterThan(before?.updatedAt.getTime() ?? 0)

    const layout = await layoutOf(storeId, themeId)
    expect(layout.favicon).toBe('https://media.test/fav.png')
    expect(layout.head).toContain('--logo-width: 300px')
  })

  it('refuses a theme that was not imported', async () => {
    const { storeId } = await importFixture()
    const live = await inStore(storeId, (tx) => ensureMainTheme(tx, storeId))
    await expect(
      inStore(storeId, (tx) =>
        saveImportedThemeSettings(tx, { themeId: live.id, values: { logo_width: 100 } }),
      ),
    ).rejects.toBeInstanceOf(ThemeLibraryError)
  })
})
