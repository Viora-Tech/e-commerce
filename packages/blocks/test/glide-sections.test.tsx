import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlocksConfig, GLIDE_SECTIONS, SECTION_CATEGORIES } from '../src/puck-config'

type FieldShape = {
  type?: string
  contentEditable?: boolean
  arrayFields?: Record<string, FieldShape>
  objectFields?: Record<string, FieldShape>
}

const minimalPuck = { metadata: {} }

/**
 * Sections that show only an empty state until their loader returns a product, post or
 * collection products (the test config's loaders return nothing), so no copy is drawn yet.
 */
const DATA_FIRST = new Set(['FeaturedCarousel', 'LatestDrop', 'DropReveal', 'NotesSeries'])

const isInline = (f: FieldShape) =>
  f.type === 'richtext' || ((f.type === 'text' || f.type === 'textarea') && f.contentEditable)

/** Count the inline-editable fields, nested ones included. */
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

/**
 * Props as Puck's editor hands them over: every inline-editable value swapped for a React
 * node, the way `contentEditable` / `richtext` fields arrive on the canvas.
 */
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

describe('Glide theme sections', () => {
  const config = createBlocksConfig(async () => [])

  it('are all registered and listed in the Glide theme category', () => {
    expect(GLIDE_SECTIONS).toHaveLength(14)
    expect([...SECTION_CATEGORIES.glide.components]).toEqual(GLIDE_SECTIONS)
    for (const key of GLIDE_SECTIONS) expect(config.components[key], key).toBeTruthy()
  })

  for (const key of GLIDE_SECTIONS) {
    describe(key, () => {
      const component = config.components[key]
      if (!component) throw new Error(`${key} is not registered`)
      const fields = component.fields as Record<string, FieldShape>
      const defaults = component.defaultProps as Record<string, unknown>
      const render = (props: Record<string, unknown>) =>
        // @ts-expect-error -- loose test props against the config's widened component type
        component.render({ ...props, puck: minimalPuck })

      it('renders its defaults on the server with no empty image sources', () => {
        const html = renderToStaticMarkup(render(defaults))
        expect(html.length).toBeGreaterThan(0)
        expect(html).not.toContain('src=""')
      })

      it('lets merchants edit its copy on the canvas', () => {
        expect(countInline(fields)).toBeGreaterThan(0)
      })

      it('renders when Puck passes inline-edited copy as React nodes', () => {
        const props = asEditorProps(defaults, fields) as Record<string, unknown>
        const html = renderToStaticMarkup(render(props))
        if (DATA_FIRST.has(key)) expect(html.length).toBeGreaterThan(0)
        else expect(html).toContain('data-inline')
      })
    })
  }
})
