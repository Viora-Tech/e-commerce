import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlocksConfig, ELEMENT_BLOCKS, LAYOUT_BLOCKS } from '../src/puck-config'
import { librarySections } from '../src/sections/library'
import { modernSections } from '../src/sections/modern'
import { renderBlock } from '../src/slots'

type FieldShape = {
  type?: string
  contentEditable?: boolean
  arrayFields?: Record<string, FieldShape>
  objectFields?: Record<string, FieldShape>
}

/**
 * Every section and block outside the Zero Drift theme (that one has
 * `zero-drift-sections.test.tsx`): the generic library and modern sections, the
 * product and rich-text sections in `puck-config.tsx`, and the build-your-own
 * layout containers and elements.
 */
/** Library entries whose config is a Zero Drift section (`../src/sections/zero-drift/*`), tested there. */
const ZERO_DRIFT = new Set(['AnnouncementBar', 'FeaturedProduct', 'Newsletter'])

const GENERIC = [
  ...Object.keys(librarySections({})).filter((key) => !ZERO_DRIFT.has(key)),
  ...Object.keys(modernSections()),
  'FeaturedProducts',
  'CollectionGrid',
  'RichText',
  ...LAYOUT_BLOCKS,
  ...ELEMENT_BLOCKS,
]

/** Blocks that draw no text of their own (containers, media, spacing, embeds). */
const NO_COPY = new Set([
  'Group',
  'Columns',
  'Grid',
  'Carousel',
  'Image',
  'Icon',
  'VideoPlayer',
  'Spacer',
  'Divider',
  'ProductCard',
  'CustomHtml',
])

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

/** Props as Puck's editor hands them over: every inline-editable value swapped for a React node. */
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

const config = createBlocksConfig(async () => [])
const components = config.components as unknown as Parameters<typeof renderBlock>[1]
const puck = { isEditing: true, metadata: {} }
const draw = (type: string, props: Record<string, unknown>) =>
  renderToStaticMarkup(
    <div>{renderBlock({ type, props: { id: type, ...props } }, components, puck)}</div>,
  )

describe('generic sections and blocks: inline editing', () => {
  it('cover every generic section and block', () => {
    expect(GENERIC.length).toBeGreaterThanOrEqual(33)
    for (const key of GENERIC) expect(config.components[key as never], key).toBeTruthy()
  })

  for (const key of GENERIC) {
    describe(key, () => {
      const component = config.components[key as never] as {
        fields: unknown
        defaultProps: unknown
      }
      const fields = component.fields as Record<string, FieldShape>
      const defaults = component.defaultProps as Record<string, unknown>

      it('renders its stored defaults', () => {
        expect(draw(key, defaults)).not.toContain('[object Object]')
      })

      if (NO_COPY.has(key)) return

      it('lets merchants edit its copy on the canvas', () => {
        expect(countInline(fields)).toBeGreaterThan(0)
      })

      it('renders the nodes Puck passes while editing, never stringifying them', () => {
        const html = draw(key, asEditorProps(defaults, fields) as Record<string, unknown>)
        expect(html).toContain('data-inline')
        expect(html).not.toContain('[object Object]')
      })
    })
  }
})

describe('Rich text and Text keep rendering what older pages saved', () => {
  const lexical = {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          textFormat: 0,
          textStyle: '',
          children: [
            {
              type: 'text',
              text: 'Made in ',
              format: 0,
              detail: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
            {
              type: 'text',
              text: 'Jaipur',
              format: 1,
              detail: 0,
              mode: 'normal',
              style: '',
              version: 1,
            },
          ],
        },
      ],
    },
  }

  it('draws Lexical JSON in the Rich text section', () => {
    const html = draw('RichText', { heading: 'Our story', body: lexical, align: 'left' })
    expect(html).toContain('<p>Made in <strong>Jaipur</strong></p>')
  })

  it('draws Lexical JSON saved as a string in the Text element', () => {
    const html = draw('Text', { body: JSON.stringify(lexical) })
    expect(html).toContain('<p>Made in <strong>Jaipur</strong></p>')
  })

  it('draws richtext HTML and old plain strings', () => {
    expect(draw('RichText', { body: '<p>New <em>copy</em></p>' })).toContain(
      '<p>New <em>copy</em></p>',
    )
    expect(draw('Text', { body: 'Plain & simple' })).toContain('<p>Plain &amp; simple</p>')
  })
})
