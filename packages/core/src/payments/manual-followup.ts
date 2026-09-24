import { type Db, order, orderNote, payment, store, withStore } from '@commerce/db'
import { and, asc, eq, inArray, isNotNull, isNull, lte, ne, or } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { recomputeOrderStatuses } from '../order/recompute'
import { cancelOrder } from '../order/status'
import { insertOutboxEvent } from '../outbox/write'
import { parsePaymentSettings } from './settings'
import { OPEN_ATTEMPT_STATUSES } from './transitions'

/*
 * Manual UPI / bank transfer follow-up. Nothing tells us when a transfer
 * lands, and the shopper may have paid before the merchant matched it, so
 * nothing here reaches the shopper on its own:
 * - the merchant sends a payment reminder from the order, at most once every
 *   6 hours;
 * - auto-cancel is opt-in per store. When on, the merchant is told 12 hours
 *   ahead, then the order is cancelled and its stock released.
 * Marking the order paid ends all of it: every step re-checks `placed` under
 * a conditional update or the order's row lock.
 */

export const MANUAL_METHOD = 'manual'

const HOUR_MS = 3_600_000
/** Shortest gap between two reminders the merchant sends for one order. */
export const REMINDER_EVERY_HOURS = 6
/** How long before an automatic cancel the merchant hears about it. */
export const CANCEL_NOTICE_HOURS = 12
const BATCH = 100

export class PaymentNotPending extends CommerceError {
  constructor(orderId: string, storeId?: string) {
    super('PAYMENT_NOT_PENDING', `Order ${orderId} is not waiting for a transfer`, { storeId })
  }
}

export class ReminderTooSoon extends CommerceError {
  /** When the next reminder may go. */
  readonly nextAt: Date

  constructor(nextAt: Date, storeId?: string) {
    super(
      'REMINDER_TOO_SOON',
      `A reminder for this order went out less than ${REMINDER_EVERY_HOURS} hours ago`,
      { storeId },
    )
    this.nextAt = nextAt
  }
}

const stillWaiting = (orderId: string) =>
  and(
    eq(order.id, orderId),
    eq(order.status, 'open'),
    isNull(order.checkoutPaidAt),
    eq(order.paymentMethod, MANUAL_METHOD),
    isNull(order.importedFrom),
  )

/**
 * The merchant's "Send payment reminder": email, and WhatsApp when set up,
 * linking the QR and bank details. One conditional update both enforces the
 * 6-hour limit and records the send, so two quick clicks send one.
 */
export async function sendManualPaymentReminder(
  ctx: StoreContext,
  orderId: string,
  opts: { author?: string | undefined; now?: Date | undefined } = {},
): Promise<{ sentAt: Date }> {
  const now = opts.now ?? new Date()
  const cutoff = new Date(now.getTime() - REMINDER_EVERY_HOURS * HOUR_MS)
  const [moved] = await ctx.tx
    .update(order)
    .set({ paymentReminderSentAt: now })
    .where(
      and(
        stillWaiting(orderId),
        or(isNull(order.paymentReminderSentAt), lte(order.paymentReminderSentAt, cutoff)),
      ),
    )
    .returning({ id: order.id })
  if (!moved) {
    const [o] = await ctx.tx
      .select({ sentAt: order.paymentReminderSentAt })
      .from(order)
      .where(stillWaiting(orderId))
    if (!o) throw new PaymentNotPending(orderId, ctx.storeId)
    const last = o.sentAt ?? now
    throw new ReminderTooSoon(
      new Date(last.getTime() + REMINDER_EVERY_HOURS * HOUR_MS),
      ctx.storeId,
    )
  }
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.payment_reminder', { orderId })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: REMINDER_NOTE,
    author: opts.author ?? 'system',
  })
  return { sentAt: now }
}

export const REMINDER_NOTE = 'Payment reminder sent to the customer.'

export const CANCEL_NOTICE_NOTE = (at: Date) =>
  `Will be cancelled automatically on ${at.toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  })} unless it is marked paid.`

export const MANUAL_CANCELLED_NOTE = (hours: number) =>
  `Cancelled automatically: the UPI or bank transfer did not arrive within ${hours} hours. Reserved stock was released.`

export type ManualStep = 'notice' | 'cancel' | null

export type ManualCandidate = { placedAt: Date; cancelNoticeAt: Date | null }

/** When the order will be cancelled: its window, but never sooner than 12 hours after the notice. */
export function manualCancelAt(hours: number, o: ManualCandidate): Date {
  const byWindow = o.placedAt.getTime() + hours * HOUR_MS
  const byNotice = o.cancelNoticeAt ? o.cancelNoticeAt.getTime() + CANCEL_NOTICE_HOURS * HOUR_MS : 0
  return new Date(Math.max(byWindow, byNotice))
}

/** What the auto-cancel job does next for one order, if anything. Pure, so it is unit-tested. */
export function nextManualStep(
  cancelAfterHours: number,
  o: ManualCandidate,
  now: Date,
): ManualStep {
  if (cancelAfterHours <= 0) return null
  const t = now.getTime()
  if (!o.cancelNoticeAt) {
    const noticeAt = o.placedAt.getTime() + (cancelAfterHours - CANCEL_NOTICE_HOURS) * HOUR_MS
    return t >= noticeAt ? 'notice' : null
  }
  return t >= manualCancelAt(cancelAfterHours, o).getTime() ? 'cancel' : null
}

/**
 * Tell the merchant, once, that this order will be cancelled: an email to the
 * store's contact address (the outbox row) and a note on the order timeline.
 */
export async function sendUnpaidCancelNotice(
  ctx: StoreContext,
  orderId: string,
  hours: number,
  now: Date = new Date(),
): Promise<boolean> {
  const [moved] = await ctx.tx
    .update(order)
    .set({ unpaidCancelNoticeAt: now })
    .where(and(stillWaiting(orderId), isNull(order.unpaidCancelNoticeAt)))
    .returning({ id: order.id, placedAt: order.placedAt })
  if (!moved) return false
  const at = manualCancelAt(hours, { placedAt: moved.placedAt, cancelNoticeAt: now })
  await ctx.tx
    .insert(orderNote)
    .values({ storeId: ctx.storeId, orderId, body: CANCEL_NOTICE_NOTE(at), author: 'system' })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.unpaid_cancel_notice', { orderId })
  return true
}

/**
 * Cancel one unpaid transfer order through the normal cancel path (stock
 * released exactly once), under its row lock. Paid, cancelled, never
 * announced, or not yet due since it was picked: nothing happens.
 */
export async function cancelUnpaidManualOrder(
  ctx: StoreContext,
  orderId: string,
  hours: number,
  now: Date = new Date(),
): Promise<boolean> {
  const [o] = await ctx.tx
    .select({ placedAt: order.placedAt, cancelNoticeAt: order.unpaidCancelNoticeAt })
    .from(order)
    .where(and(stillWaiting(orderId), isNotNull(order.unpaidCancelNoticeAt)))
    .for('update')
  if (!o || nextManualStep(hours, o, now) !== 'cancel') return false
  await cancelOrder(ctx, orderId)
  await ctx.tx
    .update(payment)
    .set({ status: 'cancelled', error: 'Transfer not received in time' })
    .where(
      and(
        eq(payment.orderId, orderId),
        inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
        ne(payment.provider, GIFT_CARD_PROVIDER),
      ),
    )
  await recomputeOrderStatuses(ctx, orderId)
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: MANUAL_CANCELLED_NOTE(hours),
    author: 'system',
  })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.cancelled', { orderId })
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.unpaid_cancelled', { orderId })
  return true
}

/** Placed manual-transfer orders, oldest first. */
export async function manualFollowUpCandidates(ctx: StoreContext) {
  return ctx.tx
    .select({
      id: order.id,
      placedAt: order.placedAt,
      cancelNoticeAt: order.unpaidCancelNoticeAt,
    })
    .from(order)
    .where(
      and(
        eq(order.status, 'open'),
        isNull(order.checkoutPaidAt),
        eq(order.paymentMethod, MANUAL_METHOD),
        isNull(order.importedFrom),
      ),
    )
    .orderBy(asc(order.placedAt))
    .limit(BATCH)
}

export type ManualOutcome = {
  orderId: string
  result: 'noticed' | 'cancelled' | 'skipped'
  reason?: string | undefined
}

/** One store's auto-cancel run. Off unless the store turned it on. */
export async function runManualFollowUp(
  db: Db,
  storeId: string,
  now: Date = new Date(),
): Promise<ManualOutcome[]> {
  const { hours, candidates } = await withStore(db, storeId, async (tx) => {
    const [s] = await tx
      .select({ payments: store.payments })
      .from(store)
      .where(eq(store.id, storeId))
    const hours = parsePaymentSettings(s?.payments).manualCancelAfterHours
    return { hours, candidates: hours > 0 ? await manualFollowUpCandidates({ storeId, tx }) : [] }
  })
  const out: ManualOutcome[] = []
  for (const c of candidates) {
    const step = nextManualStep(hours, c, now)
    if (!step) continue
    try {
      const done = await withStore(db, storeId, (tx) =>
        step === 'notice'
          ? sendUnpaidCancelNotice({ storeId, tx }, c.id, hours, now)
          : cancelUnpaidManualOrder({ storeId, tx }, c.id, hours, now),
      )
      out.push({
        orderId: c.id,
        result: done ? (step === 'notice' ? 'noticed' : 'cancelled') : 'skipped',
      })
    } catch (err) {
      out.push({
        orderId: c.id,
        result: 'skipped',
        reason: err instanceof Error ? err.message : String(err),
      })
    }
  }
  return out
}
