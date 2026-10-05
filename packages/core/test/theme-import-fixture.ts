/** SOURCE OF TRUTH: the Shopify theme test fixture — WHAT: a tiny but complete Shopify theme (layout, a section with schema and blocks, a snippet, JSON templates and groups, settings, locale, an asset) zipped in memory, plus a fake data source / WHY: theme-import tests must never call real stores or read the owner's theme from disk; this is the theme they all import and render */
import { strToU8, zipSync } from 'fflate'
import type {
  LiquidBlogData,
  LiquidCollectionData,
  LiquidCustomData,
  LiquidDataSource,
  LiquidMetafieldData,
  LiquidMetaobjectData,
  LiquidPageData,
  LiquidProductData,
} from '../src/theme-import/drops'

export const FIXTURE_HERO = `{%- liquid
  assign heading = section.settings.heading
  comment
    A comment inside a liquid tag, as Shopify allows.
  endcomment
-%}
{{ 'section-hero.css' | asset_url | stylesheet_tag }}
<div class="hero color-{{ section.settings.color_scheme }}" data-id="{{ section.id }}">
  <h2>{{ heading }}</h2>
  {%- if section.settings.image != blank -%}{{ section.settings.image | image_url: width: 800 | image_tag: class: 'hero__img' }}{%- endif -%}
  {%- for block in section.blocks -%}
    <p class="slide" {{ block.shopify_attributes }}>{{ block.settings.title }} {{ 'general.items' | t: count: forloop.length }}</p>
  {%- endfor -%}
  {%- assign p = section.settings.product -%}
  {%- if p -%}
    <span class="price">{{ p.price | money }}</span>
    <script type="application/json">{"id": {{ p.selected_or_first_available_variant.id }}}</script>
    {%- form 'product', p, class: 'buy' -%}<input name="id" value="{{ p.selected_or_first_available_variant.id }}">{%- endform -%}
  {%- endif -%}
  {%- render 'badge', text: 'New' -%}
  {%- for link in linklists[section.settings.menu].links -%}<a href="{{ link.url }}">{{ link.title }}</a>{%- endfor -%}
</div>
{% schema %}
{
  "name": "t:sections.hero.name",
  "class": "hero-section",
  "settings": [
    { "type": "header", "content": "Words" },
    { "type": "text", "id": "heading", "label": "Heading", "default": "Hello" },
    { "type": "image_picker", "id": "image", "label": "Image" },
    { "type": "product", "id": "product", "label": "Product" },
    { "type": "link_list", "id": "menu", "label": "Menu" },
    { "type": "color_scheme", "id": "color_scheme", "label": "Scheme", "default": "scheme-1" },
    { "type": "range", "id": "speed", "label": "Speed", "min": 1, "max": 9, "step": 1, "unit": "s", "default": 3 },
    { "type": "checkbox", "id": "autoplay", "label": "Autoplay" },
    { "type": "video", "id": "video", "label": "Video" }
  ],
  "blocks": [
    { "type": "slide", "name": "Slide", "settings": [{ "type": "text", "id": "title", "label": "Title" }] },
    { "type": "@app" }
  ]
}
{% endschema %}`

const CART = `{%- form 'customer', class: 'newsletter' -%}{%- if form.posted_successfully? -%}<p class="thanks">Thanks</p>{%- endif -%}<input name="contact[email]">{%- endform -%}
{%- if cart.item_count > 0 -%}<span class="count">{{ cart.item_count }}</span>{%- endif -%}
{% schema %}{ "name": "Footer", "settings": [] }{% endschema %}`

const CONTACT = `{%- form 'contact' -%}<textarea name="contact[body]"></textarea>{%- endform -%}
{% schema %}{ "name": "Contact form", "settings": [] }{% endschema %}`

const LAYOUT = `<!doctype html>
<html lang="{{ request.locale.iso_code }}" class="no-js" data-theme-name="fixture">
  <head>
    <title>{{ page_title }}</title>
    <meta name="description" content="x">
    {{ 'base.css' | asset_url | stylesheet_tag }}
    {{ settings.type_body_font | font_face }}
    <style>:root { --body: {{ settings.type_body_font.family }}; }</style>
  </head>
  <body class="template-{{ template.name }}">
    <a class="skip" href="#MainContent">{{ 'general.skip' | t }}</a>
    {% sections 'header-group' %}
    <main id="MainContent" role="main">{{ content_for_layout }}</main>
    {% sections 'footer-group' %}
    <script src="{{ 'theme.js' | asset_url }}" defer></script>
  </body>
</html>`

const INDEX_JSON = `/* Shopify writes a comment here */
{
  "sections": {
    "hero": {
      "type": "hero",
      "settings": {
        "heading": "Welcome",
        "image": "shopify://shop_images/banner.png",
        "product": "mouse",
        "menu": "main-menu",
        "video": "shopify://files/videos/intro.mp4",
        "color_scheme": "scheme-2"
      },
      "blocks": {
        "slide_a": { "type": "slide", "settings": { "title": "One" } },
        "slide_b": { "type": "slide", "disabled": true, "settings": { "title": "Hidden" } },
        "app_c": { "type": "shopify://apps/judge-me/blocks/review/123", "settings": {} }
      },
      "block_order": ["slide_a", "slide_b", "app_c"]
    },
    "contact": { "type": "contact", "settings": {} },
    "gone": { "type": "hero", "disabled": true, "settings": {} }
  },
  "order": ["hero", "contact", "gone"]
}`

const HEADER_GROUP = `{ "type": "header", "name": "Header", "sections": { "announce": { "type": "hero", "settings": { "heading": "Sale" } } }, "order": ["announce"] }`
const FOOTER_GROUP = `{ "type": "footer", "name": "Footer", "sections": { "footer": { "type": "footer", "settings": {} } }, "order": ["footer"] }`

const SETTINGS_SCHEMA = JSON.stringify([
  { name: 'theme_info', theme_name: 'Fixture', theme_version: '1.2.0', theme_author: 'Owner' },
  {
    name: 'Typography',
    settings: [
      { type: 'font_picker', id: 'type_body_font', label: 'Body', default: 'inter_n4' },
      { type: 'image_picker', id: 'logo', label: 'Logo' },
      { type: 'color_scheme_group', id: 'color_schemes', definition: [] },
    ],
  },
])

const SETTINGS_DATA = JSON.stringify({
  current: 'Default',
  presets: {
    Default: {
      type_body_font: 'inter_n4',
      logo: 'shopify://shop_images/logo.png',
      color_schemes: {
        'scheme-1': { settings: { background: '#ffffff', text: '#111111' } },
        'scheme-2': { settings: { background: '#6c3baa', text: '#ffffff' } },
      },
    },
  },
})

const LOCALE = JSON.stringify({
  general: {
    skip: 'Skip to content',
    items: { one: '{{ count }} item', other: '{{ count }} items' },
  },
})
const SCHEMA_LOCALE = JSON.stringify({ sections: { hero: { name: 'Hero banner' } } })

/** The fixture theme as the zip Shopify emails, optionally wrapped in a folder. */
export function fixtureThemeZip(options: { wrap?: string; extra?: Record<string, string> } = {}) {
  const files: Record<string, string> = {
    'layout/theme.liquid': LAYOUT,
    'sections/hero.liquid': FIXTURE_HERO,
    'sections/footer.liquid': CART,
    'sections/contact.liquid': CONTACT,
    'sections/header-group.json': HEADER_GROUP,
    'sections/footer-group.json': FOOTER_GROUP,
    'snippets/badge.liquid': '<em class="badge">{{ text }}</em>',
    'templates/index.json': INDEX_JSON,
    'templates/product.json': '{ "sections": {}, "order": [] }',
    'config/settings_schema.json': SETTINGS_SCHEMA,
    'config/settings_data.json': SETTINGS_DATA,
    'locales/en.default.json': LOCALE,
    'locales/en.default.schema.json': SCHEMA_LOCALE,
    'assets/base.css': 'body { margin: 0; }',
    'assets/section-hero.css': '.hero { color: red; }',
    'assets/theme.js': 'console.log(1)',
    'README.md': 'not part of a theme',
    ...options.extra,
  }
  const prefix = options.wrap ? `${options.wrap}/` : ''
  return zipSync(
    Object.fromEntries(Object.entries(files).map(([k, v]) => [prefix + k, strToU8(v)])),
  )
}

/** A 1×1 PNG. */
export const PNG_1X1 = Uint8Array.from(
  atob(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  ),
  (c) => c.charCodeAt(0),
)

export const FIXTURE_PRODUCT: LiquidProductData = {
  id: '01a0def6-2a0e-70e2-ab02-50865ced7d60',
  handle: 'mouse',
  title: 'Mouse',
  descriptionHtml: '<p>Light</p>',
  vendor: 'Pulsar',
  type: 'Mice',
  tags: [],
  images: [{ url: 'https://cdn.example/mouse.png', width: 800, height: 600 }],
  variants: [
    {
      id: '01a0def6-2cfc-7432-959f-6c1028dc9b34',
      title: 'Black',
      price: 749900,
      compareAtPrice: 899900,
      available: true,
      inventoryQuantity: 4,
      sku: 'M-1',
      barcode: null,
      options: ['Black'],
      image: null,
      weightGrams: 60,
    },
  ],
  options: [{ name: 'Colour', values: ['Black'] }],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  preorder: false,
}

/** Extra records a test hands the fake data source: more catalogue, extra fields, entries. */
export type FakeStoreData = {
  products?: LiquidProductData[]
  collections?: LiquidCollectionData[]
  pages?: LiquidPageData[]
  blogs?: LiquidBlogData[]
  /** Owner id → extra fields. */
  metafields?: Record<string, LiquidMetafieldData[]>
  entries?: LiquidMetaobjectData[]
}

/** A data source answering from memory, counting calls. */
export function fakeDataSource(extra: FakeStoreData = {}): LiquidDataSource & { calls: string[] } {
  const calls: string[] = []
  const products = [FIXTURE_PRODUCT, ...(extra.products ?? [])]
  const collections = extra.collections ?? []
  const entries = extra.entries ?? []
  const custom = (list: LiquidMetaobjectData[]): LiquidCustomData => ({
    metafields: {},
    entries: list,
  })
  return {
    calls,
    shop: {
      name: 'Waimers',
      email: 'hi@example.test',
      phone: '',
      domain: 'shop.example',
      url: 'https://shop.example',
      currency: 'INR',
      description: '',
    },
    product: async (h) => {
      calls.push(`product:${h}`)
      return products.find((p) => p.handle === h) ?? null
    },
    collection: async (h) => collections.find((c) => c.handle === h) ?? null,
    collectionProducts: async () => [],
    collections: async () => collections,
    menu: async (h) => {
      calls.push(`menu:${h}`)
      return h === 'main-menu'
        ? {
            handle: h,
            title: 'Main',
            links: [
              { title: 'Mice', url: '/collections/mice', type: 'collection_link', links: [] },
            ],
          }
        : null
    },
    blog: async (h) => extra.blogs?.find((b) => b.handle === h) ?? null,
    page: async (h) => extra.pages?.find((p) => p.handle === h) ?? null,
    cart: async () => ({ itemCount: 2, totalPrice: 100, items: [] }),
    metafields: async (ownerType, ids) => {
      calls.push(`metafields:${ownerType}:${ids.join(',')}`)
      const metafields = Object.fromEntries(
        ids.flatMap((id) => (extra.metafields?.[id] ? [[id, extra.metafields[id]]] : [])),
      )
      return { metafields, entries }
    },
    metaobjectsOfType: async (type) => {
      calls.push(`metaobjects:${type}`)
      return custom(entries)
    },
    metaobjects: async (ids) => {
      calls.push(`metaobjects-by-id:${ids.join(',')}`)
      return custom(entries.filter((e) => ids.includes(e.id)))
    },
  }
}
