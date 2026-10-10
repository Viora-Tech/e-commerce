import { CommerceError, insertOutboxEvent } from '@commerce/core'
import {
  customer,
  media,
  order,
  orderLine,
  product,
  productMedia,
  type StoreTx,
  variant,
} from '@commerce/db'
import { and, eq, gt, inArray, isNotNull, isNull, lte, sql } from 'drizzle-orm'
import { reviewRequest } from './schema'
import { type ReviewsSettings, requestSubject } from './settings'
import { requestLinkToken, unsubscribeToken } from './tokens'

const DAY = 24 * 60 * 60 * 1000

/** A request that fell this far behind (the app was off, the worker was down) is never sent. */
const REQUEST_STALE_AFTER_MS = 30 * DAY

/** How far back "Ask for reviews" looks for delivered orders. */
const ASK_LOOKBACK_DAYS = 60

/** An address that asked for no more review emails, or a customer who unsubscribed. */
async function optedOut(tx: StoreTx, email: string, customerId: string | null): Promise<boolean> {
  const [stopped] = await tx
    .select({ id: reviewRequest.id })
    .from(reviewRequest)
    .where(and(sql`lower(${reviewRequest.email}) = ${email}`, isNotNull(reviewRequest.optedOutAt)))
    .limit(1)
  if (stopped) return true
  if (!customerId) return false
  const [cu] = await tx
    .select({ unsubscribedAt: customer.unsubscribedAt, erasedAt: customer.anonymisedAt })
    .from(customer)
    .where(eq(customer.id, customerId))
  return Boolean(cu?.unsubscribedAt || cu?.erasedAt)
}

/**
 * Plans one review request per product of a delivered order, due `daysAfterDelivery`
 * later (`dueAt` overrides it, for "Ask for reviews"). Idempotent: an order and product
 * get one request ever. Nothing is planned when request emails are off, the order has no
 * email, or the shopper opted out of review emails or marketing.
 */
export async function scheduleReviewRequests(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  settings: ReviewsSettings,
  now: Date = new Date(),
  dueAt?: Date,
): Promise<number> {
  if (!settings.requestEmail.enabled) return 0
  const [o] = await tx
    .select({ email: order.email, customerId: order.customerId, status: order.status })
    .from(order)
    .where(eq(order.id, orderId))
  const email = o?.email?.trim().toLowerCase()
  if (!o || !email || o.status === 'cancelled' || o.status === 'draft') return 0
  if (await optedOut(tx, email, o.customerId)) return 0
  const lines = await tx
    .selectDistinct({ productId: variant.productId })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .where(and(eq(orderLine.orderId, orderId), eq(orderLine.giftCard, false)))
  if (lines.length === 0) return 0
  const due = dueAt ?? new Date(now.getTime() + settings.requestEmail.daysAfterDelivery * DAY)
  const rows = await tx
    .insert(reviewRequest)
    .values(lines.map((l) => ({ storeId, orderId, productId: l.productId, email, dueAt: due })))
    .onConflictDoNothing()
    .returning({ id: reviewRequest.id })
  return rows.length
}

/**
 * The worker's sweep for one store: every order whose requests are due gets one
 * `review.request_due` outbox row (the relay queues the email), and every order still
 * without a review `reminderDays` after its request gets the one reminder. Rows are marked
 * in the same transaction, so a request is queued once however often the sweep runs.
 */
export async function queueDueReviewRequests(
  tx: StoreTx,
  storeId: string,
  settings: ReviewsSettings,
  now: Date = new Date(),
): Promise<{ requests: number; reminders: number }> {
  if (!settings.requestEmail.enabled) return { requests: 0, reminders: 0 }
  const open = and(isNull(reviewRequest.reviewedAt), isNull(reviewRequest.optedOutAt))
  const due = await tx
    .select({ id: reviewRequest.id, orderId: reviewRequest.orderId })
    .from(reviewRequest)
    .where(
      and(
        open,
        isNull(reviewRequest.sentAt),
        lte(reviewRequest.dueAt, now),
        gt(reviewRequest.dueAt, new Date(now.getTime() - REQUEST_STALE_AFTER_MS)),
      ),
    )
    .limit(500)
  const requests = await markAndQueue(tx, storeId, due, 'request', now)
  let reminders = 0
  if (settings.requestEmail.reminderDays > 0) {
    const cutoff = new Date(now.getTime() - settings.requestEmail.reminderDays * DAY)
    const late = await tx
      .select({ id: reviewRequest.id, orderId: reviewRequest.orderId })
      .from(reviewRequest)
      .where(
        and(
          open,
          isNull(reviewRequest.reminderSentAt),
          lte(reviewRequest.sentAt, cutoff),
          gt(reviewRequest.sentAt, new Date(cutoff.getTime() - REQUEST_STALE_AFTER_MS)),
        ),
      )
      .limit(500)
    reminders = await markAndQueue(tx, storeId, late, 'reminder', now)
  }
  return { requests, reminders }
}

async function markAndQueue(
  tx: StoreTx,
  storeId: string,
  rows: { id: string; orderId: string }[],
  kind: 'request' | 'reminder',
  now: Date,
): Promise<number> {
  if (rows.length === 0) return 0
  await tx
    .update(reviewRequest)
    .set(kind === 'request' ? { sentAt: now } : { reminderSentAt: now })
    .where(
      inArray(
        reviewRequest.id,
        rows.map((r) => r.id),
      ),
    )
  const orders = [...new Set(rows.map((r) => r.orderId))]
  for (const orderId of orders) {
    await insertOutboxEvent(tx, storeId, 'review.request_due', {
      orderId,
      reviewRequestKind: kind,
    })
  }
  return orders.length
}

/**
 * The review request (or reminder) email for one order: who to, the products still to
 * review, each with its own signed link, the merchant's subject and the stop link. Null
 * when nothing is left to ask (all reviewed, opted out meanwhile).
 */
export async function reviewRequestEmail(
  tx: StoreTx,
  storeId: string,
  orderId: string,
  kind: 'request' | 'reminder',
  settings: ReviewsSettings,
  opts: { secret: string; storefrontUrl: string },
) {
  const rows = await tx
    .select({
      id: reviewRequest.id,
      email: reviewRequest.email,
      productId: reviewRequest.productId,
      title: product.title,
      handle: product.handle,
      image: sql<
        string | null
      >`(select m.url from ${productMedia} pm join ${media} m on m.id = pm.media_id where pm.product_id = "product"."id" order by pm.position asc limit 1)`,
    })
    .from(reviewRequest)
    .innerJoin(product, eq(product.id, reviewRequest.productId))
    .where(
      and(
        eq(reviewRequest.orderId, orderId),
        isNull(reviewRequest.reviewedAt),
        isNull(reviewRequest.optedOutAt),
        kind === 'request'
          ? isNotNull(reviewRequest.sentAt)
          : isNotNull(reviewRequest.reminderSentAt),
      ),
    )
  const first = rows[0]
  if (!first) return null
  const [o] = await tx
    .select({ number: order.number, customerId: order.customerId })
    .from(order)
    .where(eq(order.id, orderId))
  const [cu] = o?.customerId
    ? await tx.select({ name: customer.name }).from(customer).where(eq(customer.id, o.customerId))
    : []
  const base = opts.storefrontUrl.replace(/\/+$/, '')
  const items = rows.map((r) => ({
    title: r.title,
    imageUrl: r.image ?? undefined,
    url: `${base}/products/${encodeURIComponent(r.handle)}?review=${requestLinkToken(opts.secret, { storeId, orderId, productId: r.productId })}#reviews`,
  }))
  const unsubscribeUrl = `${base}/reviews/unsubscribe?t=${unsubscribeToken(opts.secret, storeId, first.id)}`
  return {
    to: first.email,
    data: {
      orderNumber: o?.number,
      customerName: cu?.name?.split(' ')[0] || 'there',
      review: {
        subject: requestSubject(settings.requestEmail.subject, first.title),
        items,
        unsubscribeUrl,
      },
      // Each product gets its own link (the first is also the button), then the stop link.
      links: [
        ...items.map((i) => ({ label: `Review ${i.title}`, url: i.url })),
        { label: 'Stop review emails', url: unsubscribeUrl },
      ],
    },
  }
}

/** The stop link: no more review emails to this address from this store. */
export async function optOutOfReviewEmails(
  tx: StoreTx,
  requestId: string,
  now: Date = new Date(),
): Promise<boolean> {
  const [r] = await tx
    .select({ email: reviewRequest.email })
    .from(reviewRequest)
    .where(eq(reviewRequest.id, requestId))
  if (!r) return false
  await tx
    .update(reviewRequest)
    .set({ optedOutAt: now })
    .where(
      and(
        sql`lower(${reviewRequest.email}) = ${r.email.toLowerCase()}`,
        isNull(reviewRequest.optedOutAt),
      ),
    )
  return true
}

/**
 * "Ask for reviews": plans requests, due now, for orders delivered in the last
 * `ASK_LOOKBACK_DAYS` days that were never asked. The sweep sends them within minutes.
 */
export async function askForRecentReviews(
  tx: StoreTx,
  storeId: string,
  settings: ReviewsSettings,
  now: Date = new Date(),
): Promise<{ orders: number; requests: number }> {
  if (!settings.requestEmail.enabled) {
    throw new CommerceError('REVIEW_EMAILS_OFF', 'Turn on review request emails in Settings first')
  }
  const delivered = await tx
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        inArray(order.fulfillmentStatus, ['delivered', 'partially_delivered']),
        gt(order.placedAt, new Date(now.getTime() - ASK_LOOKBACK_DAYS * DAY)),
        isNotNull(order.email),
      ),
    )
    .limit(1000)
  let orders = 0
  let requests = 0
  for (const o of delivered) {
    const n = await scheduleReviewRequests(tx, storeId, o.id, settings, now, now)
    if (n > 0) orders += 1
    requests += n
  }
  return { orders, requests }
}
