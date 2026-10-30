import { order, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  askPastOrders,
  checkPastOrdersRange,
  previewPastOrders,
  staggeredDue,
} from '../src/past-orders'
import { scheduleReviewRequests } from '../src/requests'
import { review, reviewRequest } from '../src/schema'
import { defaultReviewsSettings, PAST_ORDERS_PER_HOUR } from '../src/settings'
import { addOrder, addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DAY = 24 * 60 * 60 * 1000
const HOUR = 60 * 60 * 1000
const now = new Date('2026-10-31T10:00:00Z')
const settings = defaultReviewsSettings
const range = { from: new Date(now.getTime() - 30 * DAY), to: now }

describe('past orders: pure parts', () => {
  it('spreads a run at PAST_ORDERS_PER_HOUR orders an hour', () => {
    expect(staggeredDue(now, 0)).toEqual(now)
    expect(staggeredDue(now, PAST_ORDERS_PER_HOUR - 1)).toEqual(now)
    expect(staggeredDue(now, PAST_ORDERS_PER_HOUR).getTime()).toBe(now.getTime() + HOUR)
  })

  it('refuses reversed, future and over-long ranges', () => {
    expect(() => checkPastOrdersRange({ from: now, to: range.from }, now)).toThrow()
    expect(() =>
      checkPastOrdersRange({ from: new Date(now.getTime() + DAY), to: now }, now),
    ).toThrow()
    expect(() =>
      checkPastOrdersRange({ from: new Date(now.getTime() - 400 * DAY), to: now }, now),
    ).toThrow()
    expect(() => checkPastOrdersRange(range, now)).not.toThrow()
  })
})

describe('past orders', () => {
  it('previews and asks delivered orders in the range with no review and no request', async () => {
    const storeId = await seedStore()
    const a = await addProduct(storeId, 'veil')
    const fresh = await addOrder(storeId, { email: 'one@example.com', variantIds: [a.variantId] })
    const asked = await addOrder(storeId, { email: 'two@example.com', variantIds: [a.variantId] })
    const reviewed = await addOrder(storeId, {
      email: 'three@example.com',
      variantIds: [a.variantId],
    })
    const old = await addOrder(storeId, { email: 'four@example.com', variantIds: [a.variantId] })
    const inRange = new Date(now.getTime() - 5 * DAY)
    for (const id of [fresh.orderId, asked.orderId, reviewed.orderId]) {
      await owner.update(order).set({ deliveredAt: inRange }).where(eq(order.id, id))
    }
    await owner
      .update(order)
      .set({ deliveredAt: new Date(now.getTime() - 90 * DAY) })
      .where(eq(order.id, old.orderId))
    await withStore(app, storeId, (tx) =>
      scheduleReviewRequests(tx, storeId, asked.orderId, settings, now),
    )
    await owner.insert(review).values({
      storeId,
      productId: a.productId,
      orderId: reviewed.orderId,
      rating: 5,
    })

    const preview = await withStore(app, storeId, (tx) =>
      previewPastOrders(tx, settings, range, now),
    )
    expect(preview).toEqual({ orders: 1, capped: false, hours: 0 })

    const r = await withStore(app, storeId, (tx) =>
      askPastOrders(tx, storeId, settings, range, now),
    )
    expect(r).toEqual({ orders: 1, requests: 1, capped: false })
    const rows = await owner
      .select()
      .from(reviewRequest)
      .where(eq(reviewRequest.orderId, fresh.orderId))
    // The other order's request is due in 7 days, so it does not hold this run back.
    expect(rows[0]?.dueAt).toEqual(now)
    // A second run straight after waits an hour behind the first one's waiting request.
    const again = await addOrder(storeId, {
      email: 'five@example.com',
      variantIds: [a.variantId],
    })
    await owner.update(order).set({ deliveredAt: inRange }).where(eq(order.id, again.orderId))
    expect(
      await withStore(app, storeId, (tx) => previewPastOrders(tx, settings, range, now)),
    ).toEqual({ orders: 1, capped: false, hours: 1 })
    await withStore(app, storeId, (tx) => askPastOrders(tx, storeId, settings, range, now))
    const [later] = await owner
      .select()
      .from(reviewRequest)
      .where(eq(reviewRequest.orderId, again.orderId))
    expect(later?.dueAt.getTime()).toBe(now.getTime() + HOUR)

    expect(
      await withStore(app, storeId, (tx) => previewPastOrders(tx, settings, range, now)),
    ).toMatchObject({ orders: 0 })
  })

  it('refuses when requests are off', async () => {
    const storeId = await seedStore()
    const off = { ...settings, requestEmail: { ...settings.requestEmail, enabled: false } }
    await expect(
      withStore(app, storeId, (tx) => askPastOrders(tx, storeId, off, range, now)),
    ).rejects.toMatchObject({ code: 'REVIEW_EMAILS_OFF' })
  })
})
