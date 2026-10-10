import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlocksConfig, SECTION_CATEGORIES } from '../src/puck-config'
import { kitSections } from '../src/sections/kit'
import { SECTION_SOURCES } from '../src/sections/sources'
import { renderBlock } from '../src/slots'

const config = createBlocksConfig(async () => [])
const components = config.components as unknown as Parameters<typeof renderBlock>[1]
const puck = { isEditing: false, metadata: {} }
const KIT = Object.keys(kitSections())

const draw = (type: string, props: Record<string, unknown> = {}) => {
  const defaults = (config.components[type as never] as { defaultProps: object }).defaultProps
  return renderToStaticMarkup(
    <div>
      {renderBlock({ type, props: { id: type, ...defaults, ...props } }, components, puck)}
    </div>,
  )
}

describe('starter kit sections', () => {
  it('are all offered in the Add panel', () => {
    const offered = new Set<string>(
      Object.values(SECTION_CATEGORIES).flatMap((c) => [...c.components] as string[]),
    )
    for (const type of KIT) expect(offered.has(type), type).toBe(true)
  })

  it('credit Magic UI on every section built on one of its effects', () => {
    for (const type of [
      'GridHero',
      'RotatingHero',
      'ShowcaseHero',
      'StatsCards',
      'CtaCard',
      'FeatureCards',
      'PricingCards',
    ]) {
      expect(SECTION_SOURCES[type]?.name, type).toBe('Magic UI')
    }
  })

  it('draws the first rotating word on the server and gives screen readers every word', () => {
    const html = draw('RotatingHero')
    expect(html).toContain('>personal</span>')
    expect(html).toContain('personal, thoughtful, handmade, special')
  })

  it('shows a logo name as a wordmark until a picture is chosen', () => {
    const html = draw('LogoCloud', {
      logos: [
        { image: { url: '', alt: '' }, name: 'Mint', href: '' },
        { image: { url: 'https://cdn.test/a.png', alt: '' }, name: 'Forbes', href: '/press' },
      ],
    })
    expect(html).toContain('>Mint</span>')
    expect(html).toContain('alt="Forbes"')
    expect(html).toContain('href="/press"')
  })

  it('renders final stat values, never a blank zero, before any script runs', () => {
    const html = draw('StatsCards')
    expect(html).toContain('50,000')
    expect(html).toContain('4.8')
  })

  it('opens every answer on the canvas and none on the storefront', () => {
    const live = draw('FaqSplit')
    expect(live).toContain('<details')
    expect(live).not.toContain('open=""')
    const editing = renderToStaticMarkup(
      <div>
        {renderBlock(
          {
            type: 'FaqSplit',
            props: {
              id: 'FaqSplit',
              ...(config.components['FaqSplit' as never] as { defaultProps: object }).defaultProps,
            },
          },
          components,
          { isEditing: true, metadata: {} },
        )}
      </div>,
    )
    expect(editing).toContain('open=""')
  })

  it('splits plan features into ticked lines and labels ticks for screen readers', () => {
    const html = draw('PricingCards')
    expect(html).toContain('>Gift wrapping included</span>')
    expect(html).toContain('Most popular')
    const table = draw('ComparisonTable')
    expect(table).toContain('aria-label="Included"')
    expect(table).toContain('aria-label="Not included"')
  })

  it('reads ratings out as words and draws no stars for zero', () => {
    const html = draw('TestimonialGrid', {
      quotes: [
        { quote: 'Great', author: 'Asha', role: '', rating: 4 },
        { quote: 'Fine', author: 'Ravi', role: '', rating: 0 },
      ],
    })
    expect(html).toContain('aria-label="4 out of 5 stars"')
    expect(html).not.toContain('0 out of 5 stars')
    expect(html).toContain('>A</span>')
  })

  it('hides a button whose label is blank and turns unsafe links into #', () => {
    const html = draw('CtaCard', {
      primary: { label: 'Go', href: 'javascript:alert(1)' },
      secondary: { label: '', href: '/x' },
    })
    expect(html).toContain('href="#"')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('href="/x"')
  })
})
