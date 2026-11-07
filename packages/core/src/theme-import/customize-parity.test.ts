/** SOURCE OF TRUTH: Customize against the storefront — one saved imported section drawn down both routes must match, bar what the canvas removes on purpose */
import { describe, expect, it } from 'vitest'
import { FIXTURE_HERO, fakeDataSource } from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import { canvasSafeHtml } from './canvas'
import { type LiquidBlockItem, LiquidSectionPlacementSchema, liquidPlacement } from './fields'
import { createPageContext } from './page-context'
import { renderLiquidLayout, renderLiquidSection } from './render'

const schema = (value: unknown) => `{% schema %}${JSON.stringify(value)}{% endschema %}`
const blockSchema = schema({
  name: 'b',
  settings: [{ type: 'text', id: 'label', label: 'l', default: 'Default' }],
})

/** The things that have told the two routes apart: keep adding to this theme when one does. */
const THEME: Record<string, string> = {
  'layout/theme.liquid': `<!doctype html><html><head>
    {% style %}/* iOS < 16.4 */ .color-scheme-1 { --color-background: rgb(0 0 0); }{% endstyle %}
    <style>.plain { color: red; }</style>
    <script>window.theme = 1</script>
    </head><body>{{ content_for_layout }}</body></html>`,
  'sections/header.liquid': `<script>window.header = 1</script>
    <header-component class="header" onclick="go()">
      {% content_for 'block', type: '_logo', id: 'logo' %}
      {% content_for 'block', type: '_menu', id: 'menu' %}
      {% content_for 'blocks' %}
    </header-component>${schema({ name: 'h', blocks: [{ type: '@theme' }] })}`,
  'blocks/_logo.liquid': `<a {{ block.shopify_attributes }}>LOGO[{{ block.settings.label }}]</a>${blockSchema}`,
  'blocks/_menu.liquid': `<nav {{ block.shopify_attributes }}>MENU[{{ block.settings.label }}]</nav>${blockSchema}`,
  'blocks/group.liquid': `<div {{ block.shopify_attributes }}>{% content_for 'blocks' %}</div>${schema({ name: 'g', blocks: [{ type: '@theme' }] })}`,
  'blocks/text.liquid': `<p {{ block.shopify_attributes }}>TEXT[{{ block.settings.label }}]</p>${blockSchema}`,
  'sections/hero.liquid': FIXTURE_HERO,
}

const HEADER_BLOCKS: LiquidBlockItem[] = [
  { id: 'logo', type: '_logo', static: true, settings: { label: 'Claw' } },
  { id: 'menu', type: '_menu', static: true, disabled: true, settings: { label: 'Off' } },
  {
    id: 'group',
    type: 'group',
    settings: {},
    blocks: [
      { id: 'one', type: 'text', settings: { label: 'Nested' } },
      { id: 'two', type: 'text', disabled: true, settings: { label: 'Hidden' } },
    ],
  },
]

const SAVED = [
  {
    id: 'LiquidSection-header',
    sectionType: 'header',
    sectionKey: 'header',
    blocks: HEADER_BLOCKS,
  },
  { id: 'LiquidSection-hero', sectionType: 'hero', sectionKey: 'hero', blocks: [] },
]

function contextFor(designMode: boolean) {
  const bundle = buildThemeBundle({
    themeId: `parity-${designMode}`,
    version: 'v1',
    textFiles: new Map(Object.entries(THEME)),
    assetChecksums: new Map(),
    settings: {},
  })
  return createPageContext({
    bundle,
    data: fakeDataSource(),
    request: {
      template: 'index',
      path: '/',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode,
      postedForm: null,
      nonce: '',
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
}

/** What the storefront draws from a saved section. */
async function storefront(props: Record<string, unknown>) {
  const ctx = await contextFor(false)
  const type = String(props.sectionType)
  const schemaOf = ctx.bundle.sections.get(type)?.schema
  return renderLiquidSection(ctx, liquidPlacement(props, schemaOf, 'template', 0))
}

/** What Customize draws from it: to the API as JSON, past its input check, then the sanitiser. */
async function canvas(props: Record<string, unknown>) {
  const ctx = await contextFor(true)
  const type = String(props.sectionType)
  const schemaOf = ctx.bundle.sections.get(type)?.schema
  const sent = JSON.stringify(liquidPlacement(props, schemaOf, 'template', 0))
  const section = LiquidSectionPlacementSchema.parse(JSON.parse(sent))
  return canvasSafeHtml(await renderLiquidSection(ctx, section))
}

/** Every stylesheet in a head, without comments: nothing else a head holds changes the look. */
const stylesIn = (head: string) =>
  [...head.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) =>
    (m[1] ?? '').replace(/\/\*[\s\S]*?\*\//g, '').trim(),
  )

describe('Customize draws what the storefront draws', () => {
  it.each(SAVED)('$sectionKey matches, bar the scripts the canvas removes', async (props) => {
    expect(await canvas(props)).toBe(canvasSafeHtml(await storefront(props)))
  })

  it('leaves a static block the merchant turned off out of both', async () => {
    const [header] = SAVED
    if (!header) throw new Error('no header')
    expect(await storefront(header)).not.toContain('MENU[')
    expect(await canvas(header)).not.toContain('MENU[')
  })

  it('shows nested blocks in both', async () => {
    const [header] = SAVED
    if (!header) throw new Error('no header')
    expect(await canvas(header)).toContain('TEXT[Nested]')
  })

  it("keeps every stylesheet of the theme's head", async () => {
    const { head } = await renderLiquidLayout(await contextFor(false))
    const kept = stylesIn(canvasSafeHtml(head))
    expect(kept).toEqual(stylesIn(head))
    expect(kept.join()).toContain('.color-scheme-1')
  })
})
