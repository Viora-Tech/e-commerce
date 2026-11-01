import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import ReviewsFloatingTab from '../src/components/reviews/widgets/reviews-floating-tab'
import { createBlocksConfig, REVIEWS_WIDGET_SECTIONS } from '../src/puck-config'
import {
  clipText,
  filterReviews,
  parseHandles,
  reviewDate,
  starFilters,
  topReview,
  widgetState,
} from '../src/reviews-widgets'
import { renderBlock } from '../src/slots'
import type {
  PublicReviewCard,
  ReviewsWidgetContext,
  StoreReviewCard,
  StoreReviews,
  StoreReviewsQuery,
} from '../src/types'

const card = (over: Partial<StoreReviewCard> = {}): StoreReviewCard => ({
  id: crypto.randomUUID(),
  rating: 5,
  title: 'Smooth and fast',
  body: 'Glide is unreal.',
  name: 'Aarav M.',
  verified: true,
  createdAt: '2026-10-12T08:00:00.000Z',
  product: { title: 'Glide pad', handle: 'glide-pad' },
  photos: [],
  ...over,
})

const DATA: StoreReviews = {
  summary: { rating: 4.5, count: 2, stars: [0, 0, 0, 1, 1] },
  reviews: [card(), card({ rating: 4, name: 'Priya S.', photos: ['https://cdn.test/p.jpg'] })],
}

describe('reviews widgets helpers', () => {
  it('reads the products setting as handles', () => {
    expect(parseHandles(' Glide-Pad, veil-pad\nglide-pad ,, ')).toEqual(['glide-pad', 'veil-pad'])
    expect(parseHandles('')).toEqual([])
    expect(parseHandles(undefined)).toEqual([])
  })

  it('dates a review the same way everywhere', () => {
    expect(reviewDate('2026-10-12T23:30:00.000Z')).toBe('12 Oct 2026')
    expect(reviewDate('nope')).toBe('')
  })

  it('filters by stars and photos, and offers only stars that have reviews', () => {
    expect(filterReviews(DATA.reviews, 'all')).toHaveLength(2)
    expect(filterReviews(DATA.reviews, 4).map((r) => r.name)).toEqual(['Priya S.'])
    expect(filterReviews(DATA.reviews, 'photos').map((r) => r.name)).toEqual(['Priya S.'])
    expect(starFilters([0, 2, 0, 1, 5])).toEqual([5, 4, 2])
  })

  it('quotes the best good review, never a complaint', () => {
    const r = (over: Partial<PublicReviewCard>): PublicReviewCard => ({
      id: crypto.randomUUID(),
      rating: 5,
      title: '',
      body: 'Good',
      name: 'A',
      verified: false,
      helpful: 0,
      reply: null,
      whenLabel: 'Today',
      photos: [],
      ...over,
    })
    expect(topReview([r({ rating: 2, body: 'Bad' })])).toBeNull()
    const best = r({ rating: 5, helpful: 9, body: 'Loved it' })
    expect(topReview([r({ rating: 4, helpful: 20 }), r({ rating: 5 }), best])).toBe(best)
    expect(topReview([r({ rating: 5, body: '   ' })])).toBeNull()
  })

  it('clips long quotes at a word', () => {
    expect(clipText('short one', 50)).toBe('short one')
    expect(clipText('one two three four five six', 15)).toBe('one two three…')
  })

  it('tells why a section has nothing to draw', () => {
    expect(widgetState(null).kind).toBe('notInstalled')
    expect(widgetState(undefined).kind).toBe('empty')
    expect(widgetState({ ...DATA, reviews: [] }).kind).toBe('empty')
    expect(widgetState(DATA).kind).toBe('ready')
  })
})

type Config = ReturnType<typeof createBlocksConfig>
type Resolvable = {
  defaultProps: Record<string, unknown>
  resolveData?: (data: { props: Record<string, unknown> }) => Promise<{ props: object }>
}

async function draw(
  config: Config,
  type: string,
  opts: { editing?: boolean; over?: Record<string, unknown>; meta?: object } = {},
) {
  const component = config.components[type as never] as unknown as Resolvable
  const props = { ...component.defaultProps, id: type, ...opts.over }
  const resolved = component.resolveData ? await component.resolveData({ props }) : { props: {} }
  return renderToStaticMarkup(
    <div>
      {renderBlock(
        { type, props: { ...props, ...resolved.props } },
        config.components as unknown as Parameters<typeof renderBlock>[1],
        { isEditing: opts.editing === true, metadata: opts.meta ?? {} },
      )}
    </div>,
  )
}

describe('Reviews app sections', () => {
  const asked: StoreReviewsQuery[] = []
  const withReviews = createBlocksConfig(async () => [], {
    loadReviews: async (query) => {
      asked.push(query)
      return DATA
    },
  })
  const noApp = createBlocksConfig(async () => [], { loadReviews: async () => null })
  const noReviews = createBlocksConfig(async () => [], {
    loadReviews: async () => ({
      summary: { rating: 0, count: 0, stars: [0, 0, 0, 0, 0] },
      reviews: [],
    }),
  })
  const storeWide = REVIEWS_WIDGET_SECTIONS.filter(
    (t) => t !== 'reviews/Snippet' && t !== 'reviews/Summary' && t !== 'reviews/Questions',
  )

  it('are on the Apps tab, by Reviews, only while the app is installed', () => {
    const on = createBlocksConfig(async () => [], {}, [], new Set(['reviews']))
    expect(on.categories?.apps?.components).toEqual(expect.arrayContaining(REVIEWS_WIDGET_SECTIONS))
    expect(on.appBlockOwners['reviews/Carousel']?.appName).toBe('Reviews')
    const off = createBlocksConfig(async () => [])
    expect(off.categories?.apps?.components).not.toContain('reviews/Carousel')
    // Saved placements still render after an uninstall.
    expect(off.components['reviews/Carousel' as never]).toBeDefined()
  })

  for (const type of storeWide) {
    it(`${type} draws the loaded reviews`, async () => {
      const html = await draw(withReviews, type)
      expect(html).toContain('section-frame')
      if (type === 'reviews/Photos') expect(html).toContain('https://cdn.test/p.jpg')
      else expect(html).toContain('Priya S.')
    })

    it(`${type} draws nothing on the store without the app or reviews, a hint in the editor`, async () => {
      expect(await draw(noApp, type)).toBe('<div></div>')
      expect(await draw(noReviews, type)).toBe('<div></div>')
      expect(await draw(noApp, type, { editing: true })).toContain('Install the Reviews app')
      expect(await draw(noReviews, type, { editing: true })).toContain('There are none to show yet')
    })
  }

  it('asks for the settings it shows: stars, products and photos', async () => {
    asked.length = 0
    await draw(withReviews, 'reviews/Carousel', {
      over: { minRating: 5, limit: 6, products: 'glide-pad, veil-pad' },
    })
    await draw(withReviews, 'reviews/Photos')
    expect(asked[0]).toEqual({ limit: 6, minRating: 5, productHandles: ['glide-pad', 'veil-pad'] })
    expect(asked[1]).toMatchObject({ withPhotos: true })
  })

  it('the all-reviews section shows the breakdown and star filters', async () => {
    const html = await draw(withReviews, 'reviews/AllReviews')
    expect(html).toContain('Based on 2 reviews')
    expect(html).toContain('aria-pressed="true"')
    expect(html).toContain('5★')
    expect(html).toContain('With photos')
  })

  it('the snippet quotes the product page best review and links to the reviews', async () => {
    const reviews = {
      summary: { rating: 4.8, count: 12, stars: [0, 0, 0, 2, 10] },
      reviews: [
        {
          id: 'r1',
          rating: 5,
          title: '',
          body: 'Best pad I have owned.',
          name: 'Asha K.',
          verified: true,
          helpful: 3,
          reply: null,
          whenLabel: 'Today',
          photos: [],
        },
      ],
    } as unknown as ReviewsWidgetContext
    const product = { id: 'p', handle: 'glide-pad', title: 'Glide pad' }
    const html = await draw(withReviews, 'reviews/Snippet', {
      meta: { product, appBlockContext: { reviews } },
    })
    expect(html).toContain('Read all 12 reviews')
    expect(html).toContain('href="#reviews"')
    expect(html).toContain('Best pad I have owned.')
    expect(await draw(withReviews, 'reviews/Snippet', { meta: { product } })).toBe('<div></div>')
  })
})

describe('Floating reviews tab', () => {
  it('draws a closed tab with the rating, and nothing without reviews', () => {
    const html = renderToStaticMarkup(
      <ReviewsFloatingTab
        label="Reviews"
        heading="What customers say"
        position="right"
        showProduct
        data={DATA}
      />,
    )
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('4.5')
    expect(html).toContain('hidden=""')
    const none = renderToStaticMarkup(
      <ReviewsFloatingTab label="Reviews" heading="x" position="left" showProduct data={null} />,
    )
    expect(none).toBe('')
  })
})
