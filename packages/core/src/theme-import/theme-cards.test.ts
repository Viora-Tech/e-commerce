/** SOURCE OF TRUTH: tests for an imported theme's product cards on our collection grid and the theme settings our main sections carry over (#1047, #1048) — WHAT: the card call found in the theme's main collection section and rendered per handle (quick add posting to our cart, the section's assigns, the fallback snippet, no card), the theme's look read from its CSS and markup, MainCollection and MainProduct props from the theme / WHY: our main collection section replaces the theme's, but its cards and settings must be the theme's */
import { describe, expect, it } from 'vitest'
import { fakeDataSource, fixtureThemeZip } from '../../test/theme-import-fixture'
import { readThemeArchive } from './archive'
import { buildThemeBundle, type ThemeBundle } from './bundle'
import { themeMainProps } from './main-collection-props'
import { createPageContext } from './page-context'
import { renderThemeCards } from './render'
import { parseJsonTemplate } from './schema'
import { mainProductStylesheets } from './theme-cards'
import { themeLook } from './theme-look'

/** Zero Drift's `main-collection`, trimmed: the card call reads the section's own assigns. */
const MAIN_COLLECTION = `{{ 'section-collection.css' | asset_url | stylesheet_tag }}
<script src="{{ 'facets.js' | asset_url }}" defer="defer"></script>
{%- liquid
  assign show_rating = section.settings.show_rating
  assign show_quick_add = section.settings.show_quick_add
-%}
<div class="collection-grid">
  {%- for product in collection.products -%}
    {%- render 'product-card', product: product, show_quick_add: show_quick_add, show_rating: show_rating, lazy: true -%}
  {%- endfor -%}
</div>
{% schema %}
{ "name": "Collection", "settings": [
  { "type": "checkbox", "id": "show_rating", "label": "Rating", "default": true },
  { "type": "checkbox", "id": "show_quick_add", "label": "Quick add", "default": true },
  { "type": "range", "id": "columns_desktop", "label": "Columns", "min": 2, "max": 4, "step": 1, "default": 4 }
] }
{% endschema %}`

const PRODUCT_CARD = `<div class="product-card" data-quick="{{ show_quick_add }}"><h3>{{ product.title }}</h3>
{%- if product.compare_at_price > product.price -%}<s>{{ product.compare_at_price | money }}</s>{%- endif -%}
{%- if show_quick_add -%}{%- form 'product', product, class: 'product-card__quick-add-form' -%}<input type="hidden" name="id" value="{{ product.selected_or_first_available_variant.id }}"><button type="submit">Add to cart</button>{%- endform -%}{%- endif -%}
</div>`

const COLLECTION_JSON = `{ "sections": { "main": { "type": "main-collection", "settings": { "columns_desktop": 3, "show_quick_add": false } } }, "order": ["main"] }`

const textFiles = (extra: Record<string, string>) => {
  const archive = readThemeArchive(fixtureThemeZip({ extra }))
  const out = new Map<string, string>()
  for (const f of archive.files.values())
    if (f.text) out.set(f.path, new TextDecoder().decode(f.bytes))
  return out
}

let version = 0

async function collectionContext(extra: Record<string, string>) {
  const bundle = buildThemeBundle({
    themeId: 'theme-1',
    version: `v${++version}`,
    textFiles: textFiles(extra),
    assetChecksums: new Map(),
    settings: {},
  })
  return createPageContext({
    bundle,
    data: fakeDataSource(),
    request: {
      template: 'collection',
      path: '/collections/all',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: 'n0nce',
    },
    assetBase: '/theme-assets/theme-1',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
}

const ZERO_DRIFT = {
  'sections/main-collection.liquid': MAIN_COLLECTION,
  'snippets/product-card.liquid': PRODUCT_CARD,
}

describe('renderThemeCards', () => {
  it("draws the theme's card per handle, in order, with its quick add posting to our cart", async () => {
    const ctx = await collectionContext(ZERO_DRIFT)
    const out = await renderThemeCards(ctx, { handles: ['mouse', 'gone'] })
    expect(out?.cards).toHaveLength(2)
    const [card, missing] = out?.cards ?? []
    expect(card).toContain('<h3>Mouse</h3>')
    // The section's own assign (`show_quick_add`), at its schema default.
    expect(card).toContain('data-quick="true"')
    expect(card).toContain('action="/theme-actions/cart-add"')
    expect(card).toContain('<s>')
    // A product the store has not got draws nothing: the grid shows our card there.
    expect(missing).toBe('')
    // The section's stylesheet comes along; its other scripts do not.
    expect(out?.head).toContain('section-collection.css')
    expect(out?.head).not.toContain('facets.js')
  })

  it('reads the settings the import kept for the section', async () => {
    const ctx = await collectionContext(ZERO_DRIFT)
    const out = await renderThemeCards(ctx, {
      handles: ['mouse'],
      sections: [{ type: 'main-collection', key: 'main', settings: { show_quick_add: false } }],
    })
    expect(out?.cards[0]).toContain('data-quick="false"')
    expect(out?.cards[0]).not.toContain('<form')
  })

  it("falls back to Dawn's card snippet, and to nothing without one", async () => {
    const dawn = await collectionContext({
      'snippets/card-product.liquid': '<div class="card">{{ card_product.title }}</div>',
    })
    expect((await renderThemeCards(dawn, { handles: ['mouse'] }))?.cards).toEqual([
      '<div class="card">Mouse</div>',
    ])
    const none = await collectionContext({})
    expect(await renderThemeCards(none, { handles: ['mouse'] })).toBeNull()
  })

  it('a card that fails to render leaves the grid to ours', async () => {
    const ctx = await collectionContext({
      ...ZERO_DRIFT,
      'snippets/product-card.liquid': '{% render "product-card", product: product %}',
    })
    const errors: unknown[] = []
    expect(await renderThemeCards(ctx, { handles: ['mouse'] }, (e) => errors.push(e))).toBeNull()
    expect(errors).toHaveLength(1)
  })
})

describe('themeLook', () => {
  it("reads capital headings, a grid of trust badges and a filled Add to cart from the theme's files", () => {
    const glide = readThemeArchive(
      fixtureThemeZip({
        extra: {
          'assets/base.css':
            '/* h1 */ h1,\n.h1 { font-size: 40px; text-transform: uppercase; } @media (min-width: 1px) { .trust-badges { display: grid; } }',
          'snippets/buy-buttons.liquid':
            '<button type="submit" class="btn btn--primary buy-buttons__submit">Add</button>',
        },
      }),
    )
    expect(themeLook(glide)).toEqual({
      uppercaseTitles: true,
      trustBadgesGrid: true,
      solidAddToCart: true,
    })
    expect(themeLook(readThemeArchive(fixtureThemeZip()))).toEqual({
      uppercaseTitles: false,
      trustBadgesGrid: false,
      solidAddToCart: false,
    })
  })
})

describe('themeMainProps', () => {
  const look = { uppercaseTitles: true, trustBadgesGrid: true, solidAddToCart: false }
  const stored = (_type: string, values: Record<string, unknown> | undefined) => ({ ...values })

  it("carries the theme's collection settings into MainCollection", () => {
    const tpl = parseJsonTemplate(COLLECTION_JSON)
    if (!tpl) throw new Error('template')
    const main = tpl.sections.main
    if (!main) throw new Error('main')
    expect(
      themeMainProps('collection', tpl, main, stored, {
        look,
        settings: { show_breadcrumbs: false },
      }),
    ).toEqual({
      _themeSections: [
        { type: 'main-collection', key: 'main', settings: tpl.sections.main?.settings },
      ],
      columns: 3,
      showBreadcrumbs: false,
      uppercaseTitle: true,
    })
  })

  it("reads Dawn's banner and grid together", () => {
    const tpl = parseJsonTemplate(`{ "sections": {
      "banner": { "type": "main-collection-banner", "settings": { "show_collection_description": false, "show_collection_image": true } },
      "grid": { "type": "main-collection-product-grid", "settings": { "columns_desktop": 5, "columns_mobile": "1", "enable_filtering": false, "enable_sorting": true } }
    }, "order": ["banner", "grid"] }`)
    if (!tpl?.sections.banner) throw new Error('template')
    const props = themeMainProps('collection', tpl, tpl.sections.banner, stored, {
      look: { ...look, uppercaseTitles: false },
      settings: {},
    })
    expect(props).toMatchObject({
      columns: 5,
      columnsMobile: 1,
      showDescription: false,
      showImage: true,
      showFilters: false,
      showSort: true,
    })
    expect(props.uppercaseTitle).toBeUndefined()
    expect((props._themeSections as unknown[]).length).toBe(2)
  })

  it("gives MainProduct the theme's title case, button and trust badges layout", () => {
    const section = {
      type: 'main-product',
      block_order: ['title', 'buy'],
      blocks: {
        title: { type: 'title' },
        buy: { type: 'buy_buttons', settings: { show_dynamic_checkout: false } },
      },
    }
    const tpl = { sections: { main: section }, order: ['main'] }
    expect(themeMainProps('product', tpl, section, stored, { look, settings: {} })).toMatchObject({
      uppercaseTitle: true,
      addToCartStyle: 'solid',
      trustBadgesLayout: 'grid',
    })
    expect(themeMainProps('page', tpl, section, stored, { look, settings: {} })).toEqual({})
  })
})

describe('mainProductStylesheets', () => {
  it("reads the replaced section's stylesheets and skips files the theme does not hold", () => {
    const bundle = {
      sections: new Map([
        [
          'main-product',
          {
            source: `{{ 'section-product.css' | asset_url | stylesheet_tag }}
              {{ 'section-product.css' | asset_url | stylesheet_tag }}
              {{ 'missing.css' | asset_url | stylesheet_tag }}`,
            schema: null,
          },
        ],
      ]),
      assets: new Map([['section-product.css', 'abc']]),
    } as unknown as ThemeBundle
    expect(mainProductStylesheets(bundle)).toEqual(['section-product.css'])
    expect(mainProductStylesheets({ ...bundle, sections: new Map() })).toEqual([])
  })
})
