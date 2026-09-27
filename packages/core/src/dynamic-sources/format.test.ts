/** SOURCE OF TRUTH: dynamic source binding tests — resolver per source type, fallback, type compatibility, validation and catalog */
import { describe, expect, it } from 'vitest'
import { buildSourceCatalog, catalogTypes, optionsFor } from './catalog'
import {
  applyBindings,
  type Binding,
  bindingProblems,
  boundPaths,
  COMPATIBLE,
  connect,
  disconnect,
  isBinding,
  isCompatible,
  parseSourcePath,
  SETTING_KINDS,
  type SettingKind,
  type SourceType,
  type SourceValues,
} from './format'

/** One binding through `applyBindings`: the source's value, or the fallback. */
const resolveBinding = (binding: Binding, values: SourceValues) =>
  (applyBindings({ v: binding }, values) as { v?: unknown }).v

/** The coerced source value alone: undefined when the fallback would render instead. */
const coerceValue = (kind: SettingKind, type: SourceType, value: unknown, fallback: unknown) => {
  const out = resolveBinding(
    { $source: 'shop.name', kind, fallback },
    { 'shop.name': { type, value } },
  )
  return out === fallback ? undefined : out
}

const richText = { root: { type: 'root', children: [] } }

describe('parseSourcePath', () => {
  it('reads fixed fields, metafields, the store and metaobject fields', () => {
    expect(parseSourcePath('product.title')).toEqual({ scope: 'product', field: 'title' })
    expect(parseSourcePath('product.images.2')).toEqual({ scope: 'product', field: 'images.2' })
    expect(parseSourcePath('product.metafields.custom.material')).toEqual({
      scope: 'product',
      namespace: 'custom',
      key: 'material',
    })
    expect(parseSourcePath('collection.image')).toEqual({ scope: 'collection', field: 'image' })
    expect(parseSourcePath('shop.logo')).toEqual({ scope: 'shop', field: 'logo' })
    expect(parseSourcePath('metaobjects.faq.shipping-times.answer')).toEqual({
      scope: 'metaobject',
      type: 'faq',
      handle: 'shipping-times',
      key: 'answer',
    })
  })

  it('refuses anything else', () => {
    for (const bad of [
      '',
      'product',
      'product.nope',
      'product.images.9',
      'product.metafields.custom',
      'product.metafields.Custom.material',
      'product.metafields.custom.material.extra',
      'collection.price',
      'shop.password',
      'metaobjects.faq.shipping',
      'metaobjects.faq.Bad Handle.answer',
      'order.total',
      'product.__proto__',
    ]) {
      expect(parseSourcePath(bad), bad).toBeNull()
    }
  })
})

describe('type compatibility', () => {
  it('image settings only see image sources', () => {
    expect(COMPATIBLE.image).toEqual(['file'])
    expect(isCompatible('image', 'single_line_text')).toBe(false)
  })

  it('text settings take text, numbers, prices, dates and links but not rich text or images', () => {
    for (const t of ['single_line_text', 'multi_line_text', 'money', 'date', 'url'] as const) {
      expect(isCompatible('text', t)).toBe(true)
    }
    expect(isCompatible('text', 'rich_text')).toBe(false)
    expect(isCompatible('text', 'file')).toBe(false)
  })

  it('rich text, links, numbers and colours each take their own kinds', () => {
    expect(isCompatible('richtext', 'rich_text')).toBe(true)
    expect(isCompatible('richtext', 'money')).toBe(false)
    expect(isCompatible('link', 'product_reference')).toBe(true)
    expect(isCompatible('link', 'single_line_text')).toBe(false)
    expect(isCompatible('number', 'number_decimal')).toBe(true)
    expect(isCompatible('number', 'money')).toBe(false)
    expect(isCompatible('color', 'single_line_text')).toBe(true)
    expect(isCompatible('color', 'file')).toBe(false)
  })

  it('no setting kind accepts booleans or metaobject references', () => {
    for (const kind of SETTING_KINDS) {
      expect(isCompatible(kind, 'boolean')).toBe(false)
      expect(isCompatible(kind, 'metaobject_reference')).toBe(false)
    }
  })
})

describe('connect and disconnect', () => {
  it('keeps the typed-in value as the fallback and puts it back', () => {
    const b = connect('product.title', 'text', 'Our best seller')
    expect(b).toEqual({ $source: 'product.title', kind: 'text', fallback: 'Our best seller' })
    expect(isBinding(b)).toBe(true)
    expect(disconnect(b)).toBe('Our best seller')
  })

  it('reconnecting keeps the original fallback, not the old binding', () => {
    const first = connect('product.title', 'text', 'Typed')
    expect(connect('product.vendor', 'text', first).fallback).toBe('Typed')
  })

  it('an empty setting connects without a fallback', () => {
    expect(connect('shop.name', 'text', undefined)).toEqual({ $source: 'shop.name', kind: 'text' })
  })

  it('does not mistake plain objects for bindings', () => {
    expect(isBinding({ url: 'x', alt: '' })).toBe(false)
    expect(isBinding(null)).toBe(false)
    expect(isBinding([{ $source: 'shop.name' }])).toBe(false)
  })
})

describe('coerceValue: one case per source type', () => {
  it('text from single line text, numbers, prices and dates', () => {
    expect(coerceValue('text', 'single_line_text', 'Cotton', 'x')).toBe('Cotton')
    expect(coerceValue('text', 'number_integer', 12, 'x')).toBe('12')
    expect(coerceValue('text', 'number_decimal', 1.5, 'x')).toBe('1.5')
    expect(coerceValue('text', 'money', 129900, 'x')).toBe('₹1,299')
    expect(coerceValue('text', 'date', '2026-03-12', 'x')).toBe('12 March 2026')
    expect(coerceValue('text', 'url', 'https://a.in', 'x')).toBe('https://a.in')
  })

  it('rich text from rich text or plain text', () => {
    expect(coerceValue('richtext', 'rich_text', richText, '')).toBe(richText)
    expect(coerceValue('richtext', 'multi_line_text', 'Line one', '')).toBe('Line one')
    expect(coerceValue('richtext', 'rich_text', { nope: true }, '')).toBeUndefined()
  })

  it('images keep the fallback alt when the file has none', () => {
    expect(
      coerceValue(
        'image',
        'file',
        { url: 'https://cdn/x.jpg', alt: null },
        { url: '', alt: 'Hero' },
      ),
    ).toEqual({ url: 'https://cdn/x.jpg', alt: 'Hero' })
    expect(
      coerceValue('image', 'file', { url: 'https://cdn/x.jpg', alt: 'Mat' }, undefined),
    ).toEqual({
      url: 'https://cdn/x.jpg',
      alt: 'Mat',
    })
  })

  it('refuses unsafe image and link urls', () => {
    expect(coerceValue('image', 'file', { url: 'javascript:alert(1)' }, undefined)).toBeUndefined()
    expect(coerceValue('link', 'url', 'javascript:alert(1)', undefined)).toBeUndefined()
    expect(coerceValue('link', 'url', '//evil.example', undefined)).toBeUndefined()
  })

  it('links from urls and product or collection references keep the button label', () => {
    expect(coerceValue('link', 'url', 'https://a.in/x', { label: 'Shop', href: '/' })).toEqual({
      label: 'Shop',
      href: 'https://a.in/x',
    })
    expect(
      coerceValue('link', 'product_reference', { handle: 'mouse', title: 'Mouse' }, undefined),
    ).toEqual({ label: 'Mouse', href: '/products/mouse' })
    expect(
      coerceValue(
        'link',
        'collection_reference',
        { handle: 'mice', title: 'Mice' },
        {
          label: 'See all',
          href: '',
        },
      ),
    ).toEqual({ label: 'See all', href: '/collections/mice' })
  })

  it('plain link settings get just the href', () => {
    expect(coerceValue('url', 'url', 'https://a.in/x', '/')).toBe('https://a.in/x')
    expect(coerceValue('url', 'product_reference', { handle: 'mouse', title: 'M' }, '/')).toBe(
      '/products/mouse',
    )
    expect(coerceValue('url', 'single_line_text', 'hello', '/')).toBeUndefined()
  })

  it('numbers from numbers, colours only when they are colours', () => {
    expect(coerceValue('number', 'number_integer', 4, 3)).toBe(4)
    expect(coerceValue('number', 'number_decimal', '2.5', 3)).toBe(2.5)
    expect(coerceValue('color', 'single_line_text', '#12ab5f', '')).toBe('#12ab5f')
    expect(coerceValue('color', 'single_line_text', 'oklch(0.7 0.1 150)', '')).toBe(
      'oklch(0.7 0.1 150)',
    )
    expect(coerceValue('color', 'single_line_text', 'red; background: url(x)', '')).toBeUndefined()
  })

  it('empty values, lists and incompatible types give nothing', () => {
    expect(coerceValue('text', 'single_line_text', '  ', 'x')).toBeUndefined()
    expect(coerceValue('text', 'single_line_text', null, 'x')).toBeUndefined()
    expect(coerceValue('text', 'single_line_text', ['a', 'b'], 'x')).toBeUndefined()
    expect(coerceValue('image', 'single_line_text', 'https://x', 'x')).toBeUndefined()
  })
})

describe('resolveBinding and applyBindings', () => {
  const values: SourceValues = {
    'product.title': { type: 'single_line_text', value: 'Viper Mouse' },
    'product.metafields.custom.material': { type: 'single_line_text', value: '' },
    'product.featured_image': { type: 'file', value: { url: 'https://cdn/m.jpg', alt: 'Mouse' } },
    'shop.name': { type: 'single_line_text', value: 'Waimers' },
  }

  it('uses the source when it has a value', () => {
    expect(resolveBinding({ $source: 'product.title', kind: 'text', fallback: 'x' }, values)).toBe(
      'Viper Mouse',
    )
  })

  it('falls back to the typed-in value when the source is empty or missing', () => {
    expect(
      resolveBinding(
        { $source: 'product.metafields.custom.material', kind: 'text', fallback: 'Cotton' },
        values,
      ),
    ).toBe('Cotton')
    expect(
      resolveBinding({ $source: 'product.vendor', kind: 'text', fallback: 'Typed' }, values),
    ).toBe('Typed')
  })

  it('falls back when a stored binding no longer fits its setting', () => {
    expect(
      resolveBinding({ $source: 'product.title', kind: 'image', fallback: { url: 'a' } }, values),
    ).toEqual({ url: 'a' })
  })

  it('replaces bindings deep inside sections and leaves everything else alone', () => {
    const data = {
      root: { props: { title: { $source: 'shop.name', kind: 'text' } } },
      content: [
        {
          type: 'ImageBanner',
          props: {
            id: 'a',
            heading: { $source: 'product.title', kind: 'text', fallback: 'Hi' },
            image: {
              $source: 'product.featured_image',
              kind: 'image',
              fallback: { url: '', alt: '' },
            },
            columns: 3,
            empty: { $source: 'product.vendor', kind: 'number' },
            slides: [{ label: { $source: 'shop.name', kind: 'text', fallback: '' } }],
          },
        },
      ],
    }
    expect(boundPaths(data).sort()).toEqual(
      ['product.featured_image', 'product.title', 'product.vendor', 'shop.name'].sort(),
    )
    const out = applyBindings(data, values)
    expect(out.root.props.title).toBe('Waimers')
    const props = out.content[0]?.props as Record<string, unknown>
    expect(props.heading).toBe('Viper Mouse')
    expect(props.image).toEqual({ url: 'https://cdn/m.jpg', alt: 'Mouse' })
    expect(props.columns).toBe(3)
    expect('empty' in props).toBe(false)
    expect(props.slides).toEqual([{ label: 'Waimers' }])
    // The input is untouched.
    expect(isBinding(data.content[0]?.props.heading)).toBe(true)
  })

  it('with no values gives the typed-in fallbacks', () => {
    const out = applyBindings({ a: { $source: 'shop.name', kind: 'text', fallback: 'Mine' } })
    expect(out.a).toBe('Mine')
  })
})

describe('bindingProblems', () => {
  const section = (props: Record<string, unknown>) => ({
    root: {},
    content: [{ type: 'ImageBanner', props: { id: 's1', ...props } }],
  })

  it('accepts sources the template can read', () => {
    expect(
      bindingProblems(section({ heading: { $source: 'product.title', kind: 'text' } }), 'product'),
    ).toEqual([])
  })

  it('names unknown sources, wrong templates and wrong types', () => {
    expect(
      bindingProblems(section({ heading: { $source: 'product.nope', kind: 'text' } }), 'product'),
    ).toEqual(['Image banner › heading is connected to an unknown source (product.nope)'])
    expect(
      bindingProblems(section({ heading: { $source: 'product.title', kind: 'text' } }), 'home'),
    ).toEqual(['Image banner › heading reads product.title, which this template does not have'])
    expect(
      bindingProblems(section({ image: { $source: 'product.title', kind: 'image' } }), 'product'),
    ).toEqual(['Image banner › image cannot show product.title (wrong type)'])
    expect(
      bindingProblems(section({ heading: { $source: 'shop.name', kind: 'bogus' } }), 'home'),
    ).toHaveLength(1)
  })

  it('with the store catalog, refuses sources that do not exist', () => {
    const catalog = catalogTypes(
      buildSourceCatalog('product', {
        productMetafields: [
          {
            namespace: 'custom',
            key: 'material',
            name: 'Material',
            type: 'single_line_text',
            list: false,
          },
        ],
        collectionMetafields: [],
        metaobjects: [],
      }),
    )
    const ok = section({ heading: { $source: 'product.metafields.custom.material', kind: 'text' } })
    expect(bindingProblems(ok, 'product', catalog)).toEqual([])
    const gone = section({ heading: { $source: 'product.metafields.custom.fabric', kind: 'text' } })
    expect(bindingProblems(gone, 'product', catalog)).toEqual([
      'Image banner › heading is connected to product.metafields.custom.fabric, which no longer exists',
    ])
  })
})

describe('buildSourceCatalog', () => {
  const input = {
    productMetafields: [
      {
        namespace: 'custom',
        key: 'material',
        name: 'Material',
        type: 'single_line_text',
        list: false,
      },
      { namespace: 'custom', key: 'sizes', name: 'Sizes', type: 'single_line_text', list: true },
      { namespace: 'custom', key: 'gift', name: 'Gift', type: 'boolean', list: false },
      { namespace: 'custom', key: 'chart', name: 'Size chart', type: 'file', list: false },
    ],
    collectionMetafields: [
      { namespace: 'custom', key: 'banner', name: 'Banner', type: 'file', list: false },
    ],
    metaobjects: [
      {
        type: 'faq',
        name: 'FAQ',
        fields: [
          { key: 'question', name: 'Question', type: 'single_line_text', list: false },
          { key: 'answer', name: 'Answer', type: 'rich_text', list: false },
        ],
        entries: [{ handle: 'shipping', displayName: 'How long does shipping take?' }],
      },
    ],
  } as const

  const paths = (template: string) =>
    buildSourceCatalog(template, {
      productMetafields: [...input.productMetafields],
      collectionMetafields: [...input.collectionMetafields],
      metaobjects: input.metaobjects.map((m) => ({
        ...m,
        fields: [...m.fields],
        entries: [...m.entries],
      })),
    })

  it('product templates see product fields and metafields, the store and metaobjects', () => {
    const all = paths('product').map((o) => o.path)
    expect(all).toContain('product.price')
    expect(all).toContain('product.metafields.custom.material')
    expect(all).toContain('shop.logo')
    expect(all).toContain('metaobjects.faq.shipping.answer')
    expect(all.some((p) => p.startsWith('collection.'))).toBe(false)
    // Lists and true/false fields cannot fill a setting.
    expect(all).not.toContain('product.metafields.custom.sizes')
    expect(all).not.toContain('product.metafields.custom.gift')
  })

  it('collection templates see collection sources, the home page only the store and metaobjects', () => {
    const collection = paths('collection').map((o) => o.path)
    expect(collection).toContain('collection.metafields.custom.banner')
    expect(collection.some((p) => p.startsWith('product.'))).toBe(false)
    const home = paths('home').map((o) => o.path)
    expect(home.every((p) => p.startsWith('shop.') || p.startsWith('metaobjects.'))).toBe(true)
  })

  it('an image setting is only offered image sources', () => {
    const images = optionsFor(paths('product'), 'image').map((o) => o.path)
    expect(images).toEqual([
      'product.featured_image',
      'product.images.1',
      'product.images.2',
      'product.images.3',
      'product.metafields.custom.chart',
      'shop.logo',
    ])
  })

  it('names metaobject fields with their entry', () => {
    const answer = paths('home').find((o) => o.path === 'metaobjects.faq.shipping.answer')
    expect(answer).toMatchObject({
      group: 'metaobject',
      label: 'Answer',
      entry: 'How long does shipping take?',
      definition: 'FAQ',
    })
  })
})
