/** SOURCE OF TRUTH: app block tests — app blocks in classic (`when '@app'`) and theme-block sections keep their place: our widget's slot, the editor's placeholder, or nothing on the storefront */
import { describe, expect, it } from 'vitest'
import { fakeDataSource } from '../../test/theme-import-fixture'
import { appBlockName, appBlockSlot, isAppBlockType } from './app-block-slots'
import { buildThemeBundle } from './bundle'
import { LiquidSectionPlacementSchema } from './fields'
import { createPageContext, type LiquidBlockInput } from './page-context'
import { renderLiquidSection } from './render'

const schema = (value: unknown) => `{% schema %}${JSON.stringify(value)}{% endschema %}`
const KLAVIYO = 'shopify://apps/klaviyo-email-marketing-sms/blocks/back_in_stock/9f6c1a2e-0000'
const JUDGE_ME = 'shopify://apps/judge-me-reviews/blocks/review_widget/61ccd3b1'

/** Dawn's pattern: app blocks are `@app` and drawn with `{% render block %}`. */
const CLASSIC = `<div>{% for block in section.blocks %}{% case block.type %}{% when '@app' %}<i>{% render block %}</i>{% when 'text' %}<p {{ block.shopify_attributes }}>{{ block.settings.text }}</p>{% else %}[wrong]{% endcase %}{% endfor %}</div>${schema({ name: 'S', blocks: [{ type: '@app' }, { type: 'text', name: 'Text', settings: [{ type: 'text', id: 'text' }] }] })}`

/** Horizon's pattern: every block, app blocks included, through `content_for 'blocks'`. */
const THEME_BLOCKS = `<div>{% content_for 'blocks' %}</div>${schema({ name: 'S', blocks: [{ type: '@app' }, { type: '@theme' }] })}`

let themes = 0

async function render(
  source: string,
  blocks: LiquidBlockInput[],
  designMode: boolean,
  snippets: Record<string, string> = {},
) {
  const bundle = buildThemeBundle({
    themeId: `app-blocks-${themes++}`,
    version: 'v1',
    textFiles: new Map([['sections/s.liquid', source], ...Object.entries(snippets)]),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
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
  let failure: unknown = null
  const html = await renderLiquidSection(
    ctx,
    { id: 's', type: 's', settings: {}, blocks, location: 'template', index: 0 },
    (err) => {
      failure = err
    },
  )
  if (failure) throw failure
  return html
}

const blocks: LiquidBlockInput[] = [
  { id: 'app', type: KLAVIYO, settings: {} },
  { id: 't', type: 'text', settings: { text: 'Hello' } },
]

describe('app blocks', () => {
  it('reads `@app` in a classic section, so its `when` branch runs', async () => {
    const html = await render(CLASSIC, blocks, false)
    expect(html).not.toContain('[wrong]')
    expect(html).toContain('<i></i>')
    expect(html).toContain('Hello')
  })

  it('shows a named placeholder in the editor and nothing on the storefront', async () => {
    const editor = await render(CLASSIC, blocks, true)
    expect(editor).toContain(
      'data-commerce-app-block-missing="Klaviyo email marketing sms: Back in stock"',
    )
    expect(editor).toContain(
      'App block: Klaviyo email marketing sms: Back in stock (not available)',
    )
    expect(editor).toContain('data-block-id="app"')
    const shop = await render(CLASSIC, blocks, false)
    expect(shop).not.toContain('commerce-app-block')
  })

  it('draws the placeholder through content_for blocks too', async () => {
    const html = await render(THEME_BLOCKS, [{ id: 'app', type: KLAVIYO, settings: {} }], true)
    expect(html).toContain('commerce-app-block--missing')
  })

  it('keeps a quoted render tag working', async () => {
    const source = `{% render 'note' %}${schema({ name: 'S' })}`
    const html = await render(source, [], false, { 'snippets/note.liquid': '<b>ok</b>' })
    expect(html).toContain('<b>ok</b>')
  })

  it('accepts a long app block type from the canvas', () => {
    const long = `shopify://apps/${'a'.repeat(60)}/blocks/${'b'.repeat(40)}/9f6c1a2e-3d4b-4c5d-8e9f-0a1b2c3d4e5f`
    const parsed = LiquidSectionPlacementSchema.safeParse({
      id: 's',
      type: 's',
      settings: {},
      blocks: [{ id: 'a', type: long, settings: {} }],
      location: 'template',
      index: 0,
    })
    expect(parsed.success).toBe(true)
  })
})

describe('app block names and slots', () => {
  it('names an app block by app and block', () => {
    expect(appBlockName(KLAVIYO)).toBe('Klaviyo email marketing sms: Back in stock')
    expect(appBlockName('shopify://apps/inbox/blocks/inbox/1')).toBe('Inbox')
    expect(appBlockName('text')).toBe('')
    expect(isAppBlockType(KLAVIYO)).toBe(true)
    expect(isAppBlockType('@app')).toBe(false)
  })

  it('draws other reviews apps widgets with our Reviews app', () => {
    expect(appBlockSlot(JUDGE_ME)).toBe('reviews')
    expect(appBlockSlot('shopify://apps/loox/blocks/reviews/1')).toBe('reviews')
    expect(appBlockSlot('shopify://apps/loox/blocks/star_rating/1')).toBeNull()
    expect(appBlockSlot(KLAVIYO)).toBeNull()
  })
})
