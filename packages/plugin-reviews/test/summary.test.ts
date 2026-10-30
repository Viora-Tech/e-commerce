import { withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { setReviewStatus } from '../src/reviews'
import { review, reviewSummary } from '../src/schema'
import {
  markSummariesStale,
  productSummary,
  saveSummary,
  staleSummaries,
  summarySource,
} from '../src/summary'
import { addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

async function addReviews(storeId: string, productId: string, n: number) {
  const rows = await owner
    .insert(review)
    .values(
      Array.from({ length: n }, (_, i) => ({
        storeId,
        productId,
        rating: 5,
        body: `Lovely ${i}`,
        status: 'pending' as const,
      })),
    )
    .returning({ id: review.id })
  return rows.map((r) => r.id)
}

describe('review summaries', () => {
  it('goes stale when reviews are published, and is read back once written', async () => {
    const storeId = await seedStore()
    const p = await addProduct(storeId, 'veil')
    const ids = await addReviews(storeId, p.productId, 3)
    await withStore(app, storeId, (tx) => setReviewStatus(tx, ids, 'published'))
    const stale = await withStore(app, storeId, (tx) => staleSummaries(tx))
    expect(stale).toEqual([{ productId: p.productId }])

    const source = await withStore(app, storeId, (tx) => summarySource(tx, p.productId))
    expect(source.productTitle).toBe('veil')
    expect(source.reviews).toHaveLength(3)

    await withStore(app, storeId, (tx) =>
      saveSummary(tx, p.productId, { summary: 'Customers like it.', reviewCount: 3 }),
    )
    expect(await withStore(app, storeId, (tx) => staleSummaries(tx))).toEqual([])
    expect(await withStore(app, storeId, (tx) => productSummary(tx, p.productId))).toEqual({
      text: 'Customers like it.',
      reviewCount: 3,
    })

    // A failed refresh keeps the last good text and records why.
    await withStore(app, storeId, (tx) => markSummariesStale(tx, storeId, [p.productId, null]))
    await withStore(app, storeId, (tx) => saveSummary(tx, p.productId, { error: 'quota' }))
    const [row] = await owner.select().from(reviewSummary)
    expect(row).toMatchObject({ summary: 'Customers like it.', error: 'quota', stale: false })
  })

  it('shows nothing below three reviews', async () => {
    const storeId = await seedStore()
    const p = await addProduct(storeId, 'veil')
    await withStore(app, storeId, (tx) => markSummariesStale(tx, storeId, [p.productId]))
    await withStore(app, storeId, (tx) =>
      saveSummary(tx, p.productId, { summary: 'Too early.', reviewCount: 2 }),
    )
    expect(await withStore(app, storeId, (tx) => productSummary(tx, p.productId))).toBeNull()
  })
})
