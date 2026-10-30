import { discount, media, outboxEvent, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { rewardEmailData, rewardPhotoReviews } from '../src/rewards'
import { review, reviewMedia } from '../src/schema'
import { defaultReviewsSettings, type ReviewsSettings } from '../src/settings'
import { addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const now = new Date('2026-10-31T10:00:00Z')
const on: ReviewsSettings = {
  ...defaultReviewsSettings,
  photoReward: { enabled: true, percent: 15, days: 30 },
}

async function addReview(
  storeId: string,
  productId: string,
  opts: { photo: boolean; source?: 'storefront' | 'judgeme'; status?: 'published' | 'pending' },
) {
  const [r] = await owner
    .insert(review)
    .values({
      storeId,
      productId,
      rating: 5,
      reviewerName: 'Asha K.',
      reviewerEmail: 'asha@example.com',
      status: opts.status ?? 'published',
      source: opts.source ?? 'storefront',
    })
    .returning({ id: review.id })
  if (!r) throw new Error('seed')
  if (opts.photo) {
    const [m] = await owner
      .insert(media)
      .values({ storeId, url: 'https://cdn.example/p.jpg' })
      .returning({ id: media.id })
    await owner.insert(reviewMedia).values({ storeId, reviewId: r.id, mediaId: m?.id ?? null })
  }
  return r.id
}

describe('photo review reward', () => {
  it('gives a published storefront photo review one code, once', async () => {
    const storeId = await seedStore()
    const p = await addProduct(storeId, 'veil')
    const photo = await addReview(storeId, p.productId, { photo: true })
    const plain = await addReview(storeId, p.productId, { photo: false })
    const imported = await addReview(storeId, p.productId, { photo: true, source: 'judgeme' })
    const waiting = await addReview(storeId, p.productId, { photo: true, status: 'pending' })
    const run = () =>
      withStore(app, storeId, (tx) =>
        rewardPhotoReviews(tx, storeId, [photo, plain, imported, waiting], on, now),
      )
    expect(await run()).toBe(1)
    expect(await run()).toBe(0)

    const [r] = await owner.select().from(review).where(eq(review.id, photo))
    expect(r?.rewardCode).toMatch(/^PHOTO-[A-Z0-9]{8}$/)
    const [d] = await owner
      .select()
      .from(discount)
      .where(eq(discount.code, r?.rewardCode ?? ''))
    expect(d).toMatchObject({ value: 1500, usageLimit: 1, method: 'percent' })
    expect(d?.endsAt?.getTime()).toBe(now.getTime() + 30 * 86_400_000)
    const events = await owner.select().from(outboxEvent)
    expect(events.map((e) => e.type)).toEqual(['review.rewarded'])

    const email = await withStore(app, storeId, (tx) => rewardEmailData(tx, photo))
    expect(email).toMatchObject({ email: 'asha@example.com', percent: 15, productTitle: 'veil' })
  })

  it('does nothing while the reward is off', async () => {
    const storeId = await seedStore()
    const p = await addProduct(storeId, 'veil')
    const photo = await addReview(storeId, p.productId, { photo: true })
    expect(
      await withStore(app, storeId, (tx) =>
        rewardPhotoReviews(tx, storeId, [photo], defaultReviewsSettings, now),
      ),
    ).toBe(0)
  })
})
