import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  createBlocksConfig,
  DYNAMIC_SECTIONS,
  ELEMENT_BLOCKS,
  LAYOUT_BLOCKS,
} from '../src/puck-config'
import { renderBlock } from '../src/slots'

/**
 * Sections that float over the page instead of sitting in it, so spacing, width and
 * background have nothing to act on. Each one shows itself only where it makes sense.
 */
const OVERLAYS: Record<string, string> = {
  MobileDock: 'fixed to the bottom of phone screens',
  SignupPopup: 'a popup dialog',
  StickyAtc: 'a bar fixed to the bottom of the product page',
}

const config = createBlocksConfig(async () => [])
const components = config.components as unknown as Parameters<typeof renderBlock>[1]
const dynamic = new Set<string>([...DYNAMIC_SECTIONS, 'LiquidSection'])
const custom = new Set<string>([...LAYOUT_BLOCKS, ...ELEMENT_BLOCKS])
const types = Object.keys(config.components)
const sections = types.filter((t) => !dynamic.has(t) && !custom.has(t) && !(t in OVERLAYS))
const fieldsOf = (type: string) =>
  (config.components[type as never] as { fields?: Record<string, unknown> }).fields ?? {}

describe('section settings on every section', () => {
  it('every section placed on a page offers the shared section settings', () => {
    expect(sections.filter((t) => !('settings' in fieldsOf(t)))).toEqual([])
  })

  it('every layout block and element offers its own style panel', () => {
    expect([...custom].filter((t) => !('style' in fieldsOf(t)))).toEqual([])
  })

  it('the overlay exceptions are real sections, so the list stays honest', () => {
    for (const type of Object.keys(OVERLAYS)) expect(types, type).toContain(type)
  })

  for (const type of sections) {
    // Drawn as the editor draws it: product sections show their frame there even before a
    // product is picked (on the storefront they hide until there is something to show).
    it(`${type} applies its settings (the anchor reaches the page)`, () => {
      const defaults = (config.components[type as never] as { defaultProps: { settings: object } })
        .defaultProps
      const settings = defaults.settings as { advanced: Record<string, unknown> }
      const props = {
        ...defaults,
        id: type,
        settings: { ...settings, advanced: { ...settings.advanced, anchorId: 'qa-anchor' } },
      }
      const html = renderToStaticMarkup(
        <div>{renderBlock({ type, props }, components, { isEditing: true, metadata: {} })}</div>,
      )
      expect(html).toContain('id="qa-anchor"')
    })
  }
})
