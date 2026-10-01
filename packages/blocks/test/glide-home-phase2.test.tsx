import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createBlocksConfig } from '../src/puck-config'
import type { CardProduct } from '../src/types'

const product: CardProduct = {
  id: 'p1',
  handle: 'glass-pad',
  title: 'Glass pad',
  vendor: null,
  productType: 'Mousepad',
  pricePaise: 499900,
  mrpPaise: null,
  available: 3,
  images: [
    { url: 'https://example.com/a.jpg', alt: 'Front' },
    { url: 'https://example.com/b.jpg', alt: 'Side' },
  ],
}

const config = createBlocksConfig(async () => [product], {
  loadProduct: async (handle) => (handle === product.handle ? product : null),
  loadCollections: async () => [
    { handle: 'mice', title: 'Mice', imageUrl: null, productCount: 12 },
  ],
})

type Key = keyof typeof config.components

/** A section config with its props loosened, as the tests feed it hand-written data. */
type LooseSection = {
  defaultProps: Record<string, unknown>
  render: (props: Record<string, unknown>) => ReactElement
  resolveData: (
    data: { props: Record<string, unknown> },
    params: object,
  ) => Promise<{ props: Record<string, unknown> }>
}

const section = (key: Key) => config.components[key] as unknown as LooseSection

/** Render a section the way the storefront does: defaults under the saved props. */
const render = (key: Key, props: Record<string, unknown> = {}, editing = false) => {
  const merged = { ...section(key).defaultProps, ...props }
  return renderToStaticMarkup(
    section(key).render({ ...merged, puck: { metadata: {}, isEditing: editing } }),
  )
}

/** Run a section's resolveData, then render with what it filled in. */
const resolveAndRender = async (key: Key, props: Record<string, unknown> = {}) => {
  const merged = { ...section(key).defaultProps, ...props }
  const resolved = await section(key).resolveData({ props: merged }, {})
  return render(key, { ...merged, ...resolved.props })
}

const node = (label: string) => createElement('span', { 'data-inline': label }, label)

describe('Hero (Glide hero-carousel)', () => {
  it('renders its defaults with the first heading as the page h1 and no empty sources', () => {
    const html = render('Hero')
    expect(html).toContain('<h1 class="hero-carousel__heading h1">')
    expect(html).toContain('hero-carousel__slide--split')
    expect(html).toContain('hero-carousel__scroll-cue')
    expect(html).not.toContain('src=""')
  })

  it('renders inline-edited copy passed as React nodes', () => {
    const html = render('Hero', {
      slides: [{ heading: node('heading'), subheading: node('sub'), image: { url: '', alt: '' } }],
      scrollCueText: node('cue'),
    })
    expect(html).toContain('data-inline="heading"')
    expect(html).toContain('data-inline="sub"')
    expect(html).toContain('data-inline="cue"')
  })

  it('still renders a hero saved in the old shape', async () => {
    const legacy = {
      slides: [
        {
          heading: 'Old heading',
          subheading: 'Old sub',
          image: { url: 'https://example.com/hero.jpg', alt: 'Hero' },
          cta: { label: 'Shop', href: '/collections/all' },
          cta2: { label: '', href: '' },
          textPosition: 'center',
        },
      ],
      autoplaySeconds: 0,
      heightVh: 60,
    }
    const html = render('Hero', legacy)
    // Split into words for the per-word entrance, which new defaults turn on.
    expect(html).toContain('>Old</span> <span class="hero-carousel__word">heading</span></h1>')
    expect(html).toContain('Old sub')
    expect(html).toContain('hero-carousel__content--center')
    expect(html).toContain('src="https://example.com/hero.jpg"')
    expect(html).toContain('--hero-height:60vh')
    expect(html).not.toContain('btn--secondary')

    const resolved = await section('Hero').resolveData(
      { props: { ...section('Hero').defaultProps, ...legacy } },
      {},
    )
    expect(resolved.props).toMatchObject({
      autoplay: false,
      heightMode: 'fixed',
      slideHeight: 60,
      autoplaySeconds: undefined,
      heightVh: undefined,
    })
  })

  it('plays a video slide with its poster', () => {
    const html = render('Hero', {
      slides: [
        {
          kind: 'video',
          heading: 'Watch',
          image: { url: '', alt: '' },
          videoUrl: 'https://cdn.example.com/hero.mp4',
          poster: { url: 'https://cdn.example.com/poster.jpg', alt: '' },
        },
      ],
    })
    expect(html).toMatch(/<video[^>]*src="https:\/\/cdn.example.com\/hero.mp4"/)
    expect(html).toMatch(/<video[^>]*poster="https:\/\/cdn.example.com\/poster.jpg"/)
  })

  it("uses the picked product's picture and draws its product bar", async () => {
    const html = await resolveAndRender('Hero', {
      slides: [
        {
          heading: '',
          image: { url: '', alt: '' },
          product: 'glass-pad',
          chipStyle: 'bar',
        },
      ],
    })
    expect(html).toContain('src="https://example.com/a.jpg"')
    expect(html).toContain('hero-carousel__bar')
    expect(html).toContain('href="/products/glass-pad"')
  })
})

describe('ProductGrid (Glide tabbed-products)', () => {
  it('renders collection tabs with counts and a View all link', async () => {
    const html = await resolveAndRender('ProductGrid', {
      tabs: [{ label: '', collection: 'mice' }],
      showTabCounts: true,
    })
    expect(html).toContain('role="tablist"')
    expect(html).toContain('Mice')
    expect(html).toContain('tabbed-products__tab-count')
    expect(html).toContain('href="/collections/mice"')
    expect(html).toContain('Glass pad')
  })

  it('renders an inline-edited heading passed as a React node', () => {
    const html = render('ProductGrid', {
      heading: node('heading'),
      resolved: [{ label: 'All', products: [product] }],
    })
    expect(html).toContain('data-inline="heading"')
  })

  it('still renders a grid saved in the old shape', async () => {
    const html = await resolveAndRender('ProductGrid', {
      heading: 'Shop the range',
      tabs: [{ label: 'Pads', productType: 'Mousepad', limit: 4 }],
      columns: 3,
    })
    expect(html).toContain('Pads')
    expect(html).toContain('--columns:3')
    expect(html).toContain('Glass pad')
  })
})

describe('FeaturedProduct (Glide featured-product)', () => {
  it('renders the lockup with stamp, share and help', async () => {
    const html = await resolveAndRender('FeaturedProduct', {
      handle: 'glass-pad',
      showStamp: true,
    })
    expect(html).toContain('featured-lockup')
    expect(html).toContain('featured-lockup__stamp')
    expect(html).toContain('featured-lockup__help')
    expect(html).toContain('Glass pad')
  })

  it('still renders one saved in the old shape', async () => {
    const html = await resolveAndRender('FeaturedProduct', {
      kicker: 'Staff pick',
      handle: 'glass-pad',
      text: 'Fast and smooth.',
      button: 'View product',
    })
    expect(html).toContain('Staff pick')
    expect(html).toContain('Fast and smooth.')
    expect(html).toContain('View product')
  })

  it('renders inline-edited copy passed as React nodes', () => {
    const html = render('FeaturedProduct', {
      kicker: node('kicker'),
      button: node('button'),
      resolved: product,
    })
    expect(html).toContain('data-inline="kicker"')
    expect(html).toContain('data-inline="button"')
  })
})

describe('Reviews (Glide reviews)', () => {
  const reviews = [
    {
      name: 'Asha',
      body: 'Lovely pad.\nVery fast.',
      rating: 5,
      product: 'glass-pad',
      date: 'March 2026',
      verified: true,
      photo: { url: '', alt: '' },
    },
    {
      name: 'Ravi',
      body: 'Great.',
      rating: 4,
      product: '',
      date: '',
      verified: false,
      photo: { url: '', alt: '' },
    },
    {
      name: '',
      body: 'No name, so hidden.',
      rating: 5,
      product: '',
      date: '',
      verified: false,
      photo: { url: '', alt: '' },
    },
  ]

  it('shows nothing on the storefront until a review is complete, and a note in the editor', () => {
    expect(render('Reviews')).not.toContain('section-reviews')
    expect(render('Reviews', {}, true)).toContain('reviews__editor-note')
  })

  it('spotlights the first complete review and lists the rest', async () => {
    const html = await resolveAndRender('Reviews', {
      reviews,
      aggregateRating: '4.8',
      aggregateText: 'from 214 reviews',
    })
    expect(html).toContain('reviews__lead')
    expect(html).toContain('Lovely pad.<br/>Very fast.')
    expect(html).toContain('review-card')
    expect(html).toContain('Rated 4.8 out of 5 stars')
    expect(html).toContain('href="/products/glass-pad"')
    expect(html).not.toContain('No name, so hidden.')
  })

  it('renders inline-edited copy passed as React nodes', () => {
    const html = render('Reviews', {
      heading: node('heading'),
      reviews: [{ ...reviews[0], name: node('name'), body: node('body') }],
    })
    expect(html).toContain('data-inline="heading"')
    expect(html).toContain('data-inline="body"')
  })
})

describe('ImageComparison (Glide image-comparison)', () => {
  it('renders placeholders and a range when no pictures are set', () => {
    const html = render('ImageComparison')
    expect(html).toContain('image-comparison__placeholder')
    expect(html).toContain('type="range"')
    expect(html).not.toContain('src=""')
  })

  it('renders both pictures and a keyboard-operable range input', () => {
    const html = render('ImageComparison', {
      imageBefore: { url: 'https://example.com/before.jpg', alt: 'Before' },
      imageAfter: { url: 'https://example.com/after.jpg', alt: 'After' },
      startPosition: 30,
    })
    expect(html).toContain('src="https://example.com/before.jpg"')
    expect(html).toContain('src="https://example.com/after.jpg"')
    expect(html).toMatch(/<input[^>]*type="range"[^>]*value="30"/)
    expect(html).toContain('aria-label="Drag to compare the two images"')
  })

  it("uses the products' chosen pictures when no pictures are set", async () => {
    const html = await resolveAndRender('ImageComparison', {
      productBefore: 'glass-pad',
      productBeforeImage: 2,
      productAfter: 'glass-pad',
      productAfterImage: 1,
    })
    expect(html).toContain('src="https://example.com/b.jpg"')
    expect(html).toContain('src="https://example.com/a.jpg"')
  })
})
