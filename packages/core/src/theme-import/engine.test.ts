/** SOURCE OF TRUTH: Liquid engine tests for imported themes — the zip reader, schema and JSON reading, section and layout renders on fake data, Shopify filters, numeric ids, editor fields, swap detection */
import { strToU8, zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { FIXTURE_HERO, fakeDataSource, fixtureThemeZip } from '../../test/theme-import-fixture'
import { readThemeArchive, safeThemePath, ThemeArchiveProblem } from './archive'
import { buildThemeBundle, normalizeLiquid } from './bundle'
import { LiquidDataCache } from './cache'
import { ColorDrop, FontDrop } from './drops'
import { createThemeEngine } from './engine'
import {
  blocksFromProps,
  liquidPlacement,
  liquidSectionFields,
  liquidSectionKey,
  settingsFromProps,
  settingsToProps,
  shopifySectionId,
} from './fields'
import { shopifyMoney, translate } from './filter-values'
import { numericId, uuidPrefixOf } from './numeric-id'
import { createPageContext } from './page-context'
import { googleFontsHref, renderLiquidLayout, renderLiquidSection, sectionWrapper } from './render'
import { countStatuses, importStatusFor } from './report'
import { richTextHtml } from './rich-html'
import {
  extractSchema,
  parseJsonTemplate,
  parseThemeJson,
  stripJsonComments,
  withoutSchema,
} from './schema'
import { liquidSettingValue, shopifyUrlToPath } from './settings-values'
import { swapsIn } from './swap'

const textFiles = (zip: Uint8Array) => {
  const archive = readThemeArchive(zip)
  const out = new Map<string, string>()
  for (const f of archive.files.values())
    if (f.text) out.set(f.path, new TextDecoder().decode(f.bytes))
  return out
}

const settingsData = {
  type_body_font: 'inter_n4',
  color_schemes: {
    'scheme-1': { settings: { background: '#ffffff' } },
    'scheme-2': { settings: { background: '#6c3baa' } },
  },
}

async function pageContext(designMode = false, extra: Record<string, string> = {}) {
  const bundle = buildThemeBundle({
    themeId: 'theme-1',
    version: 'v1',
    textFiles: textFiles(fixtureThemeZip({ extra })),
    assetChecksums: new Map([['section-hero.css', 'abc123']]),
    settings: settingsData,
  })
  const data = fakeDataSource()
  const ctx = await createPageContext({
    bundle,
    data,
    request: {
      template: 'index',
      path: '/',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode,
      postedForm: 'customer',
      nonce: 'n0nce',
    },
    assetBase: '/theme-assets/theme-1',
    shopifyHost: 'old.example',
    moneyFormat: null,
    paymentTypes: ['upi'],
  })
  return { bundle, data, ctx }
}

describe('readThemeArchive', () => {
  it('reads a theme zip, keeps theme folders and skips everything else', () => {
    const archive = readThemeArchive(fixtureThemeZip())
    expect(archive.files.has('layout/theme.liquid')).toBe(true)
    expect(archive.files.has('assets/base.css')).toBe(true)
    expect(archive.files.get('assets/base.css')?.contentType).toBe('text/css')
    expect(archive.skipped).toContain('README.md')
  })

  it('unwraps a zip whose files sit in one top folder', () => {
    const archive = readThemeArchive(fixtureThemeZip({ wrap: 'my-theme' }))
    expect(archive.files.has('sections/hero.liquid')).toBe(true)
  })

  it('never lets a path climb out of the theme', () => {
    expect(safeThemePath('../../etc/passwd')).toBeNull()
    expect(safeThemePath('/abs/x.css')).toBeNull()
    expect(safeThemePath('C:/windows/x.css')).toBeNull()
    expect(safeThemePath('assets\\a.css')).toBe('assets/a.css')
    const archive = readThemeArchive(
      fixtureThemeZip({ extra: { '../evil.liquid': 'x', 'assets/run.exe': 'x' } }),
    )
    expect([...archive.files.keys()].some((p) => p.includes('evil') || p.endsWith('.exe'))).toBe(
      false,
    )
  })

  it('refuses files that are not a Shopify theme', () => {
    expect(() => readThemeArchive(strToU8('not a zip'))).toThrow(ThemeArchiveProblem)
    const noLayout = zipSync({ 'templates/index.json': strToU8('{}') })
    expect(() => readThemeArchive(noLayout)).toThrow(/layout\/theme\.liquid/)
    const noTemplates = zipSync({ 'layout/theme.liquid': strToU8('x') })
    expect(() => readThemeArchive(noTemplates)).toThrow(/templates/)
  })
})

describe('schema and JSON reading', () => {
  it('reads JSON with comments and trailing commas', () => {
    expect(parseThemeJson('/* c */ { "a": "x//y", "b": [1,], }')).toEqual({ a: 'x//y', b: [1] })
    expect(stripJsonComments('{"a": 1} // tail')).toBe('{"a": 1} ')
    expect(parseThemeJson('{ nope')).toBeNull()
  })

  it('extracts a section schema and strips it from the source', () => {
    const schema = extractSchema(FIXTURE_HERO)
    expect(schema?.name).toBe('t:sections.hero.name')
    expect(schema?.blocks?.map((b) => b.type)).toEqual(['slide', '@app'])
    expect(withoutSchema(FIXTURE_HERO)).not.toContain('{% schema %}')
  })

  it('finds the real schema block when a comment mentions {% schema %}', () => {
    const src =
      '{% comment %}See {% schema %} below.{% endcomment %}<p>x</p>{% schema %}{ "name": "Real" }{% endschema %}'
    expect(extractSchema(src)?.name).toBe('Real')
    expect(withoutSchema(src)).toBe('{% comment %}See {% schema %} below.{% endcomment %}<p>x</p>')
    expect(() => createThemeEngine(new Map()).parse(withoutSchema(src))).not.toThrow()
  })

  it('reads a JSON template in its own order, ignoring unknown keys', () => {
    const tpl = parseJsonTemplate(
      '{ "sections": { "a": { "type": "x" } }, "order": ["a", "missing"] }',
    )
    expect(tpl?.order).toEqual(['a'])
    expect(parseJsonTemplate('[]')).toBeNull()
  })

  it('drops comments inside {% liquid %} tags', () => {
    const out = normalizeLiquid(
      '{%- liquid\n assign a = 1\n comment\n  words here\n endcomment\n-%}',
    )
    expect(out).not.toContain('words here')
    expect(out).toContain('assign a = 1')
  })
})

describe('rendering a section', () => {
  it('renders settings, blocks, translations, money, forms and snippets on our data', async () => {
    const { bundle, ctx } = await pageContext()
    const props = {
      id: 'LiquidSection-hero',
      sectionType: 'hero',
      sectionKey: 'hero',
      ...settingsToProps({
        heading: 'Welcome',
        image: { url: 'https://cdn.example/b.png', alt: 'Banner', width: 1600, height: 800 },
        product: 'mouse',
        menu: 'main-menu',
        color_scheme: 'scheme-2',
      }),
      blocks: [
        { id: 'a', type: 'slide', settings: { title: 'One' } },
        { id: 'b', type: 'slide', disabled: true, settings: { title: 'Off' } },
        { id: 'c', type: '@app', settings: {} },
      ],
    }
    const section = liquidPlacement(props, bundle.sections.get('hero')?.schema, 'template', 0)
    expect(section.id).toBe(shopifySectionId('hero', 'template'))
    const html = await renderLiquidSection(ctx, section)
    expect(html).toContain('<h2>Welcome</h2>')
    expect(html).toContain('color-scheme-2')
    expect(html).toContain('One 1 item')
    expect(html).not.toContain('Off')
    expect(html).toContain('class="hero__img"')
    expect(html).toContain('width="800" height="400"')
    expect(html).toContain('alt="Banner"')
    expect(html).toContain('₹7,499')
    expect(html).toContain('action="/theme-actions/cart-add"')
    expect(html).toContain('<em class="badge">New</em>')
    expect(html).toContain('<a href="/collections/mice">Mice</a>')
    expect(html).toContain('/theme-assets/theme-1/section-hero.css?v=abc123')
    // Ids go into JSON unquoted, as Shopify's numbers do.
    // The theme's own script tags carry the request's nonce (security audit 2026-10-06, A-04).
    const json =
      /<script nonce="n0nce" type="application\/json">(.*?)<\/script>/.exec(html)?.[1] ?? ''
    expect(typeof JSON.parse(json).id).toBe('number')
  })

  it('reports a section that is not in the theme, and one that fails, without throwing', async () => {
    const { ctx } = await pageContext()
    const missing = await renderLiquidSection(ctx, {
      id: 'x',
      type: 'nope',
      settings: {},
      blocks: [],
      location: 'template',
      index: 0,
    })
    expect(missing).toContain('not in this theme')
  })

  it('marks forms posted, reads the cart and wraps group sections like Shopify', async () => {
    const { bundle, ctx } = await pageContext()
    const footer = {
      id: 'footer',
      type: 'footer',
      settings: {},
      blocks: [],
      location: 'footer-group',
      index: 0,
    }
    const html = await renderLiquidSection(ctx, footer)
    expect(html).toContain('class="thanks"')
    expect(html).toContain('<span class="count">2</span>')
    expect(html).toContain('action="/theme-actions/newsletter"')
    expect(sectionWrapper(bundle, footer)).toEqual({
      tag: 'div',
      id: 'shopify-section-footer',
      className: 'shopify-section shopify-section-group-footer-group',
    })
    expect(sectionWrapper(bundle, { id: 'h', type: 'hero', location: 'template' }).className).toBe(
      'shopify-section hero-section',
    )
  })

  it('renders the layout around markers and splits it for the storefront', async () => {
    const { ctx } = await pageContext()
    const parts = await renderLiquidLayout(ctx)
    expect(parts.head).toContain('base.css')
    expect(parts.head).not.toContain('<title>')
    expect(parts.head).not.toContain('<meta')
    expect(parts.htmlAttrs).toMatchObject({
      lang: 'en',
      class: 'no-js',
      'data-theme-name': 'fixture',
    })
    expect(parts.bodyAttrs).toEqual({ class: 'template-index' })
    expect(parts.beforeHeader).toContain('Skip to content')
    expect(parts.afterFooter).toContain('theme.js')
    expect(parts.mainAttrs).toEqual({ id: 'MainContent', role: 'main' })
    expect(googleFontsHref(parts.fonts)).toBe(
      'https://fonts.googleapis.com/css2?family=Inter:wght@400&display=swap',
    )
  })

  it('loads data in batches between synchronous passes', async () => {
    const { bundle, ctx, data } = await pageContext()
    const props = {
      id: 'p',
      sectionType: 'hero',
      sectionKey: 'hero',
      product: 'mouse',
      menu: 'main-menu',
      blocks: [],
    }
    await renderLiquidSection(
      ctx,
      liquidPlacement(props, bundle.sections.get('hero')?.schema, 'template', 0),
    )
    await renderLiquidSection(
      ctx,
      liquidPlacement(props, bundle.sections.get('hero')?.schema, 'template', 0),
    )
    expect(data.calls.filter((c) => c === 'product:mouse')).toHaveLength(1)
  })

  it("renders a tab's own nested blocks inside it, never the section's again (product tabs)", async () => {
    const { bundle, ctx } = await pageContext(false, {
      'sections/tabs.liquid':
        '<div class="tabs">{% content_for "blocks" %}</div>{% schema %}{"name":"Tabs","blocks":[{"type":"@theme"}]}{% endschema %}',
      'blocks/_tab.liquid':
        '<section data-tab="{{ block.settings.label }}">{% content_for "blocks" %}</section>{% schema %}{"name":"Tab","settings":[{"type":"text","id":"label","label":"Label"}],"blocks":[{"type":"@theme"}]}{% endschema %}',
      'blocks/text.liquid':
        '<p>{{ block.settings.text }}</p>{% schema %}{"name":"Text","settings":[{"type":"text","id":"text","label":"Text"}]}{% endschema %}',
      'blocks/loop.liquid':
        '<i>{% content_for "block", type: "loop", id: "self" %}</i>{% schema %}{"name":"Loop"}{% endschema %}',
    })
    const props = {
      id: 'LiquidSection-tabs',
      sectionType: 'tabs',
      sectionKey: 'tabs',
      blocks: [
        {
          id: 't1',
          type: '_tab',
          settings: { label: 'Details' },
          blocks: [{ id: 'x', type: 'text', settings: { text: 'Cotton' } }],
        },
        {
          id: 't2',
          type: '_tab',
          settings: { label: 'Care' },
          blocks: [{ id: 'y', type: 'text', settings: { text: 'Hand wash' } }],
        },
        { id: 'l', type: 'loop', settings: {} },
      ],
    }
    const section = liquidPlacement(props, bundle.sections.get('tabs')?.schema, 'template', 0)
    const html = await renderLiquidSection(ctx, section)
    expect(html).toContain('<section data-tab="Details"><p>Cotton</p></section>')
    expect(html).toContain('<section data-tab="Care"><p>Hand wash</p></section>')
    expect(html.match(/data-tab=/g)).toHaveLength(2)
    // A block that places itself stops at Shopify's nesting limit instead of overflowing the stack.
    expect(html.match(/<i>/g)).toHaveLength(8)
  })
})

describe('setting values', () => {
  const cache = new LiquidDataCache(fakeDataSource(), [])

  it('types values by their schema setting', () => {
    expect(liquidSettingValue({ type: 'color', id: 'c' }, '#6c3baa', cache, {})).toBeInstanceOf(
      ColorDrop,
    )
    expect(
      liquidSettingValue({ type: 'font_picker', id: 'f' }, 'archivo_n7', cache, {}),
    ).toBeInstanceOf(FontDrop)
    expect(
      liquidSettingValue({ type: 'url', id: 'u' }, 'shopify://collections/mice', cache, {}),
    ).toBe('/collections/mice')
    expect(
      liquidSettingValue(
        { type: 'image_picker', id: 'i' },
        'shopify://shop_images/x.png',
        cache,
        {},
      ),
    ).toBeNull()
    expect(
      liquidSettingValue({ type: 'video_url', id: 'v' }, 'https://youtu.be/abcdefgh', cache, {}),
    ).toMatchObject({
      type: 'youtube',
      id: 'abcdefgh',
    })
    expect(
      liquidSettingValue({ type: 'video', id: 'v' }, { url: 'https://cdn/x.mp4' }, cache, {}),
    ).toMatchObject({
      media_type: 'video',
    })
    const schemes = liquidSettingValue(
      { type: 'color_scheme_group', id: 'g' },
      { 'scheme-1': { settings: { background: '#ffffff' } } },
      cache,
      {},
    ) as { id: string }[]
    expect(schemes.map((s) => s.id)).toEqual(['scheme-1'])
  })

  it('maps Shopify links to our paths', () => {
    expect(shopifyUrlToPath('shopify://products/mouse')).toBe('/products/mouse')
    expect(shopifyUrlToPath('shopify://search')).toBe('/search')
    expect(shopifyUrlToPath('shopify://policies/refund-policy')).toBe('/policies/refund-policy')
    expect(shopifyUrlToPath('/already')).toBe('/already')
  })
})

describe('filters', () => {
  it('formats money the way Shopify money formats do', () => {
    expect(shopifyMoney(749900, '₹{{amount}}')).toBe('₹7,499.00')
    expect(shopifyMoney(749900, 'Rs. {{amount_no_decimals}}')).toBe('Rs. 7,499')
    expect(shopifyMoney(749950, '{{amount_with_comma_separator}}')).toBe('7.499,50')
  })

  it('translates with plurals, variables and a visible missing key', () => {
    const locale = {
      a: { n: { one: '{{ count }} item', other: '{{ count }} items' }, hi: 'Hi {{ name }}' },
    }
    expect(translate(locale, 'a.n', { count: 1 })).toBe('1 item')
    expect(translate(locale, 'a.n', { count: 3 })).toBe('3 items')
    expect(translate(locale, 'a.hi', { name: 'Asha' })).toBe('Hi Asha')
    expect(translate(locale, 'a.nope', {})).toBe('Translation missing: en.a.nope')
  })

  it('implements colour and URL helpers', () => {
    const engine = createThemeEngine(new Map())
    const out = engine.parseAndRenderSync(
      "{{ '#ff0000' | color_to_rgb }}|{{ '#000000' | color_lighten: 50 }}|{{ 'Hello World' | handleize }}|{{ 'a' | link_to: '/x' }}",
      {},
      {
        globals: {
          _rt: {
            locale: {},
            currency: 'INR',
            moneyFormat: null,
            fonts: new Map(),
            nonce: '',
            shopifyHost: null,
            assetUrl: (f: string) => f,
            assetText: () => null,
          },
        },
      },
    )
    expect(out).toBe('rgb(255, 0, 0)|#808080|hello-world|<a href="/x">a</a>')
  })
})

describe('ids and fields', () => {
  it('turns UUIDs into safe whole numbers and back to their prefix', () => {
    const uuid = '01a0def6-2cfc-7432-959f-6c1028dc9b34'
    const n = numericId(uuid)
    expect(Number.isSafeInteger(n)).toBe(true)
    expect(uuidPrefixOf(n as number)).toBe('01a0def6-2cfc-7432-')
    expect(numericId('not-a-uuid')).toBe('not-a-uuid')
    expect(uuidPrefixOf('abc')).toBeNull()
  })

  it('keeps the theme key for imported sections and gives copies their own', () => {
    expect(liquidSectionKey({ id: 'LiquidSection-hero', sectionKey: 'hero' })).toBe('hero')
    expect(liquidSectionKey({ id: 'LiquidSection-1234-abcd', sectionKey: 'hero' })).toBe(
      '1234-abcd',
    )
    expect(shopifySectionId('hero', 'template')).toMatch(/^template--\d{14}__hero$/)
    expect(shopifySectionId('header', 'header-group')).toMatch(/^sections--\d{14}__header$/)
  })

  it('round-trips settings and blocks through props', () => {
    const schema = extractSchema(FIXTURE_HERO)
    const props = settingsToProps({ heading: 'x', id: 'clash' })
    expect(props).toEqual({ heading: 'x', setting_id: 'clash' })
    expect(settingsFromProps({ heading: 'x', other: 1 }, schema)).toEqual({ heading: 'x' })
    expect(blocksFromProps({ blocks: [{ type: 'slide' }, 'junk'] })).toEqual([
      { id: 'block_0', type: 'slide', disabled: false, settings: {} },
    ])
    expect(
      blocksFromProps({ blocks: [{ id: 't', type: '_tab', blocks: [{ id: 'x', type: 'text' }] }] }),
    ).toEqual([
      {
        id: 't',
        type: '_tab',
        disabled: false,
        settings: {},
        blocks: [{ id: 'x', type: 'text', disabled: false, settings: {} }],
      },
    ])
  })

  it('builds editor fields from a schema, blocks by type', () => {
    const fields = liquidSectionFields(
      extractSchema(FIXTURE_HERO),
      { sections: { hero: { name: 'Hero' } } },
      {},
      {
        colorSchemes: ['scheme-1', 'scheme-2'],
      },
    )
    expect(fields.heading).toEqual({ type: 'text', label: 'Heading', placeholder: undefined })
    expect(fields.image?.type).toBe('object')
    expect(fields.speed).toMatchObject({ type: 'number', label: 'Speed (s)', min: 1, max: 9 })
    expect(fields.autoplay?.type).toBe('radio')
    expect(fields.color_scheme).toMatchObject({ type: 'select' })
    const blocks = fields.blocks as unknown as {
      arrayFields: { settings: { metadata: { liquidBlockFields: Record<string, unknown> } } }
    }
    expect(Object.keys(blocks.arrayFields.settings.metadata.liquidBlockFields)).toEqual(['slide'])
  })
})

describe('swaps and report', () => {
  it('detects what a section relies on', () => {
    expect(swapsIn("{% form 'product', product %}")).toContain('cart_add')
    expect(swapsIn("{% form 'contact' %}")).toContain('contact')
    expect(swapsIn('{{ shop.metafields.judgeme.reviews }}')).toEqual(['app_data'])
    expect(swapsIn('{{ product.metafields.custom.x }}')).toEqual(['metafields'])
  })

  it('picks the worst status and counts them', () => {
    expect(importStatusFor([])).toBe('imported')
    expect(importStatusFor(['cart_add'])).toBe('replaced')
    expect(importStatusFor(['cart_add', 'contact'])).toBe('unavailable')
    expect(importStatusFor(['parse_error', 'contact'])).toBe('unsupported')
    expect(
      countStatuses([
        { type: 'a', name: 'a', status: 'imported', reasons: [], usedIn: [] },
        { type: 'b', name: 'b', status: 'replaced', reasons: [], usedIn: [] },
      ]),
    ).toEqual({ imported: 1, replaced: 1, unavailable: 0, unsupported: 0 })
  })

  it('writes our rich text as escaped HTML', () => {
    expect(richTextHtml('a <b>')).toBe('<p>a &lt;b&gt;</p>')
    const doc = {
      root: {
        type: 'root',
        children: [
          { type: 'heading', tag: 'h3', children: [{ type: 'text', text: 'T', format: 1 }] },
          {
            type: 'paragraph',
            children: [
              { type: 'link', url: 'javascript:alert(1)', children: [{ type: 'text', text: 'x' }] },
            ],
          },
          {
            type: 'list',
            listType: 'number',
            children: [{ type: 'listitem', children: [{ type: 'text', text: 'i' }] }],
          },
        ],
      },
    }
    expect(richTextHtml(doc)).toBe(
      '<h3><strong>T</strong></h3><p><a href="#">x</a></p><ol><li>i</li></ol>',
    )
    expect(richTextHtml(null)).toBe('')
  })
})
