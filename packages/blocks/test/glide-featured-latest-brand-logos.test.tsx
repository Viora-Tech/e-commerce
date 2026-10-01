import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { brandLabSection } from '../src/sections/glide/brand-lab'
import { featuredCarouselSection } from '../src/sections/glide/featured-carousel'
import { latestDropSection } from '../src/sections/glide/latest-drop'
import { logoCarouselSection } from '../src/sections/glide/logo-carousel'
import type { CardCollection, CardProduct } from '../src/types'

const product = (handle: string): CardProduct => ({
  id: handle,
  handle,
  title: `Title ${handle}`,
  vendor: null,
  productType: null,
  pricePaise: 150000,
  mrpPaise: null,
  available: 3,
  images: [
    { url: `/media/${handle}-1.jpg`, alt: null },
    { url: `/media/${handle}-2.jpg`, alt: null },
  ],
})
const loaders = { loadProducts: async () => [] }

function html(config: ReturnType<typeof latestDropSection>, extra: Record<string, unknown>) {
  const props = { ...(config.defaultProps as Record<string, unknown>), ...extra }
  // @ts-expect-error -- loose test props against the config's widened component type
  return renderToStaticMarkup(config.render({ ...props, puck: { metadata: {} } }))
}

describe('latest drop', () => {
  const config = latestDropSection(loaders)
  it('shows the product, hover image and spec chips, and hides blank specs', () => {
    const out = html(config, {
      resolved: product('a'),
      specs: [
        { label: 'Size', value: 'XL' },
        { label: '', value: '' },
      ],
      deadline: '2999-01-01T00:00:00Z',
    })
    expect(out).toContain('Title a')
    expect(out).toContain('latest-drop__image--hover')
    expect(out.match(/latest-drop__spec"/g)).toHaveLength(1)
    expect(out).toContain('latest-drop__countdown')
    expect(out).not.toContain('src=""')
  })
  it('renders a graceful state with no product', () => {
    expect(html(config, {})).toContain('latest-drop__empty')
  })
})

describe('brand lab', () => {
  const config = brandLabSection()
  it('renders linked brands and skips unnamed ones', () => {
    const out = html(config, {
      brands: [
        { name: 'Pulsar', description: 'd', logo: { url: '', alt: '' }, href: '/collections/p' },
        { name: '', description: 'x', logo: { url: '', alt: '' }, href: '/collections/q' },
      ],
    })
    expect(out).toContain('href="/collections/p"')
    expect(out).not.toContain('/collections/q')
  })
})

describe('logo carousel', () => {
  const config = logoCarouselSection(loaders)
  const collections: CardCollection[] = [
    { handle: 'pulsar', title: 'Pulsar', imageUrl: '/media/pulsar.jpg', productCount: 3 },
  ]
  const items = [
    { collectionHandle: 'pulsar', image: { url: '', alt: '' }, href: '', label: '', quote: '' },
    { collectionHandle: 'nope', image: { url: '', alt: '' }, href: '', label: '', quote: '' },
  ]
  it('fills picture, name and link from the collection and doubles the run', () => {
    const out = html(config, { items, resolved: collections })
    expect(out).toContain('/collections/pulsar')
    expect(out).toContain('Pulsar')
    expect(out.match(/logo-carousel__run/g)).toHaveLength(2)
    expect(out).not.toContain('src=""')
  })
  it('press display is a still strip with quotes and no track', () => {
    const out = html(config, {
      display: 'press',
      items: [{ ...items[0], quote: 'Great pads' }],
      resolved: collections,
    })
    expect(out).toContain('logo-carousel__quote')
    expect(out).not.toContain('logo-carousel__track')
  })
})

describe('featured carousel', () => {
  const config = featuredCarouselSection(loaders)
  it('renders every slide that resolved, with dots and arrows, and skips the rest', () => {
    const out = html(config, {
      slides: [
        { handle: 'a', eyebrow: '' },
        { handle: 'missing', eyebrow: '' },
        { handle: 'b', eyebrow: 'Pre-order' },
      ],
      resolved: [product('a'), null, product('b')],
    })
    expect(out).toContain('Title a')
    expect(out).toContain('Title b')
    expect(out).not.toContain('missing')
    expect(out.match(/featured-carousel__dot[ "]/g)).toHaveLength(2)
    expect(out).not.toContain('src=""')
  })
  it('shows an empty state with no slides', () => {
    expect(html(config, { slides: [], resolved: [] })).toContain('featured-carousel__empty')
  })
})
