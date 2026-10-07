import { customer, outboxEvent, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import {
  askForRecentReviews,
  optOutOfReviewEmails,
  queueDueReviewRequests,
  reviewRequestEmail,
  scheduleReviewRequests,
} from '../src/requests'
import { reviewRequest } from '../src/schema'
import { defaultReviewsSettings, type ReviewsSettings } from '../src/settings'
import { submitReview } from '../src/submit'
import { openRequestLink, openUnsubscribeToken } from '../src/tokens'
import { addCustomer, addOrder, addProduct, app, owner, seedStore } from './helpers'

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

const DAY = 24 * 60 * 60 * 1000
const t0 = new Date('2026-10-01T10:00:00Z')
const at = (days: number) => new Date(t0.getTime() + days * DAY)
const settings = defaultReviewsSettings
const opts = { secret: 'secret', storefrontUrl: 'https://shop.example' }

async function setup() {
  const storeId = await seedStore()
  const a = await addProduct(storeId, 'veil')
  const b = await addProduct(storeId, 'cable')
  const o = await addOrder(storeId, {
    email: 'Buyer@Example.com',
    variantIds: [a.variantId, b.variantId],
  })
  return { storeId, a, b, o }
}

const outbox = () => owner.select().from(outboxEvent)

describe('review requests', () => {
  it('plans one request per product, once, due after the delivery wait', async () => {
    const { storeId, o } = await setup()
    const plan = () =>
      withStore(app, storeId, (tx) => scheduleReviewRequests(tx, storeId, o.orderId, settings, t0))
    expect(await plan()).toBe(2)
    expect(await plan()).toBe(0)
    const rows = await owner.select().from(reviewRequest)
    expect(rows.map((r) => r.dueAt.getTime())).toEqual([at(7).getTime(), at(7).getTime()])
    expect(rows[0]?.email).toBe('buyer@example.com')
  })

  it('plans nothing when the emails are off or the customer unsubscribed', async () => {
    const { storeId, a } = await setup()
    const off: ReviewsSettings = {
      ...settings,
      requestEmail: { ...settings.requestEmail, enabled: false },
    }
    const o2 = await addOrder(storeId, { email: 'x@example.com', variantIds: [a.variantId] })
    expect(
      await withStore(app, storeId, (tx) =>
        scheduleReviewRequests(tx, storeId, o2.orderId, off, t0),
      ),
    ).toBe(0)
    const cu = await addCustomer(storeId, 'gone@example.com')
    await owner.update(customer).set({ unsubscribedAt: t0 }).where(eq(customer.id, cu))
    const o3 = await addOrder(storeId, {
      email: 'gone@example.com',
      customerId: cu,
      variantIds: [a.variantId],
    })
    expect(
      await withStore(app, storeId, (tx) =>
        scheduleReviewRequests(tx, storeId, o3.orderId, settings, t0),
      ),
    ).toBe(0)
  })

  it('queues the request when due, then one reminder, through the outbox', async () => {
    const { storeId, o } = await setup()
    await withStore(app, storeId, (tx) =>
      scheduleReviewRequests(tx, storeId, o.orderId, settings, t0),
    )
    const sweep = (now: Date) =>
      withStore(app, storeId, (tx) => queueDueReviewRequests(tx, storeId, settings, now))
    expect(await sweep(at(6))).toEqual({ requests: 0, reminders: 0 })
    expect(await sweep(at(7))).toEqual({ requests: 1, reminders: 0 })
    expect(await sweep(at(8))).toEqual({ requests: 0, reminders: 0 })
    const events = await outbox()
    expect(events.map((e) => e.payload)).toEqual([
      { orderId: o.orderId, reviewRequestKind: 'request' },
    ])
    const email = await withStore(app, storeId, (tx) =>
      reviewRequestEmail(tx, storeId, o.orderId, 'request', settings, opts),
    )
    expect(email?.to).toBe('buyer@example.com')
    expect(email?.data.review.subject).toMatch(/^How was your (veil|cable)\?$/)
    expect(email?.data.review.items).toHaveLength(2)
    const link = new URL(email?.data.review.items[0]?.url ?? '')
    expect(link.origin).toBe('https://shop.example')
    expect(openRequestLink('secret', link.searchParams.get('review'), storeId)?.orderId).toBe(
      o.orderId,
    )
    expect(await sweep(at(12))).toEqual({ requests: 0, reminders: 1 })
    expect(await sweep(at(20))).toEqual({ requests: 0, reminders: 0 })
  })

  it('stops for reviewed products and for an address that opted out', async () => {
    const { storeId, a, o } = await setup()
    await withStore(app, storeId, (tx) =>
      scheduleReviewRequests(tx, storeId, o.orderId, settings, t0),
    )
    await withStore(app, storeId, (tx) => queueDueReviewRequests(tx, storeId, settings, at(7)))
    await withStore(app, storeId, (tx) =>
      submitReview(
        tx,
        storeId,
        {
          productId: a.productId,
          rating: 5,
          title: '',
          body: 'Love it',
          name: 'B',
          email: '',
          photoMediaIds: [],
          requestLink: { orderId: o.orderId, productId: a.productId },
        },
        settings,
        at(8),
      ),
    )
    const email = await withStore(app, storeId, (tx) =>
      reviewRequestEmail(tx, storeId, o.orderId, 'request', settings, opts),
    )
    expect(email?.data.review.items).toHaveLength(1)
    const unsubscribe = new URL(email?.data.review.unsubscribeUrl ?? '')
    const requestId = openUnsubscribeToken('secret', unsubscribe.searchParams.get('t'), storeId)
    expect(requestId).toBeTruthy()
    expect(
      await withStore(app, storeId, (tx) => optOutOfReviewEmails(tx, requestId as string)),
    ).toBe(true)
    expect(
      await withStore(app, storeId, (tx) => queueDueReviewRequests(tx, storeId, settings, at(20))),
    ).toEqual({ requests: 0, reminders: 0 })
    const later = await addOrder(storeId, { email: 'buyer@example.com', variantIds: [a.variantId] })
    expect(
      await withStore(app, storeId, (tx) =>
        scheduleReviewRequests(tx, storeId, later.orderId, settings, at(21)),
      ),
    ).toBe(0)
  })

  it('asks recent delivered orders on request, only when the emails are on', async () => {
    const { storeId } = await setup()
    const now = new Date()
    const r = await withStore(app, storeId, (tx) => askForRecentReviews(tx, storeId, settings, now))
    expect(r).toEqual({ orders: 1, requests: 2 })
    const off: ReviewsSettings = {
      ...settings,
      requestEmail: { ...settings.requestEmail, enabled: false },
    }
    await expect(
      withStore(app, storeId, (tx) => askForRecentReviews(tx, storeId, off, now)),
    ).rejects.toMatchObject({ code: 'REVIEW_EMAILS_OFF' })
    expect(
      await withStore(app, storeId, (tx) => queueDueReviewRequests(tx, storeId, settings, now)),
    ).toEqual({ requests: 1, reminders: 0 })
  })
})
