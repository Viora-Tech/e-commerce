/** SOURCE OF TRUTH: custom data drop tests — metafields of every field type (values, `.type`, printing, references, lists), metaobjects by type and handle, key mapping, batching, blank owners and `link.object`, rendered through the real engine on fake data. No database */
import { describe, expect, it } from 'vitest'
import {
  type FakeStoreData,
  FIXTURE_PRODUCT,
  fakeDataSource,
} from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import type { LiquidFieldData, LiquidMetafieldData, LiquidProductData } from './drops'
import { numericId } from './numeric-id'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

const MOUSE = FIXTURE_PRODUCT.id
const PAD: LiquidProductData = {
  ...FIXTURE_PRODUCT,
  id: '01a0def6-3000-7000-8000-000000000001',
  handle: 'pad',
  title: 'Pad',
  variants: [
    {
      ...(FIXTURE_PRODUCT.variants[0] as LiquidProductData['variants'][0]),
      id: '01a0def6-3000-7000-8000-0000000000aa',
      title: 'Large',
    },
  ],
}
const ENTRY_A = '01a0def6-4000-7000-8000-00000000000a'
const ENTRY_B = '01a0def6-4000-7000-8000-00000000000b'
const IMG = {
  id: '01a0def6-5000-7000-8000-000000000001',
  url: 'https://cdn.example/f.png',
  alt: 'Feature',
  width: 900,
  height: 600,
  contentType: 'image/png',
}
const PDF = {
  id: '01a0def6-5000-7000-8000-000000000002',
  url: 'https://cdn.example/manual.pdf',
  alt: null,
  width: null,
  height: null,
  contentType: 'application/pdf',
}

const mf = (
  key: string,
  type: LiquidFieldData['type'],
  value: unknown,
  more: Partial<LiquidMetafieldData> = {},
): LiquidMetafieldData => ({
  namespace: 'custom',
  key,
  type,
  list: false,
  measure: null,
  value,
  ...more,
})

const DATA: FakeStoreData = {
  products: [PAD],
  collections: [
    {
      id: '01a0def6-6000-7000-8000-000000000001',
      handle: 'mice',
      title: 'Mice',
      descriptionHtml: '',
      image: { url: 'https://cdn.example/mice.png' },
      productsCount: 1,
    },
  ],
  pages: [
    {
      id: '01a0def6-7000-7000-8000-000000000001',
      handle: 'about',
      title: 'About us',
      contentHtml: '',
    },
  ],
  metafields: {
    [MOUSE]: [
      mf('spec_weight', 'single_line_text', '58 g'),
      mf('size_guide', 'multi_line_text', 'S: 10\nM: 12'),
      mf('rows', 'number_integer', 3),
      mf('ratio', 'number_decimal', 1.5),
      mf('wireless', 'boolean', true),
      mf('drop_date', 'date', '2026-11-01'),
      mf('launch_at', 'date_time', '2026-11-01T10:00:00.000Z'),
      mf('accent', 'color', '#ff0000'),
      mf('manual_url', 'url', 'https://example.com/m'),
      mf('cta', 'link', { label: 'Read more', url: '/pages/about' }),
      mf('story', 'rich_text', '<p>Hello <strong>there</strong></p>'),
      mf('launch_price', 'money', { amount: 499900, currency: 'INR' }),
      mf('score', 'rating', { value: 4.5, max: 5 }),
      mf('weight', 'measurement', { value: 58, unit: 'g' }, { measure: 'weight' }),
      mf('length', 'measurement', { value: 12, unit: 'cm' }, { measure: 'length' }),
      mf('hero', 'file', { kind: 'file', id: IMG.id, file: IMG }),
      mf('manual', 'file', { kind: 'file', id: PDF.id, file: PDF }),
      mf('accessories', 'product_reference', [{ kind: 'product', id: PAD.id, handle: 'pad' }], {
        list: true,
      }),
      mf('home', 'collection_reference', { kind: 'collection', id: 'c', handle: 'mice' }),
      mf('about', 'page_reference', { kind: 'page', id: 'p', handle: 'about' }),
      mf('size', 'variant_reference', {
        kind: 'variant',
        id: PAD.variants[0]?.id,
        productHandle: 'pad',
      }),
      mf(
        'features',
        'metaobject_reference',
        [
          { kind: 'metaobject', id: ENTRY_A },
          { kind: 'metaobject', id: ENTRY_B },
        ],
        { list: true },
      ),
      mf('tags', 'single_line_text', ['quiet', 'light'], { list: true }),
      mf('table', 'group', [{ size: 'S', photo: { kind: 'file', id: IMG.id, file: IMG } }]),
      mf('rating', 'rating', { value: 4, max: 5 }, { namespace: 'reviews' }),
    ],
  },
  entries: [
    {
      id: ENTRY_A,
      handle: 'grip',
      type: 'feature',
      fields: [
        { key: 'heading', type: 'single_line_text', list: false, measure: null, value: 'Grip' },
        {
          key: 'image',
          type: 'file',
          list: false,
          measure: null,
          value: { kind: 'file', id: IMG.id, file: IMG },
        },
        {
          key: 'layout',
          type: 'single_line_text',
          list: false,
          measure: null,
          value: 'image-right',
        },
      ],
    },
    {
      id: ENTRY_B,
      handle: 'shape',
      type: 'feature',
      fields: [
        { key: 'heading', type: 'single_line_text', list: false, measure: null, value: 'Shape' },
      ],
    },
  ],
}

let themes = 0

async function render(source: string, data = fakeDataSource(DATA)) {
  const bundle = buildThemeBundle({
    themeId: `custom-${themes++}`,
    version: 'v1',
    textFiles: new Map([['sections/probe.liquid', source]]),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data,
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
  let failure: unknown = null
  const html = await renderLiquidSection(
    ctx,
    { id: 'probe', type: 'probe', settings: {}, blocks: [], location: 'template', index: 0 },
    (err) => {
      failure = err
    },
  )
  if (failure) throw failure
  return { html: html.trim(), data }
}

const P = "{%- assign p = all_products['mouse'] -%}{%- assign m = p.metafields.custom -%}"

describe('product metafields', () => {
  it('reads text, numbers, booleans, dates and urls with Shopify type names', async () => {
    const { html } = await render(
      `${P}[{{ m.spec_weight.value }}|{{ m.spec_weight.type }}|{{ m.spec_weight }}][{{ m.size_guide.value | newline_to_br }}|{{ m.size_guide.type }}][{{ m.rows.value | plus: 1 }}|{{ m.ratio.value | times: 2 }}|{{ m.rows.type }}][{% if m.wireless.value %}yes{% endif %}|{{ m.wireless.type }}][{{ m.drop_date.value | date: '%d %b %Y' }}|{{ m.launch_at.type }}][{{ m.manual_url.value }}]`,
    )
    expect(html).toContain('[58 g|single_line_text_field|58 g]')
    expect(html).toContain('[S: 10<br />\nM: 12|multi_line_text_field]')
    expect(html).toContain('[4|3|number_integer]')
    expect(html).toContain('[yes|boolean]')
    expect(html).toContain('[01 Nov 2026|date_time]')
    expect(html).toContain('[https://example.com/m]')
  })

  it('reads colour, link, rich text, money, rating and measurements as objects', async () => {
    const { html } = await render(
      `${P}[{{ m.accent.value }}|{{ m.accent.value.rgb }}|{{ m.accent.type }}][{{ m.cta.value.text }}|{{ m.cta.value.url }}|{{ m.cta.type }}][{{ m.story.value }}|{{ m.story.type }}][{{ m.launch_price.value | money }}|{{ m.launch_price.value.amount }}|{{ m.launch_price }}][{{ m.score.value.rating }}/{{ m.score.value.scale_max }}|{{ m.score.type }}][{{ m.weight.value }}|{{ m.weight.value.unit }}|{{ m.weight.type }}|{{ m.length.type }}]`,
    )
    expect(html).toContain('[#ff0000|255 0 0|color]')
    expect(html).toContain('[Read more|/pages/about|link]')
    expect(html).toContain('[<p>Hello <strong>there</strong></p>|rich_text_field]')
    expect(html).toContain('[₹4,999|4999|{"amount":"4999.00","currency_code":"INR"}]')
    expect(html).toContain('[4.5/5|rating]')
    expect(html).toContain('[58 g|g|weight|dimension]')
  })

  it('reads files as images or plain files, usable with image filters', async () => {
    const { html } = await render(
      `${P}[{{ m.hero.value | image_url: width: 400 }}|{{ m.hero | image_url: width: 300 }}|{{ m.hero.value.width }}|{{ m.hero.alt }}|{{ m.hero.type }}][{{ m.manual.value.url }}|{{ m.manual.value.media_type }}][{{ m.hero }}]`,
    )
    expect(html).toContain(
      '[https://cdn.example/f.png|https://cdn.example/f.png|900|Feature|file_reference]',
    )
    expect(html).toContain('[https://cdn.example/manual.pdf|generic_file]')
    expect(html).toContain(`[gid://shopify/MediaImage/${numericId(IMG.id)}]`)
  })

  it('resolves references to products, collections, pages, variants and entries, and lists', async () => {
    const { html } = await render(
      `${P}[{% for a in m.accessories.value %}{{ a.title }} {{ a.url }}{% endfor %}|{{ m.accessories.type }}|{{ m.accessories.value.size }}][{{ m.home.value.title }}|{{ m.home.value.image | image_url }}][{{ m.about.value.title }}][{{ m.size.value.title }}][{% for f in m.features.value %}{{ f.heading.value }}:{{ f.heading }}:{{ f.system.handle }}:{{ f.system.type }}{% if f.image %}:{{ f.image | image_url: width: 900 }}:{{ f.image.width }}{% endif %},{% endfor %}][{{ m.tags.value | join: '+' }}|{{ m.tags }}|{{ m.tags.type }}][{{ m.table.value.first.size }}:{{ m.table.value.first.photo | image_url }}|{{ m.table.type }}]`,
    )
    expect(html).toContain('[Pad /products/pad|list.product_reference|1]')
    expect(html).toContain('[Mice|https://cdn.example/mice.png]')
    expect(html).toContain('[About us]')
    expect(html).toContain('[Large]')
    expect(html).toContain(
      '[Grip:Grip:grip:feature:https://cdn.example/f.png:900,Shape:Shape:shape:feature,]',
    )
    expect(html).toContain('[quiet+light|["quiet","light"]|list.single_line_text_field]')
    expect(html).toContain('[S:https://cdn.example/f.png|json]')
  })

  it('maps Shopify keys to ours, compares like values and reads blank when missing', async () => {
    const { html } = await render(
      `${P}{%- assign k = 'Spec-Weight' -%}[{{ p.metafields.custom[k].value }}|{{ p.metafields['custom']['size_guide'] | append: '' | split: ':' | first }}][{% if m.spec_weight == '58 g' %}eq{% endif %}|{% if m.nope == blank %}blank{% endif %}|{% if m.spec_weight != blank %}set{% endif %}|{{ m.nope.value | default: 'none' }}][{{ p.metafields.reviews.rating.value.rating }}]`,
    )
    expect(html).toContain('[58 g|S]')
    expect(html).toContain('[eq|blank|set|none]')
    // A namespace apps use on Shopify reads from extra fields too when the store has them.
    expect(html).toContain('[4]')
  })

  it('loads the extra fields of every product on the page in one batch', async () => {
    const { html, data } = await render(
      `{% assign hs = "mouse,pad" | split: "," %}{% for h in hs %}{{ all_products[h].metafields.custom.spec_weight.value | default: '-' }};{% endfor %}`,
    )
    expect(html).toBe('58 g;-;')
    expect(data.calls.filter((c) => c.startsWith('metafields:'))).toEqual([
      `metafields:product:${MOUSE},${PAD.id}`,
    ])
  })

  it('reads blank on owners we keep no extra fields for', async () => {
    const { html } = await render(
      `[{{ shop.metafields.custom.menu_image.value | image_url }}|{{ all_products['mouse'].variants.first.metafields.custom.dimensions }}|{{ pages['about'].metafields.custom.x }}]`,
    )
    expect(html).toBe('[||]')
  })
})

describe('metaobjects', () => {
  it('lists entries of a type and finds one by handle, globally and on shop', async () => {
    const { html, data } = await render(
      `[{% for e in metaobjects.feature.values %}{{ e.heading.value }},{% endfor %}|{{ metaobjects.feature.values_count }}][{{ shop.metaobjects.feature['grip'].layout.value }}|{{ shop.metaobjects.feature.shape.system.id }}|{{ metaobjects['Feature'].missing }}][{{ metaobjects.nope.values.size }}]`,
    )
    expect(html).toBe(`[Grip,Shape,|2][image-right|${numericId(ENTRY_B)}|][0]`)
    // One load per type per request.
    expect(data.calls.filter((c) => c === 'metaobjects:feature')).toHaveLength(1)
  })
})

describe('menu links', () => {
  it('points link.object at the collection, product or page of the path', async () => {
    const { html } = await render(
      `{% for l in linklists['main-menu'].links %}{{ l.object.title }} {{ l.object.featured_image | image_url }}{% endfor %}`,
    )
    expect(html).toBe('Mice https://cdn.example/mice.png')
  })
})
