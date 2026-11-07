import { describe, expect, it } from 'vitest'
import { FIXTURE_PRODUCT, fakeDataSource } from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import { videoNamesOf } from './import-media'
import { createPageContext, type LiquidBlockInput } from './page-context'
import { renderLiquidLayout, renderLiquidSection } from './render'
import { isMainSection } from './report'
import { dynamicSettings } from './settings-values'
import { themeCardTemplate } from './theme-cards'

let themes = 0

const schema = (value: unknown) => `{% schema %}${JSON.stringify(value)}{% endschema %}`

async function contextFor(files: Record<string, string>) {
  const bundle = buildThemeBundle({
    themeId: `static-${themes++}`,
    version: 'v1',
    textFiles: new Map(Object.entries(files)),
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
      designMode: false,
      postedForm: null,
      nonce: '',
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
}

async function render(
  files: Record<string, string>,
  blocks: LiquidBlockInput[],
  settings: Record<string, unknown> = {},
) {
  const ctx = await contextFor(files)
  let failure: unknown = null
  const html = await renderLiquidSection(
    ctx,
    { id: 's', type: 's', settings, blocks, location: 'template', index: 0 },
    (err) => {
      failure = err
    },
  )
  if (failure) throw failure
  return html
}

const MENU_SCHEMA = schema({
  name: 'm',
  settings: [{ type: 'text', id: 'label', label: 'l', default: 'Default' }],
})

describe('static theme blocks', () => {
  const files = {
    'sections/s.liquid': `{% content_for 'block', type: '_m', id: 'menu' %}${schema({ name: 's' })}`,
    'blocks/_m.liquid': `MENU[{{ block.settings.label }}]${MENU_SCHEMA}`,
  }

  it('shows nothing for a static block the merchant turned off', async () => {
    const html = await render(files, [
      { id: 'menu', type: '_m', settings: { label: 'Saved' }, static: true, disabled: true },
    ])
    expect(html).not.toContain('MENU')
  })

  it('runs a static block the template never saved on its defaults', async () => {
    expect(await render(files, [])).toContain('MENU[Default]')
  })

  it("leaves static blocks out of content_for 'blocks'", async () => {
    const html = await render(
      {
        'sections/s.liquid': `{% content_for 'blocks' %}${schema({ name: 's' })}`,
        'blocks/_m.liquid': `MENU[{{ block.id }}]${MENU_SCHEMA}`,
      },
      [
        { id: 'fixed', type: '_m', settings: {}, static: true },
        { id: 'free', type: '_m', settings: {} },
      ],
    )
    expect(html).toContain('MENU[free]')
    expect(html).not.toContain('MENU[fixed]')
  })

  it('passes content_for arguments to the block', async () => {
    const html = await render(
      {
        'sections/s.liquid': `{% content_for 'block', type: '_m', id: 'menu', variant: 'mobile' %}${schema({ name: 's' })}`,
        'blocks/_m.liquid': `{% case variant %}{% when 'mobile' %}MOBILE{% else %}DESKTOP{% endcase %}${MENU_SCHEMA}`,
      },
      [{ id: 'menu', type: '_m', settings: {}, static: true }],
    )
    expect(html).toContain('MOBILE')
  })
})

describe('closest', () => {
  const card = {
    'sections/s.liquid': `{% assign p = all_products['mouse'] %}{% content_for 'block', type: '_card', id: 'card', closest.product: p %}${schema({ name: 's' })}`,
    'blocks/_card.liquid': `{% content_for 'blocks' %}${schema({ name: 'c', blocks: [{ type: '@theme' }] })}`,
    'blocks/title.liquid': `TITLE[{{ block.settings.text }}]${schema({
      name: 't',
      settings: [{ type: 'text', id: 'text', label: 't' }],
    })}`,
    'blocks/gallery.liquid': `{% render 'pic' %}${schema({ name: 'g' })}`,
    'snippets/pic.liquid': `PIC[{{ closest.product.handle }}|{{ block.id }}]`,
    'blocks/linked.liquid': `LINKED[{{ block.settings.product.handle }}]${schema({
      name: 'l',
      settings: [{ type: 'product', id: 'product', label: 'p' }],
    })}`,
  }
  const nested = (type: string, settings: Record<string, unknown> = {}): LiquidBlockInput[] => [
    {
      id: 'card',
      type: '_card',
      settings: {},
      static: true,
      blocks: [{ id: 'inner', type, settings }],
    },
  ]

  it('fills a dynamic source inside text', async () => {
    const html = await render(
      card,
      nested('title', { text: '<h3>{{ closest.product.title }}</h3>' }),
    )
    expect(html).toContain(`TITLE[<h3>${FIXTURE_PRODUCT.title}</h3>]`)
  })

  it('fills a setting connected to the product itself', async () => {
    const html = await render(card, nested('linked', { product: '{{ closest.product }}' }))
    expect(html).toContain(`LINKED[${FIXTURE_PRODUCT.handle}]`)
  })

  it("reaches a block's snippets, with the block", async () => {
    expect(await render(card, nested('gallery'))).toContain(`PIC[${FIXTURE_PRODUCT.handle}|inner]`)
  })

  it('leaves text that only looks like a source alone', async () => {
    const html = await render(card, nested('title', { text: 'Use {{ code }} today' }))
    expect(html).toContain('TITLE[Use {{ code }} today]')
  })
})

describe('dynamic sources in section settings', () => {
  it('reads the page resource through closest', async () => {
    const ctx = await contextFor({})
    const product = { handle: 'mouse' }
    const settings = dynamicSettings(
      { product: '{{ closest.product }}', title: 'Plain' },
      ctx.entry.engine,
      {
        closest: { product },
      },
    )
    expect(settings).toEqual({ product, title: 'Plain' })
  })
})

describe('per-customer tracking', () => {
  it('does not mark a page as per-customer for rendering a block', async () => {
    const ctx = await contextFor({
      'sections/s.liquid': `{% content_for 'block', type: '_m', id: 'menu' %}${schema({ name: 's' })}`,
      'blocks/_m.liquid': `MENU${MENU_SCHEMA}`,
    })
    let read = 0
    ctx.runtime.onCustomer = () => {
      read += 1
    }
    await renderLiquidSection(ctx, {
      id: 's',
      type: 's',
      settings: {},
      blocks: [],
      location: 'template',
      index: 0,
    })
    expect(read).toBe(0)
  })
})

describe('main sections', () => {
  it("counts Horizon's product section", () => {
    expect(isMainSection('product-information')).toBe(true)
    expect(isMainSection('product-list')).toBe(false)
  })
})

describe('theme product cards', () => {
  it('skips a card snippet that only wraps blocks', () => {
    const bundle = buildThemeBundle({
      themeId: `static-${themes++}`,
      version: 'v1',
      textFiles: new Map([['snippets/product-card.liquid', '<div>{{ children }}</div>']]),
      assetChecksums: new Map(),
      settings: {},
    })
    expect(themeCardTemplate(bundle)).toBeNull()
  })
})

describe('list filters', () => {
  const probe = (source: string) =>
    render({ 'sections/s.liquid': `${source}${schema({ name: 's' })}` }, [])

  it('treats one object as a list of one in concat', async () => {
    const html = await probe(
      `{% assign p = all_products['mouse'] %}{% assign l = p.featured_media | concat: p.media %}{% for m in l %}[{{ m.src }}]{% endfor %}`,
    )
    expect(html).toContain(`[${FIXTURE_PRODUCT.images[0]?.url}]`)
    expect(html).not.toContain('[]')
  })

  it("rejects by an object's own value", async () => {
    const html = await probe(
      `{% assign p = all_products['mouse'] %}{% assign l = p.media | reject: 'src', p.featured_media %}[{{ l.size }}]`,
    )
    expect(html).toContain('[0]')
  })
})

describe('the header wrapper', () => {
  const layout = (open: string, close: string) => ({
    'layout/theme.liquid': `<html><head></head><body><a href="#m">Skip</a>${open}{% sections 'header-group' %}${close}<main id="m">{{ content_for_layout }}</main>{% sections 'footer-group' %}</body></html>`,
  })

  it('takes the wrapper out of the markup before the header', async () => {
    const parts = await renderLiquidLayout(
      await contextFor(layout('<div id="header-group">\n', '\n</div>')),
    )
    expect(parts.headerWrapper).toEqual({ tag: 'div', attrs: { id: 'header-group' } })
    expect(parts.beforeHeader).toContain('Skip')
    expect(parts.beforeHeader).not.toContain('header-group')
  })

  it('has none when the group stands alone', async () => {
    const parts = await renderLiquidLayout(await contextFor(layout('', '')))
    expect(parts.headerWrapper).toBeNull()
  })

  it('leaves an element that is not closed right after the group', async () => {
    const parts = await renderLiquidLayout(await contextFor(layout('<div>', '<p>x</p></div>')))
    expect(parts.headerWrapper).toBeNull()
  })
})

describe('videos a section shows', () => {
  it('skips a video left behind a slide set to an image', () => {
    const names = videoNamesOf({
      type: 'hero',
      settings: {
        media_type_1: 'image',
        video_1: 'shopify://files/videos/old.mp4',
        media_type_2: 'video',
        video_2: 'shopify://files/videos/teaser claw - Trim.mp4',
      },
    })
    expect(names).toEqual(['teaser claw - Trim.mp4'])
  })
})
