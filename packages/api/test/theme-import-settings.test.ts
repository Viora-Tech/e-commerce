import { createMerchantAuth } from '@commerce/auth'
import { importShopifyTheme } from '@commerce/core'
import { createDb, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { MemoryStorageProvider } from '@commerce/storage'
import { call } from '@orpc/server'
import { strToU8, zipSync } from 'fflate'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import type { ApiContext } from '../src/context'
import { appRouter } from '../src/routers/_app'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

const sent: { email: string; otp: string }[] = []
const auth = createMerchantAuth({
  db: app,
  baseURL: 'http://localhost:3200',
  secret: 'test-secret-test-secret-test-secret-1234',
  sendOtp: async (m) => {
    sent.push(m)
  },
})

async function signIn(email: string) {
  await auth.api.sendVerificationOTP({ body: { email, type: 'sign-in' } })
  const res = await auth.api.signInEmailOTP({
    body: { email, otp: sent.at(-1)?.otp as string },
    asResponse: true,
  })
  return new Headers({ cookie: res.headers.get('set-cookie') ?? '' })
}

const ctx = (headers: Headers): ApiContext => ({
  db: app,
  auth,
  headers,
  notifications: { add: async () => undefined },
})

async function merchantWithStore(email: string, slug: string) {
  const headers = await signIn(email)
  const org = await auth.api.createOrganization({ headers, body: { name: slug, slug } })
  await auth.api.setActiveOrganization({ headers, body: { organizationId: org?.id as string } })
  const [s] = await owner
    .insert(store)
    .values({ slug, name: slug, organizationId: org?.id as string })
    .returning()
  if (!s) throw new Error('seed')
  return { headers, storeId: s.id }
}

/** A small Shopify theme: an accent colour and a favicon in its Theme settings. */
function themeZip() {
  const files: Record<string, string> = {
    'layout/theme.liquid': `<!doctype html><html><head>
{%- if settings.favicon != blank -%}<link rel="icon" href="{{ settings.favicon | image_url: width: 32 }}">{%- endif -%}
<style>:root { --accent: {{ settings.accent }}; }</style>
</head><body>{% sections 'header-group' %}<main>{{ content_for_layout }}</main>{% sections 'footer-group' %}</body></html>`,
    'sections/hero.liquid': `<p class="accent">{{ settings.accent }}</p>
{% schema %}{ "name": "Hero", "settings": [] }{% endschema %}`,
    'templates/index.json': '{ "sections": { "hero": { "type": "hero" } }, "order": ["hero"] }',
    'config/settings_schema.json': JSON.stringify([
      { name: 'theme_info', theme_name: 'Tiny' },
      {
        name: 'Colors',
        settings: [{ type: 'color', id: 'accent', label: 'Accent', default: '#000000' }],
      },
      { name: 'Favicon', settings: [{ type: 'image_picker', id: 'favicon', label: 'Favicon' }] },
    ]),
    'config/settings_data.json': JSON.stringify({ current: { accent: '#111111' } }),
  }
  return zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])))
}

beforeEach(async () => {
  await resetDb(owner)
  sent.length = 0
})

afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

describe('imported theme settings', () => {
  it('lists, previews and saves the theme’s own settings', async () => {
    const { headers, storeId } = await merchantWithStore('settings@example.com', 'settings-shop')
    const { themeId } = await withStore(app, storeId, (tx) =>
      importShopifyTheme(
        tx,
        storeId,
        { zip: themeZip(), fileName: 'tiny.zip' },
        { storage: new MemoryStorageProvider() },
      ),
    )
    const context = ctx(headers)

    const info = await call(appRouter.themes.import.editor, { themeId }, { context })
    expect(info?.settingsSchema.map((g) => g.name)).toEqual(['theme_info', 'Colors', 'Favicon'])
    expect(info?.settingValues).toEqual({ accent: '#111111', favicon: { url: '', alt: '' } })

    // Unsaved values preview in the head and in sections; one that is not a colour is ignored.
    const head = await call(
      appRouter.themes.import.head,
      { themeId, themeSettings: { accent: '#FF0000' } },
      { context },
    )
    expect(head?.head).toContain('--accent: #FF0000')
    const ignored = await call(
      appRouter.themes.import.head,
      { themeId, themeSettings: { accent: 'red;}</style>' } },
      { context },
    )
    expect(ignored?.head).toContain('--accent: #111111')
    const html = await call(
      appRouter.themes.import.render,
      {
        themeId,
        sections: [
          { id: 'hero', type: 'hero', settings: {}, blocks: [], location: 'template', index: 0 },
        ],
        themeSettings: { accent: '#FF0000' },
      },
      { context },
    )
    expect(html.hero).toContain('<p class="accent">#FF0000</p>')

    // Save: kept in the theme, so the next load (and the storefront) reads it.
    const saved = await call(
      appRouter.themes.import.saveSettings,
      {
        themeId,
        values: { accent: '#FF0000', favicon: { url: 'https://media.test/fav.png', alt: '' } },
      },
      { context },
    )
    expect(saved.settings).toMatchObject({
      accent: '#FF0000',
      favicon: { url: 'https://media.test/fav.png', alt: '' },
    })
    const after = await call(appRouter.themes.import.editor, { themeId }, { context })
    expect(after?.settingValues.accent).toBe('#FF0000')
    expect(after?.head).toContain('rel="icon" href="https://media.test/fav.png"')
  })
})
