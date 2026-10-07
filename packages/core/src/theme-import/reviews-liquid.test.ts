/** SOURCE OF TRUTH: tests for reviews in imported themes — Shopify's `reviews.rating` / `rating_count` metafields from our ratings, and Judge.me's `shop.metafields.judgeme` data, rendered through the real engine on fake data. No database */
import { describe, expect, it } from 'vitest'
import { FIXTURE_PRODUCT, fakeDataSource } from '../../test/theme-import-fixture'
import { buildThemeBundle } from './bundle'
import { withReviewMetafields } from './data'
import type { LiquidDataSource } from './drops'
import { createPageContext } from './page-context'
import { renderLiquidSection } from './render'

let themes = 0

async function render(source: string, data: LiquidDataSource) {
  const bundle = buildThemeBundle({
    themeId: `reviews-${themes++}`,
    version: 'v1',
    textFiles: new Map([['sections/probe.liquid', source]]),
    assetChecksums: new Map(),
    settings: {},
  })
  const ctx = await createPageContext({
    bundle,
    data,
    request: {
      template: 'index',
      path: '/',
      host: 'shop.example',
      origin: 'https://shop.example',
      designMode: false,
      postedForm: null,
      nonce: '',
    },
    assetBase: '/theme-assets/x',
    shopifyHost: null,
    moneyFormat: null,
    paymentTypes: [],
  })
  let failure: unknown = null
  const html = await renderLiquidSection(
    ctx,
    { id: 'probe', type: 'probe', settings: {}, blocks: [], location: 'template', index: 0 },
    (err) => {
      failure = err
    },
  )
  if (failure) throw failure
  return html.trim()
}

/** The fixture data source with the Reviews app's ratings and Judge.me data plugged in. */
function withReviews(
  ratings: Map<string, { rating: number; count: number }>,
  judgeme: Record<string, unknown> | null,
): LiquidDataSource {
  const base = fakeDataSource()
  return {
    ...base,
    metafields: async (type, ids) => {
      const data = await base.metafields(type, ids)
      return type === 'product' ? withReviewMetafields(data, ratings) : data
    },
    judgeme: async () => judgeme,
  }
}

// What the theme's snippets/rating-stars.liquid and product-card.liquid read.
const CARD =
  "{%- assign p = all_products['mouse'] -%}{%- assign r = p.metafields.reviews.rating.value -%}[{% if r.rating != blank %}{{ r.rating }}/{{ r.scale_max }} ({{ p.metafields.reviews.rating_count.value }}){% else %}none{% endif %}]"

describe('reviews in imported themes', () => {
  it("gives a product with reviews Shopify's rating metafields", async () => {
    const data = withReviews(new Map([[FIXTURE_PRODUCT.id, { rating: 4.7, count: 58 }]]), null)
    expect(await render(CARD, data)).toBe('[4.7/5 (58)]')
  })

  it('leaves a product without reviews silent', async () => {
    const data = withReviews(new Map([[FIXTURE_PRODUCT.id, { rating: 0, count: 0 }]]), null)
    expect(await render(CARD, data)).toBe('[none]')
  })

  it('replaces a rating copied from Shopify with ours', () => {
    const old = {
      namespace: 'reviews',
      key: 'rating',
      type: 'rating' as const,
      list: false,
      measure: null,
      value: { value: 2, max: 5 },
    }
    const out = withReviewMetafields(
      { metafields: { a: [old], b: [old] }, entries: [] },
      new Map([['a', { rating: 4.5, count: 3 }]]),
    )
    expect(out.metafields.a?.find((f) => f.key === 'rating')?.value).toEqual({ value: 4.5, max: 5 })
    // No reviews of ours yet: what the importer brought stays.
    expect(out.metafields.b).toEqual([old])
  })

  it("reads Judge.me's shop data from the Reviews app, and blank without it", async () => {
    const SHOWCASE =
      "{%- assign data = shop.metafields.judgeme.reviews_grid.value -%}{{ shop.metafields.judgeme.all_reviews_rating.value }}|{{ shop.metafields.judgeme.all_reviews_count.value }}|{{ shop.metafields.judgeme['trust_badge.verified_reviews_count'].value }}|{% for review in data.all_reviews.reviews %}{{ review.reviewer_name }}:{{ review.rating }}:{{ review.pictures_urls.size }};{% endfor %}"
    const judgeme = {
      reviews_grid: {
        value: {
          all_reviews: {
            reviews: [
              { reviewer_name: 'Aarav M.', rating: 5, pictures_urls: [{ original: 'x' }] },
              { reviewer_name: 'Priya S.', rating: 4, pictures_urls: [] },
            ],
          },
        },
      },
      all_reviews_rating: { value: 4.8 },
      all_reviews_count: { value: 312 },
      'trust_badge.verified_reviews_count': { value: 290 },
    }
    expect(await render(SHOWCASE, withReviews(new Map(), judgeme))).toBe(
      '4.8|312|290|Aarav M.:5:1;Priya S.:4:0;',
    )
    expect(await render(SHOWCASE, withReviews(new Map(), null))).toBe('|||')
    expect(await render('[{{ shop.metafields.custom.anything.value }}]', fakeDataSource())).toBe(
      '[]',
    )
  })
})
