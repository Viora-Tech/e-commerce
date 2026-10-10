import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { categoryPanelsSection } from '../src/sections/zero-drift/category-panels'
import { dropsTeaserSection } from '../src/sections/zero-drift/drops-teaser'
import type { ZeroDriftLoaders } from '../src/sections/zero-drift/loaders'
import { notesSeriesSection } from '../src/sections/zero-drift/notes-series'
import { promoBentoSection } from '../src/sections/zero-drift/promo-bento'
import { shipsTodaySection } from '../src/sections/zero-drift/ships-today'

const loaders: ZeroDriftLoaders = { loadProducts: async () => [] }
const puck = { metadata: {} }

function html(config: ReturnType<typeof promoBentoSection>, extra: Record<string, unknown> = {}) {
  const props = { ...(config.defaultProps as Record<string, unknown>), ...extra, puck }
  // @ts-expect-error -- loose test props against the config's widened component type
  return renderToStaticMarkup(config.render(props))
}

describe('Glide batch: ships-today, category-panels, promo-bento, drops-teaser, notes-series', () => {
  it('renders each section with its defaults and no empty image sources', () => {
    for (const make of [
      shipsTodaySection,
      categoryPanelsSection,
      promoBentoSection,
      dropsTeaserSection,
      notesSeriesSection,
    ]) {
      const out = html(make(loaders))
      expect(out.length).toBeGreaterThan(0)
      expect(out).not.toContain('src=""')
    }
  })

  it('promo bento falls back to the collection name, link and image, and honours hover reveal', () => {
    const config = promoBentoSection(loaders)
    const defaults = config.defaultProps as { tiles: Record<string, unknown>[] }
    const out = html(config, {
      textReveal: 'hover',
      tiles: [{ ...defaults.tiles[0], title: '', size: 'large' }],
      resolved: [{ title: 'Mice', href: '/collections/mice', imageUrl: '/media/mice.jpg' }],
    })
    expect(out).toContain('promo-tile--large')
    expect(out).toContain('promo-tile--reveal-hover')
    expect(out).toContain('href="/collections/mice"')
    expect(out).toContain('>Mice<')
    expect(out).toContain('/media/mice.jpg')
  })

  it('promo bento hides the copy on a picture-only tile', () => {
    const config = promoBentoSection(loaders)
    const defaults = config.defaultProps as { tiles: Record<string, unknown>[] }
    const out = html(config, { tiles: [{ ...defaults.tiles[0], showText: false }] })
    expect(out).not.toContain('promo-tile__copy')
  })

  it('category panels opens the first panel and shows the product count when no line is set', () => {
    const config = categoryPanelsSection(loaders)
    const out = html(config, {
      resolved: [{ title: 'Mice', count: 12, imageUrl: '/media/mice.jpg' }],
    })
    expect(out).toContain('category-panel is-open')
    expect(out).toContain('12 products')
  })

  it('drops teaser says each status in its own words', () => {
    const out = html(dropsTeaserSection(loaders))
    expect(out).toContain('Shipping now')
    expect(out).toContain('Coming')
  })
})
