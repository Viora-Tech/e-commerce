import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlocksConfig, ELEMENT_BLOCKS, LAYOUT_BLOCKS } from '../src/puck-config'
import { renderBlock } from '../src/slots'

/**
 * The deliberate exceptions, with why. Every other section must offer the shared settings.
 * Overlays float over the page, so spacing, width and background have nothing to act on;
 * an imported Shopify section carries its own theme's schema instead.
 */
const SKIPS: Record<string, string> = {
  MobileDock: 'a bar fixed to the bottom of phone screens',
  SignupPopup: 'a popup dialog',
  WhatsappChat: 'a button fixed to the corner of every page',
  StickyAtc: 'a bar fixed to the bottom of the product page',
  CookieBanner: 'floats over the page until answered',
  LiquidSection: "an imported Shopify section, set by its own theme's schema",
}

/** A stand-in for what the storefront draws for each dynamic section. */
const renderers = new Proxy({}, { get: () => () => <p>drawn by the storefront</p> })

const config = createBlocksConfig(async () => [])
const components = config.components as unknown as Parameters<typeof renderBlock>[1]
const custom = new Set<string>([...LAYOUT_BLOCKS, ...ELEMENT_BLOCKS])
const types = Object.keys(config.components)
const sections = types.filter((t) => !custom.has(t) && !(t in SKIPS))
const fieldsOf = (type: string) =>
  (config.components[type as never] as { fields?: Record<string, unknown> }).fields ?? {}

describe('section settings on every section', () => {
  it('every section placed on a page offers the shared section settings', () => {
    expect(sections.filter((t) => !('settings' in fieldsOf(t)))).toEqual([])
  })

  it('includes the header, footer, every main section and the product lists', () => {
    for (const type of [
      'Header',
      'Footer',
      'MainProduct',
      'MainCollection',
      'MainPage',
      'MainBlog',
      'MainArticle',
      'MainCart',
      'MainSearch',
      'MainNotFound',
      'MainAccount',
      'MainLogin',
      'RelatedProducts',
      'RecentlyViewed',
      'Hero',
      'AnnouncementBar',
    ]) {
      expect(sections, type).toContain(type)
    }
  })

  it('every layout block and element offers its own style panel', () => {
    expect([...custom].filter((t) => !('style' in fieldsOf(t)))).toEqual([])
  })

  it('the exceptions are real sections without settings, so the list stays honest', () => {
    for (const type of Object.keys(SKIPS)) {
      expect(types, type).toContain(type)
      expect('settings' in fieldsOf(type), type).toBe(false)
    }
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
        <div>
          {renderBlock({ type, props }, components, { isEditing: true, metadata: { renderers } })}
        </div>,
      )
      expect(html).toContain('id="qa-anchor"')
    })
  }
})

describe('section background colour', () => {
  it('follows a theme colour by name and keeps a typed colour', async () => {
    const { sectionBackground } = await import('../src/section-settings')
    expect(sectionBackground('brand')).toBe('var(--color-brand)')
    expect(sectionBackground('background')).toBe('var(--color-bg)')
    expect(sectionBackground('#ffffff')).toBe('#ffffff')
    expect(sectionBackground('url(x)')).toBeNull()
    expect(sectionBackground('')).toBeNull()
  })
})

describe('dynamic sections without a changed setting', () => {
  it('draw exactly what the storefront drew, with no frame around it', () => {
    const html = renderToStaticMarkup(
      <div>
        {renderBlock({ type: 'MainPage', props: { id: 'main' } }, components, {
          isEditing: false,
          metadata: { renderers },
        })}
      </div>,
    )
    expect(html).toBe('<div><p>drawn by the storefront</p></div>')
  })

  it('wrap it in a frame with the scheme once one is chosen', () => {
    const settings = (
      config.components.MainPage as unknown as { defaultProps: { settings: { style: object } } }
    ).defaultProps.settings
    const html = renderToStaticMarkup(
      <div>
        {renderBlock(
          {
            type: 'MainPage',
            props: {
              id: 'main',
              settings: { ...settings, style: { ...settings.style, colorScheme: 'scheme-2' } },
            },
          },
          components,
          { isEditing: false, metadata: { renderers } },
        )}
      </div>,
    )
    expect(html).toContain('class="section-frame color-scheme-2"')
    expect(html).toContain('<p>drawn by the storefront</p>')
  })
})
