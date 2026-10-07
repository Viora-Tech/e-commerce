import { withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  deleteReviews,
  getReview,
  listReviews,
  ratingSummaries,
  replyToReview,
  reviewStats,
  setReviewStatus,
} from '../src/reviews'
import { review } from '../src/schema'
import {
  defaultReviewsSettings,
  displayName,
  parseReviewsSettings,
  publishDecision,
  type ReviewsSettings,
  requestSubject,
} from '../src/settings'
import { reviewsState, saveReviewsSettings } from '../src/store-settings'
import {
  markHelpful,
  parseReviewForm,
  ReviewRejected,
  type SubmitReviewInput,
  submitReview,
} from '../src/submit'
import { openRequestLink, requestLinkToken } from '../src/tokens'
import { addCustomer, addOrder, addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const anyone: ReviewsSettings = { ...defaultReviewsSettings, whoCanReview: 'anyone' }

const form = (over: Partial<SubmitReviewInput> = {}): SubmitReviewInput => ({
  productId: '',
  rating: 5,
  title: 'Smooth and fast',
  body: 'Glide is unreal.',
  name: 'Aarav Mehta',
  email: 'aarav@example.com',
  photoMediaIds: [],
  ...over,
})

describe('settings', () => {
  it('holds low ratings and photos by default, publishes the rest', () => {
    const s = defaultReviewsSettings
    expect(publishDecision(s, { rating: 5, photos: 0 })).toEqual({
      status: 'published',
      heldReason: null,
    })
    expect(publishDecision(s, { rating: 3, photos: 0 }).heldReason).toBe('rating')
    expect(publishDecision(s, { rating: 5, photos: 1 }).heldReason).toBe('photos')
    expect(publishDecision({ ...s, publishing: 'none' }, { rating: 5, photos: 0 }).status).toBe(
      'pending',
    )
    expect(
      publishDecision({ ...s, publishing: 'all', holdPhotos: false }, { rating: 1, photos: 2 }),
    ).toEqual({ status: 'published', heldReason: null })
  })

  it('reads broken settings as the defaults and fills the subject', () => {
    expect(parseReviewsSettings({ publishing: 'nope' })).toEqual(defaultReviewsSettings)
    expect(requestSubject('How was your {{ product.title }}?', 'Veil pad')).toBe(
      'How was your Veil pad?',
    )
    expect(displayName(' aarav  mehta ')).toBe('aarav M.')
    expect(displayName('Priya')).toBe('Priya')
  })

  it('saves in store.apps under the app id', async () => {
    const storeId = await seedStore()
    await withStore(app, storeId, (tx) =>
      saveReviewsSettings(tx, storeId, { ...defaultReviewsSettings, maxPerDay: 7 }),
    )
    const state = await withStore(app, storeId, (tx) => reviewsState(tx, storeId))
    expect(state.installed).toBe(false)
    expect(state.settings.maxPerDay).toBe(7)
  })
})

describe('parseReviewForm', () => {
  const read = (v: Record<string, string>) => ({ get: (k: string) => v[k] ?? null })
  const id = '0190d3c0-0000-7000-8000-000000000001'

  it('reads and caps the fields', () => {
    const r = parseReviewForm(
      read({
        product_id: id,
        rating: '4',
        title: 'x'.repeat(400),
        body: 'Good',
        name: 'A',
        email: 'A@B.CO',
      }),
      { emailKnown: false },
    )
    expect(r.ok && r.value.title.length).toBe(150)
    expect(r.ok && r.value.email).toBe('a@b.co')
  })

  it('names the wrong field', () => {
    const base = { product_id: id, rating: '4', body: 'Good', name: 'A', email: 'a@b.co' }
    expect(parseReviewForm(read({ ...base, rating: '6' }), { emailKnown: false })).toEqual({
      ok: false,
      field: 'rating',
    })
    expect(parseReviewForm(read({ ...base, body: '' }), { emailKnown: false })).toEqual({
      ok: false,
      field: 'body',
    })
    expect(parseReviewForm(read({ ...base, email: '' }), { emailKnown: false })).toEqual({
      ok: false,
      field: 'email',
    })
    expect(parseReviewForm(read({ ...base, email: '' }), { emailKnown: true }).ok).toBe(true)
  })
})

describe('submitReview', () => {
  it('only takes verified buyers by default, through their account or a request link', async () => {
    const storeId = await seedStore()
    const { productId, variantId } = await addProduct(storeId, 'veil')
    const stranger = withStore(app, storeId, (tx) =>
      submitReview(tx, storeId, form({ productId }), defaultReviewsSettings),
    )
    await expect(stranger).rejects.toMatchObject({ reason: 'not_allowed' })

    const customerId = await addCustomer(storeId, 'buyer@example.com')
    await addOrder(storeId, { email: 'buyer@example.com', customerId, variantIds: [variantId] })
    const byAccount = await withStore(app, storeId, (tx) =>
      submitReview(
        tx,
        storeId,
        form({ productId, email: '', customer: { id: customerId, email: 'buyer@example.com' } }),
        defaultReviewsSettings,
      ),
    )
    expect(byAccount).toMatchObject({ status: 'published', verified: true })

    const guest = await addOrder(storeId, { email: 'guest@example.com', variantIds: [variantId] })
    const token = requestLinkToken('secret', { storeId, orderId: guest.orderId, productId })
    const link = openRequestLink('secret', token, storeId)
    expect(openRequestLink('secret', token, await seedStore())).toBeNull()
    const byLink = await withStore(app, storeId, (tx) =>
      submitReview(
        tx,
        storeId,
        form({ productId, email: '', rating: 3, requestLink: link }),
        defaultReviewsSettings,
      ),
    )
    expect(byLink).toMatchObject({ status: 'pending', verified: true })
    const rows = await owner.select().from(review)
    expect(rows.find((r) => r.id === byLink.id)?.reviewerEmail).toBe('guest@example.com')
    expect(rows.find((r) => r.id === byLink.id)?.reviewerName).toBe('Aarav M.')
  })

  it('takes anyone when allowed, never as verified, once per product, and caps a day', async () => {
    const storeId = await seedStore()
    const products = await Promise.all(
      ['a', 'b', 'c', 'd'].map((h) => addProduct(storeId, h).then((p) => p.productId)),
    )
    const settings = { ...anyone, maxPerDay: 2 }
    const send = (productId: string) =>
      withStore(app, storeId, (tx) => submitReview(tx, storeId, form({ productId }), settings))
    expect(await send(products[0] as string)).toMatchObject({ verified: false })
    await expect(send(products[0] as string)).rejects.toMatchObject({ reason: 'already' })
    await send(products[1] as string)
    await expect(send(products[2] as string)).rejects.toBeInstanceOf(ReviewRejected)
  })

  it('refuses a draft product', async () => {
    const storeId = await seedStore()
    const { productId } = await addProduct(storeId, 'draft', { status: 'draft' })
    await expect(
      withStore(app, storeId, (tx) => submitReview(tx, storeId, form({ productId }), anyone)),
    ).rejects.toMatchObject({ reason: 'product' })
  })
})

describe('moderation and ratings', () => {
  it('keeps the average and count right through approve, hide, delete', async () => {
    const storeId = await seedStore()
    const { productId } = await addProduct(storeId, 'veil')
    const settings = { ...anyone, maxPerDay: 10, publishing: 'all' as const }
    const ids: string[] = []
    for (const [i, rating] of [5, 4, 2].entries()) {
      const r = await withStore(app, storeId, (tx) =>
        submitReview(tx, storeId, form({ productId, email: `p${i}@x.co`, rating }), settings),
      )
      ids.push(r.id)
    }
    const summary = () =>
      withStore(app, storeId, (tx) => ratingSummaries(tx, [productId])).then((m) =>
        m.get(productId),
      )
    expect(await summary()).toMatchObject({ rating: 3.7, count: 3, stars: [0, 1, 0, 1, 1] })
    await withStore(app, storeId, (tx) => setReviewStatus(tx, [ids[2] as string], 'hidden'))
    expect(await summary()).toMatchObject({ rating: 4.5, count: 2 })
    await withStore(app, storeId, (tx) => deleteReviews(tx, [ids[0] as string]))
    expect(await summary()).toMatchObject({ rating: 4, count: 1 })
    await withStore(app, storeId, (tx) => setReviewStatus(tx, [ids[2] as string], 'published'))
    expect(await summary()).toMatchObject({ rating: 3, count: 2 })
    const stats = await withStore(app, storeId, (tx) => reviewStats(tx))
    expect(stats).toMatchObject({ all: 2, published: 2, pending: 0, average: 3 })
    expect(await withStore(app, storeId, (tx) => markHelpful(tx, ids[1] as string))).toBe(1)
  })

  it('lists with filters and search, and shows the detail with its activity', async () => {
    const storeId = await seedStore()
    const { productId } = await addProduct(storeId, 'veil-glasspad')
    const r = await withStore(app, storeId, (tx) =>
      submitReview(tx, storeId, form({ productId, rating: 3 }), anyone),
    )
    const page = (input: Parameters<typeof listReviews>[1]) =>
      withStore(app, storeId, (tx) => listReviews(tx, input))
    expect((await page({ page: 1, perPage: 20 })).total).toBe(1)
    expect((await page({ page: 1, perPage: 20, status: 'published' })).total).toBe(0)
    expect((await page({ page: 1, perPage: 20, rating: 3, q: 'glasspad' })).rows[0]?.id).toBe(r.id)
    expect((await page({ page: 1, perPage: 20, hasPhotos: true })).total).toBe(0)
    const detail = await withStore(app, storeId, (tx) => getReview(tx, r.id))
    expect(detail?.activity.map((a) => a.kind)).toContain('held')
    expect(detail?.product?.title).toBe('veil-glasspad')
  })

  it('emails the first reply only', async () => {
    const storeId = await seedStore()
    const { productId } = await addProduct(storeId, 'veil')
    const r = await withStore(app, storeId, (tx) =>
      submitReview(tx, storeId, form({ productId }), anyone),
    )
    const first = await withStore(app, storeId, (tx) => replyToReview(tx, storeId, r.id, 'Thanks!'))
    const again = await withStore(app, storeId, (tx) =>
      replyToReview(tx, storeId, r.id, 'Thanks a lot!'),
    )
    expect(first.emailed).toBe(true)
    expect(again.emailed).toBe(false)
  })
})

describe('isolation between stores', () => {
  it("never shows, changes or writes another store's reviews", async () => {
    const a = await seedStore()
    const b = await seedStore()
    const { productId } = await addProduct(a, 'veil')
    const r = await withStore(app, a, (tx) => submitReview(tx, a, form({ productId }), anyone))
    expect((await withStore(app, b, (tx) => listReviews(tx, { page: 1, perPage: 20 }))).total).toBe(
      0,
    )
    expect(await withStore(app, b, (tx) => getReview(tx, r.id))).toBeNull()
    expect(await withStore(app, b, (tx) => setReviewStatus(tx, [r.id], 'hidden'))).toBe(0)
    expect(await withStore(app, b, (tx) => deleteReviews(tx, [r.id]))).toBe(0)
    expect((await withStore(app, b, (tx) => ratingSummaries(tx, [productId]))).size).toBe(0)
    // Store B cannot write a review into store A's catalogue, nor under store A's id.
    await expect(
      withStore(app, b, (tx) => submitReview(tx, b, form({ productId }), anyone)),
    ).rejects.toMatchObject({ reason: 'product' })
    await expect(
      withStore(app, b, (tx) => tx.insert(review).values({ storeId: a, productId, rating: 5 })),
    ).rejects.toThrow()
  })
})
