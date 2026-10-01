import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createBlocksConfig,
  GLIDE_PRODUCT_SECTIONS,
  SECTION_CATEGORIES,
  type SectionMetadata,
} from '../src/puck-config'
import type { ProductDetail } from '../src/types'

type FieldShape = {
  type?: string
  contentEditable?: boolean
  arrayFields?: Record<string, FieldShape>
  objectFields?: Record<string, FieldShape>
}

const product: ProductDetail = {
  id: 'p1',
  handle: 'viper',
  title: 'Viper V3',
  description: 'A light mouse for fast hands.',
  vendor: 'Razer',
  productType: 'Mouse',
  images: [],
  options: [],
  variants: [],
}

/** Data a merchant typed or connected, so every section has something to draw. */
const FILLED: Record<string, Record<string, unknown>> = {
  ProductSpecs: {
    groups: [
      {
        title: 'Specification',
        layout: 'columns',
        rows: 'Sensor: PAW3395 | flagship\nWeight: 54 g',
        note: '',
      },
    ],
  },
  ProductSizeGuide: {
    rows: 'Small | 118 x 60 mm | 16.0 - 17.5 cm | Claw, Fingertip | 52 g\nLarge | 128 x 66 mm | 18.5 - 20.5 cm | Palm | 60 g',
  },
  ProductSizeTable: { table: 'Size | Chest | Length\nM | 102 cm | 70 cm\nL | 108 cm | 72 cm' },
  ProductSpecStrip: { items: [{ label: 'Weight', value: '54 (without cable)', unit: 'g' }] },
  ProductFeatures: {
    features: [
      {
        image: { url: 'https://cdn.example.com/a.jpg', alt: 'Shell' },
        heading: 'Light',
        text: '<p>54 g.</p>',
        layout: 'auto',
      },
    ],
  },
}

const isInline = (f: FieldShape) =>
  f.type === 'richtext' || ((f.type === 'text' || f.type === 'textarea') && f.contentEditable)

function countInline(fields: Record<string, FieldShape>): number {
  return Object.values(fields).reduce(
    (n, f) =>
      n +
      (isInline(f) ? 1 : 0) +
      countInline(f.arrayFields ?? {}) +
      countInline(f.objectFields ?? {}),
    0,
  )
}

/** Inline-editable values swapped for React nodes, as Puck hands them over on the canvas. */
function asEditorProps(value: unknown, fields: Record<string, FieldShape>): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value
  const out: Record<string, unknown> = { ...(value as Record<string, unknown>) }
  for (const [key, f] of Object.entries(fields)) {
    if (isInline(f)) out[key] = createElement('span', { 'data-inline': key }, 'x')
    else if (f.type === 'array' && Array.isArray(out[key]))
      out[key] = (out[key] as unknown[]).map((item) => asEditorProps(item, f.arrayFields ?? {}))
    else if (f.type === 'object') out[key] = asEditorProps(out[key], f.objectFields ?? {})
  }
  return out
}

describe('Zero Drift product page sections', () => {
  const config = createBlocksConfig(async () => [])

  it('are registered in the Products category', () => {
    expect(GLIDE_PRODUCT_SECTIONS.length).toBeGreaterThanOrEqual(7)
    for (const key of GLIDE_PRODUCT_SECTIONS) {
      expect(config.components[key], key).toBeTruthy()
      expect(SECTION_CATEGORIES.products.components).toContain(key)
    }
  })

  for (const key of GLIDE_PRODUCT_SECTIONS) {
    describe(key, () => {
      const component = config.components[key]
      if (!component) throw new Error(`${key} is not registered`)
      const fields = component.fields as Record<string, FieldShape>
      const props = {
        ...(component.defaultProps as Record<string, unknown>),
        ...FILLED[key],
        id: `${key}-1`,
      }
      const render = (p: Record<string, unknown>, metadata: SectionMetadata, isEditing = false) =>
        renderToStaticMarkup(
          // @ts-expect-error -- loose test props against the config's widened component type
          component.render({ ...p, puck: { metadata, isEditing } }),
        )

      it('renders with a product in metadata and no empty image sources', () => {
        const html = render(props, { product })
        expect(html.length).toBeGreaterThan(0)
        expect(html).not.toContain('src=""')
        expect(html).not.toContain('spec-table__hint')
      })

      it('renders nothing on the storefront without a product, and a hint in the editor', () => {
        expect(render(props, {})).toBe('')
        expect(render(props, {}, true)).toContain('spec-table__hint')
      })

      it('lets merchants edit its copy on the canvas', () => {
        expect(countInline(fields)).toBeGreaterThan(0)
      })

      it('renders when Puck passes inline-edited copy as React nodes', () => {
        const html = render(
          asEditorProps(props, fields) as Record<string, unknown>,
          { product },
          true,
        )
        expect(html).toContain('data-inline')
      })
    })
  }

  it('leaves out data sections with nothing typed or connected, on the storefront', () => {
    for (const key of [
      'ProductSpecs',
      'ProductSizeGuide',
      'ProductSizeTable',
      'ProductSpecStrip',
      'ProductFeatures',
    ]) {
      const component = config.components[key as (typeof GLIDE_PRODUCT_SECTIONS)[number]]
      // @ts-expect-error -- loose test props
      const out = component.render({ ...component.defaultProps, puck: { metadata: { product } } })
      expect(renderToStaticMarkup(out), key).toBe('')
    }
  })

  /** Render one section with a product in metadata, loosely typed like the stored props. */
  const draw = (key: (typeof GLIDE_PRODUCT_SECTIONS)[number], props: Record<string, unknown>) => {
    const component = config.components[key] as unknown as {
      defaultProps: Record<string, unknown>
      render: (p: Record<string, unknown>) => ReactElement
    }
    return renderToStaticMarkup(
      component.render({ ...component.defaultProps, ...props, puck: { metadata: { product } } }),
    )
  }

  it('draws the product description in the description tab and drops empty tabs', () => {
    const tab = { body: '', rows: '', anchor: '', preselected: false }
    const html = draw('ProductTabs', {
      id: 't',
      tabs: [
        { ...tab, label: 'Description', content: 'description' },
        { ...tab, label: 'Empty', content: 'text' },
        { ...tab, label: 'Specs', content: 'specs', rows: 'Sensor: PAW3395', anchor: 'specs' },
      ],
    })
    expect(html).toContain('A light mouse for fast hands.')
    expect(html).toContain('PAW3395')
    expect(html).not.toContain('>Empty<')
    expect(html).toContain('t-panel-specs')
  })

  it('splits spec values into the headline number on the spec strip', () => {
    const html = draw('ProductSpecStrip', FILLED.ProductSpecStrip ?? {})
    expect(html).toContain('54')
    expect(html).not.toContain('without cable')
  })

  it('marks the size nearest the middle of the ranges as the best match', () => {
    const html = draw('ProductSizeGuide', FILLED.ProductSizeGuide ?? {})
    expect(html).toContain('size-guide__slider')
    expect(html.match(/is-match/g)).toHaveLength(1)
  })

  it('converts nothing until the shopper picks a unit, and offers the switcher for lengths', () => {
    const html = draw('ProductSizeTable', FILLED.ProductSizeTable ?? {})
    expect(html).toContain('102 cm')
    expect(html).toContain('size-units__button')
  })
})

describe('Related products and Recently viewed', () => {
  const config = createBlocksConfig(async () => [])

  for (const key of ['RelatedProducts', 'RecentlyViewed'] as const) {
    it(`${key} still hands legacy saved settings to its renderer`, () => {
      const component = config.components[key]
      let seen: Record<string, unknown> | null = null
      const metadata: SectionMetadata = {
        renderers: {
          [key]: (s: Record<string, unknown>) => {
            seen = s
            return createElement('p', null, String(s.heading))
          },
        },
      }
      const html = renderToStaticMarkup(
        // @ts-expect-error -- loose test props
        component.render({ id: 'r', heading: 'Old heading', limit: 6, puck: { metadata } }),
      )
      expect(html).toContain('Old heading')
      expect(seen).toMatchObject({ heading: 'Old heading', limit: 6 })
    })

    it(`${key} lets merchants edit its heading on the canvas`, () => {
      const fields = config.components[key].fields as Record<string, FieldShape>
      expect(countInline(fields)).toBeGreaterThan(0)
    })
  }
})
