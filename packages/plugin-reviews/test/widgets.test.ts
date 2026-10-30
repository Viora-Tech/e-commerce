import { media, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { review, reviewMedia } from '../src/schema'
import { defaultReviewsSettings, type ReviewsSettings } from '../src/settings'
import { storeWidgetReviews, WIDGET_REVIEWS_MAX, widgetQuery } from '../src/widgets'
import { addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const noPhotos: ReviewsSettings = {
  ...defaultReviewsSettings,
  storefront: { ...defaultReviewsSettings.storefront, showPhotos: false },
}

async function addReview(
  storeId: string,
  values: Partial<typeof review.$inferInsert> & { photo?: string },
) {
  const { photo, ...rest } = values
  const [r] = await owner
    .insert(review)
    .values({ storeId, rating: 5, status: 'published', reviewerName: 'Aarav Mehta', ...rest })
    .returning()
  if (!r) throw new Error('seed')
  if (photo) {
    const [m] = await owner.insert(media).values({ storeId, url: photo }).returning()
    await owner.insert(reviewMedia).values({ storeId, reviewId: r.id, mediaId: m?.id as string })
  }
  return r.id
}

describe('widget query', () => {
  it('keeps limits in range and the products tidy', () => {
    expect(widgetQuery({ limit: 0, minRating: 9, productHandles: [' a ', 'a', ''] })).toEqual({
      limit: 1,
      minRating: 5,
      withPhotos: false,
      productHandles: ['a'],
    })
    expect(widgetQuery({ limit: 10_000 }).limit).toBe(WIDGET_REVIEWS_MAX)
  })
})

describe('store widget reviews', () => {
  it('lists published reviews only, featured first, with short names and the summary', async () => {
    const storeId = await seedStore()
    const pad = await addProduct(storeId, 'glide-pad')
    await addReview(storeId, {
      productId: pad.productId,
      title: 'Old',
      createdAt: new Date('2026-01-01'),
    })
    await addReview(storeId, {
      productId: pad.productId,
      title: 'Pinned',
      rating: 4,
      featured: true,
      createdAt: new Date('2025-01-01'),
    })
    await addReview(storeId, { productId: pad.productId, title: 'Waiting', status: 'pending' })
    await addReview(storeId, { productId: pad.productId, title: 'Hidden', status: 'hidden' })
    await addReview(storeId, { title: 'Store review' })

    const out = await withStore(app, storeId, (tx) =>
      storeWidgetReviews(tx, defaultReviewsSettings, { limit: 10 }),
    )
    expect(out.reviews.map((r) => r.title)).toEqual(['Pinned', 'Store review', 'Old'])
    expect(out.reviews[0]).toMatchObject({
      name: 'Aarav M.',
      product: { title: 'glide-pad', handle: 'glide-pad' },
    })
    expect(out.reviews[1]?.product).toBeNull()
    expect(out.summary).toEqual({ rating: 4.7, count: 3, stars: [0, 0, 0, 1, 2] })
  })

  it('filters by stars, products and photos', async () => {
    const storeId = await seedStore()
    const pad = await addProduct(storeId, 'glide-pad')
    const veil = await addProduct(storeId, 'veil-pad')
    await addReview(storeId, { productId: pad.productId, title: 'Pad 3', rating: 3 })
    await addReview(storeId, {
      productId: veil.productId,
      title: 'Veil 5',
      photo: 'https://cdn.test/v.jpg',
    })
    const read = (settings: ReviewsSettings, q: Parameters<typeof widgetQuery>[0]) =>
      withStore(app, storeId, (tx) => storeWidgetReviews(tx, settings, q))

    expect((await read(defaultReviewsSettings, { limit: 10, minRating: 4 })).reviews).toHaveLength(
      1,
    )
    const pads = await read(defaultReviewsSettings, { limit: 10, productHandles: ['glide-pad'] })
    expect(pads.reviews.map((r) => r.title)).toEqual(['Pad 3'])
    expect(pads.summary.count).toBe(1)
    const photos = await read(defaultReviewsSettings, { limit: 10, withPhotos: true })
    expect(photos.reviews.map((r) => r.photos)).toEqual([['https://cdn.test/v.jpg']])
    // A store that hides customer photos shows none, and its photo grid has nothing.
    expect((await read(noPhotos, { limit: 10 })).reviews.every((r) => r.photos.length === 0)).toBe(
      true,
    )
    expect((await read(noPhotos, { limit: 10, withPhotos: true })).reviews).toEqual([])
    expect(
      (await read(defaultReviewsSettings, { limit: 10, productHandles: ['gone'] })).reviews,
    ).toEqual([])
  })

  it("never shows another store's reviews", async () => {
    const a = await seedStore()
    const b = await seedStore()
    await addReview(a, { title: 'Mine' })
    const out = await withStore(app, b, (tx) =>
      storeWidgetReviews(tx, defaultReviewsSettings, { limit: 10 }),
    )
    expect(out.reviews).toEqual([])
    expect(out.summary.count).toBe(0)
  })
})
