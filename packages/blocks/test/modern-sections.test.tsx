import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlocksConfig, SECTION_CATEGORIES, SECTION_SOURCES } from '../src/puck-config'
import type { ModernProps } from '../src/sections/modern'

const MODERN_KEYS: (keyof ModernProps)[] = [
  'SpotlightHero',
  'SplitHero',
  'VideoHero',
  'BentoGrid',
  'LogoMarquee',
  'TestimonialMarquee',
  'StatsCounter',
  'FaqAccordion',
  'CtaBanner',
  'Gallery',
]

const minimalPuck = { metadata: {} }

describe('modern section batch', () => {
  const config = createBlocksConfig(async () => [])

  it('every key is registered, categorised and sourced', () => {
    const allCategoryComponents = Object.values(SECTION_CATEGORIES).flatMap((c) => c.components)
    for (const key of MODERN_KEYS) {
      expect(config.components[key], `${key} is registered`).toBeTruthy()
      expect(allCategoryComponents, `${key} is in a category`).toContain(key)
      expect(SECTION_SOURCES[key], `${key} has a credited source`).toBeTruthy()
    }
  })

  for (const key of MODERN_KEYS) {
    it(`${key} renders non-empty HTML with its default props and no empty image sources`, () => {
      const component = config.components[key]
      if (!component) throw new Error(`${key} is not registered`)
      const defaultProps = component.defaultProps as Record<string, unknown>
      const html = renderToStaticMarkup(
        // @ts-expect-error -- loose test props against the config's widened component type
        component.render({ ...defaultProps, puck: minimalPuck }),
      )
      expect(html.length).toBeGreaterThan(0)
      expect(html).not.toContain('src=""')
    })
  }
})
