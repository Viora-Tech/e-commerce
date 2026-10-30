import { CommerceError } from '@commerce/core'
import { order, type StoreTx } from '@commerce/db'
import { and, desc, gte, inArray, isNull, lte, notExists, or, sql } from 'drizzle-orm'
import { scheduleReviewRequests } from './requests'
import { review, reviewRequest } from './schema'
import {
  PAST_ORDERS_MAX,
  PAST_ORDERS_MAX_DAYS,
  PAST_ORDERS_PER_HOUR,
  type ReviewsSettings,
} from './settings'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

export type PastOrdersRange = { from: Date; to: Date }

/** The range checked: not reversed, not in the future, at most `PAST_ORDERS_MAX_DAYS` long. */
export function checkPastOrdersRange(range: PastOrdersRange, now: Date = new Date()) {
  if (Number.isNaN(range.from.getTime()) || Number.isNaN(range.to.getTime())) {
    throw new CommerceError('REVIEW_RANGE_INVALID', 'Pick a start and an end date')
  }
  if (range.from > range.to) {
    throw new CommerceError('REVIEW_RANGE_INVALID', 'The start date is after the end date')
  }
  if (range.from > now) {
    throw new CommerceError('REVIEW_RANGE_INVALID', 'The start date is in the future')
  }
  if (range.to.getTime() - range.from.getTime() > PAST_ORDERS_MAX_DAYS * DAY) {
    throw new CommerceError('REVIEW_RANGE_INVALID', 'Pick a range of one year or less')
  }
}

/**
 * When the i-th order of a run is due: `PAST_ORDERS_PER_HOUR` orders an hour, starting at
 * `start` (now, or after requests an earlier run still has waiting).
 */
export function staggeredDue(start: Date, index: number): Date {
  return new Date(start.getTime() + Math.floor(index / PAST_ORDERS_PER_HOUR) * HOUR)
}

/**
 * Delivered orders in the range (by delivery date, or the order date when the delivery date is
 * unknown, as on imported orders) that have no review and were never asked, newest first, up to
 * one more than `PAST_ORDERS_MAX` so the caller can tell the list was cut.
 */
async function candidates(tx: StoreTx, settings: ReviewsSettings, range: PastOrdersRange) {
  const when = sql`coalesce(${order.deliveredAt}, ${order.placedAt})`
  const channel = settings.requestEmail.channel
  const reachable =
    channel === 'email'
      ? sql`nullif(trim(${order.email}), '') is not null`
      : channel === 'whatsapp'
        ? sql`nullif(trim(${order.phone}), '') is not null`
        : or(
            sql`nullif(trim(${order.email}), '') is not null`,
            sql`nullif(trim(${order.phone}), '') is not null`,
          )
  return tx
    .select({ id: order.id })
    .from(order)
    .where(
      and(
        inArray(order.fulfillmentStatus, ['delivered', 'partially_delivered']),
        inArray(order.status, ['open', 'completed']),
        gte(when, range.from),
        lte(when, range.to),
        reachable,
        notExists(
          tx
            .select({ one: sql`1` })
            .from(reviewRequest)
            .where(sql`${reviewRequest.orderId} = ${order.id}`),
        ),
        notExists(
          tx.select({ one: sql`1` }).from(review).where(sql`${review.orderId} = ${order.id}`),
        ),
      ),
    )
    .orderBy(desc(when))
    .limit(PAST_ORDERS_MAX + 1)
}

/**
 * Where a new run starts: now, or later by an hour per `PAST_ORDERS_PER_HOUR` orders already
 * waiting to go out in the next day (an earlier run's tail), so runs started back to back still
 * leave at the hourly rate. Requests due further out (the usual days-after-delivery ones) do not
 * hold a run back.
 */
async function queuedUntil(tx: StoreTx, now: Date): Promise<Date> {
  const [row] = await tx
    .select({ n: sql<number>`count(distinct ${reviewRequest.orderId})::int` })
    .from(reviewRequest)
    .where(
      and(
        isNull(reviewRequest.sentAt),
        isNull(reviewRequest.optedOutAt),
        gte(reviewRequest.dueAt, now),
        lte(reviewRequest.dueAt, new Date(now.getTime() + DAY)),
      ),
    )
  const waiting = Number(row?.n ?? 0)
  if (waiting === 0) return now
  return new Date(now.getTime() + Math.ceil(waiting / PAST_ORDERS_PER_HOUR) * HOUR)
}

export type PastOrdersPreview = {
  /** Orders that would be asked (at most `PAST_ORDERS_MAX`). */
  orders: number
  /** More orders match than one run asks. */
  capped: boolean
  /** Hours until the last request of the run goes out. */
  hours: number
}

/** The preview the dialog shows before sending: how many orders, and over how long. */
export async function previewPastOrders(
  tx: StoreTx,
  settings: ReviewsSettings,
  range: PastOrdersRange,
  now: Date = new Date(),
): Promise<PastOrdersPreview> {
  checkPastOrdersRange(range, now)
  const rows = await candidates(tx, settings, range)
  const orders = Math.min(rows.length, PAST_ORDERS_MAX)
  const start = await queuedUntil(tx, now)
  const end = orders > 0 ? staggeredDue(start, orders - 1) : start
  return {
    orders,
    capped: rows.length > PAST_ORDERS_MAX,
    hours: Math.ceil((end.getTime() - now.getTime()) / HOUR),
  }
}

/**
 * "Request reviews from past orders": plans requests for the delivered orders in the range that
 * have no review and were never asked, `PAST_ORDERS_PER_HOUR` orders an hour after anything an
 * earlier run still has waiting. Opted-out shoppers are skipped as usual. The worker's sweep
 * sends each request when it is due.
 */
export async function askPastOrders(
  tx: StoreTx,
  storeId: string,
  settings: ReviewsSettings,
  range: PastOrdersRange,
  now: Date = new Date(),
): Promise<{ orders: number; requests: number; capped: boolean }> {
  if (!settings.requestEmail.enabled) {
    throw new CommerceError('REVIEW_EMAILS_OFF', 'Turn on review requests in Settings first')
  }
  checkPastOrdersRange(range, now)
  const rows = await candidates(tx, settings, range)
  const start = await queuedUntil(tx, now)
  let orders = 0
  let requests = 0
  for (const o of rows.slice(0, PAST_ORDERS_MAX)) {
    const n = await scheduleReviewRequests(
      tx,
      storeId,
      o.id,
      settings,
      now,
      staggeredDue(start, orders),
    )
    if (n > 0) orders += 1
    requests += n
  }
  return { orders, requests, capped: rows.length > PAST_ORDERS_MAX }
}
