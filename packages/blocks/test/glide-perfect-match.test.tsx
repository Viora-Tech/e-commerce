import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { perfectMatchSection } from '../src/sections/glide/perfect-match'
import { pickMatchProducts } from '../src/sections/glide/perfect-match-picks'
import type { CardProduct } from '../src/types'

const product = (handle: string, available = 5, image = true): CardProduct => ({
  id: handle,
  handle,
  title: handle,
  vendor: null,
  productType: null,
  pricePaise: 100,
  mrpPaise: null,
  available,
  images: image ? [{ url: `https://example.com/${handle}.jpg`, alt: null }] : [],
})

describe('pickMatchProducts', () => {
  it('puts hand-picked products first, then one per category, then the pool', () => {
    const picks = pickMatchProducts({
      curated: [product('hand')],
      categories: [[product('mouse')], [product('pad')]],
      pool: [product('misc-1'), product('misc-2'), product('misc-3'), product('misc-4')],
      now: 0,
    })
    expect(picks.map((p) => p.handle).slice(0, 3)).toEqual(['hand', 'mouse', 'pad'])
    expect(picks).toHaveLength(6)
  })

  it('skips sold-out and image-less products and never repeats one', () => {
    const picks = pickMatchProducts({
      curated: [product('a'), product('a')],
      categories: [[product('gone', 0), product('bare', 5, false)]],
      pool: [product('a'), product('b')],
      now: 0,
    })
    expect(picks.map((p) => p.handle)).toEqual(['a', 'b'])
  })

  it('picks the same product for the same second', () => {
    const input = {
      curated: [],
      categories: [[product('x1'), product('x2'), product('x3')]],
      pool: [],
      now: 1000,
    }
    expect(pickMatchProducts(input)).toEqual(pickMatchProducts(input))
  })
})

describe('Perfect match', () => {
  const render = (resolved: CardProduct[]) => {
    const config = perfectMatchSection({ loadProducts: async () => [] })
    const props = { ...(config.defaultProps as Record<string, unknown>), resolved }
    // @ts-expect-error -- loose test props against the config's widened component type
    return renderToStaticMarkup(config.render({ ...props, puck: { metadata: {} } }))
  }

  it('renders the heading and button alone when no product resolves', () => {
    const html = render([])
    expect(html).toContain('perfect-match__heading')
    expect(html).toContain('Find my match')
    expect(html).not.toContain('perfect-match__slot')
  })

  it('puts every resolved product on the ring with its position', () => {
    const html = render([product('one'), product('two')])
    expect(html).toContain('--total:2')
    expect(html).toContain('--i:2')
    expect(html).toContain('/products/one')
    expect(html).not.toContain('src=""')
  })
})
