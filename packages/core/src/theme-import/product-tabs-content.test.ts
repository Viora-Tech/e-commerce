/** SOURCE OF TRUTH: tests for what fills an imported theme's product tabs and "You may also like" row — `assign x = blank` read as Shopify does (the add-ons row resets its list with it), app blocks one of our apps draws (Judge.me's review widget → a Reviews slot), and related products read past sold-out close matches. Real engine, fake data, no database */
import { describe, expect, it } from 'vitest'
import { FIXTURE_PRODUCT, fakeDataSource } from '../../test/theme-import-fixture'
import { appBlockSlot } from './app-block-slots'
import { buildThemeBundle } from './bundle'
import type { LiquidBlockInput } from './page-context'
import { createPageContext } from './page-context'
import { firstAvailable } from './related'
import { renderLiquidSection } from './render'

const JUDGE_ME =
  'shopify://apps/judge-me-reviews/blocks/review_widget/61ccd3b1-a9f2-4160-9fe9-4fec8413e5d8'

/** A tab that, like Zero Drift's `_tab`, only shows when its children print some text. */
const TAB = `{%- capture children -%}{%- content_for 'blocks' -%}{%- endcapture -%}
{%- assign probe = children | strip_html | strip -%}
{%- if probe != blank -%}<div data-tab="{{ block.settings.label }}">{{ children }}</div>{%- endif -%}
{% schema %}{"name":"Tab","settings":[{"type":"text","id":"label","label":"Label"}],"blocks":[{"type":"@theme"},{"type":"@app"}]}{% endschema %}`

const TABS = `<div class="tabs">{% content_for 'blocks' %}</div>{% schema %}{"name":"Tabs","blocks":[{"type":"@theme"}]}{% endschema %}`

let themes = 0

async function render(
  source: string,
  options: { blocks?: LiquidBlockInput[]; judgeme?: Record<string, unknown> | null } = {},
) {
  const bundle = buildThemeBundle({
    themeId: `product-tabs-${themes++}`,
    version: 'v1',
    textFiles: new Map([
      ['sections/probe.liquid', source],
      ['blocks/_tab.liquid', TAB],
    ]),
    assetChecksums: new Map(),
    settings: {},
  })
  const judgeme = options.judgeme ?? null
  const ctx = await createPageContext({
    bundle,
    data: { ...fakeDataSource(), judgeme: async () => judgeme },
    request: {
      template: 'product',
      path: '/products/mouse',
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
  let failure: unknown = null
  const html = await renderLiquidSection(
    ctx,
    {
      id: 'template--1__probe',
      type: 'probe',
      settings: {},
      blocks: options.blocks ?? [],
      location: 'template',
      index: 0,
    },
    (err) => {
      failure = err
    },
  )
  if (failure) throw failure
  return html.trim()
}

describe('assign with blank and empty', () => {
  it('stores the empty string, as Shopify does, so it equals blank and has size 0', async () => {
    const html = await render(
      '{%- assign a = blank -%}{%- assign b = empty -%}[{{ a == blank }}|{{ a == empty }}|{{ a.size }}|{{ b == blank }}|{{ b.size }}|{{ a }}]',
    )
    expect(html).toBe('[true|true|0|true|0|]')
  })

  it('keeps the add-ons fallback: a list reset to blank falls through to the picks', async () => {
    // Zero Drift's product-add-ons: no per-product list, so the row is built from handles.
    const html = await render(`{%- liquid
      assign items = product.metafields.custom.accessories.value
      if items == blank or items.size == 0
        assign items = blank
      endif
      assign chosen = ''
      if items == blank
        assign chosen = 'skates,tape,'
      endif
      assign handles = chosen | split: ','
    -%}{%- if items.size > 0 -%}LIST{%- elsif handles.size > 0 -%}{{ handles | join: '+' }}{%- endif -%}`)
    expect(html).toBe('skates+tape')
  })
})

describe('app blocks in a product tab', () => {
  const reviewsTab: LiquidBlockInput[] = [
    {
      id: 'tab_reviews',
      type: '_tab',
      settings: { label: 'Ratings & reviews' },
      blocks: [{ id: 'jm', type: JUDGE_ME, settings: { review_data: 'sample_data' } }],
    },
  ]

  it("draws Judge.me's review widget as a slot for our Reviews app, so the tab shows", async () => {
    const html = await render(TABS, { blocks: reviewsTab, judgeme: { all_reviews_count: 1 } })
    expect(html).toContain('<div data-tab="Ratings & reviews">')
    expect(html).toContain('data-commerce-app-block="reviews" data-block-id="jm"')
    expect(html).toContain('Customer reviews')
  })

  it('prints nothing without the Reviews app, so the empty tab stays hidden', async () => {
    const html = await render(TABS, { blocks: reviewsTab, judgeme: null })
    expect(html).toBe('<div class="tabs"></div>')
  })

  it('prints nothing for an app block we have no widget for', async () => {
    const html = await render(TABS, {
      judgeme: { all_reviews_count: 1 },
      blocks: [
        {
          id: 't',
          type: '_tab',
          settings: { label: 'Chat' },
          blocks: [{ id: 'c', type: 'shopify://apps/some-chat/blocks/widget/1', settings: {} }],
        },
      ],
    })
    expect(html).toBe('<div class="tabs"></div>')
  })

  it("names only Judge.me's review widget", () => {
    expect(appBlockSlot(JUDGE_ME)).toBe('reviews')
    expect(appBlockSlot('shopify://apps/judge-me-reviews/blocks/preview_badge/1')).toBeNull()
    expect(appBlockSlot('_tab')).toBeNull()
  })

  it("names Judge.me's cards carousel", () => {
    expect(appBlockSlot('shopify://apps/judge-me-reviews/blocks/cards_carousel/1')).toBe(
      'reviews-carousel',
    )
  })
})

describe('firstAvailable', () => {
  const product = (id: string, available: boolean) => ({
    ...FIXTURE_PRODUCT,
    id,
    variants: FIXTURE_PRODUCT.variants.map((v) => ({ ...v, available })),
  })

  it('reads past a run of sold-out close matches, in rank order', async () => {
    // Twelve sold-out siblings (same brand and kind) rank first; the in-stock ones come later.
    const ids = Array.from({ length: 16 }, (_, i) => `p${i}`)
    const stock = new Set(['p12', 'p14', 'p15'])
    const loads: string[][] = []
    const found = await firstAvailable(ids, 2, async (chunk) => {
      loads.push(chunk)
      return chunk.map((id) => product(id, stock.has(id)))
    })
    expect(found.map((p) => p.id)).toEqual(['p12', 'p14'])
    expect(loads.map((c) => c.length)).toEqual([6, 6, 4])
  })

  it('stops loading once it has enough', async () => {
    let calls = 0
    const found = await firstAvailable(['a', 'b', 'c', 'd', 'e', 'f', 'g'], 1, async (chunk) => {
      calls++
      return chunk.map((id) => product(id, true))
    })
    expect(found.map((p) => p.id)).toEqual(['a'])
    expect(calls).toBe(1)
  })
})
