import { type Db, order, orderNote, payment, store, withStore } from '@commerce/db'
import type { CustomMessage } from '@commerce/notifications'
import { and, asc, eq, inArray, isNotNull, isNull, lte, notInArray, or } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { recomputeOrderStatuses } from '../order/recompute'
import { cancelOrder } from '../order/status'
import { insertOutboxEvent } from '../outbox/write'
import { manualCancelHoursOf, parsePaymentSettings } from './settings'
import { SPLIT_TENDER_PROVIDERS } from './split-tender'
import { OPEN_ATTEMPT_STATUSES } from './transitions'

/*
 * Manual UPI / bank transfer follow-up. Nothing tells us when a transfer
 * lands, and the shopper may have paid before the merchant matched it, so
 * nothing here reaches the shopper on its own:
 * - the merchant sends a payment reminder from the order, at most once every
 *   6 hours;
 * - auto-cancel is on by default (6 hours; 1 to 72, or off, per store). The
 *   merchant is told ahead (`cancelNoticeHours`), then the order is cancelled
 *   and its stock released.
 * Marking the order paid ends all of it: every step re-checks `placed` under
 * a conditional update or the order's row lock.
 */

export const MANUAL_METHOD = 'manual'

const HOUR_MS = 3_600_000
/** Shortest gap between two reminders the merchant sends for one order. */
export const REMINDER_EVERY_HOURS = 6
/** How long before an automatic cancel the merchant hears about it, for a window of a day or more. */
export const CANCEL_NOTICE_HOURS = 12

/**
 * Hours of notice the merchant gets before an order is cancelled: 12, or half the window
 * when the window is under a day (a 6 hour window is noticed at 3 hours, 3 hours ahead).
 */
export function cancelNoticeHours(cancelAfterHours: number): number {
  return cancelAfterHours < 24 ? cancelAfterHours / 2 : CANCEL_NOTICE_HOURS
}
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

/**
 * Where a payment reminder goes: email, WhatsApp, or both. WhatsApp sends the store's approved
 * `payment_reminder` template through its WhatsApp channel (Meta Cloud API).
 */
export type ReminderChannel = 'email' | 'whatsapp' | 'both'
export const REMINDER_CHANNELS = [
  'email',
  'whatsapp',
  'both',
] as const satisfies readonly ReminderChannel[]

/** The recipient field delivery limits a reminder to (`DeliverOptions.requires`); none for both. */
export function reminderRequires(channel: ReminderChannel): 'email' | 'phone' | undefined {
  if (channel === 'email') return 'email'
  if (channel === 'whatsapp') return 'phone'
  return undefined
}

class ReminderNoRecipient extends CommerceError {
  constructor(channel: ReminderChannel, storeId?: string) {
    super(
      'REMINDER_NO_RECIPIENT',
      channel === 'whatsapp'
        ? 'WhatsApp is not set up for this store, or the order has no phone number'
        : channel === 'email'
          ? 'This order has no email address to send a reminder to'
          : 'This order has no email address or phone number',
      { storeId },
    )
  }
}

/**
 * The channels a reminder really goes on: the merchant's choice narrowed to what the order has
 * (an email, a phone) and the store has (a WhatsApp channel). Null when nothing is left, e.g.
 * WhatsApp chosen for an order without a phone.
 */
export function reminderChannelFor(
  channel: ReminderChannel,
  to: { email: string | null; phone: string | null },
  whatsappConnected: boolean,
): ReminderChannel | null {
  const email = Boolean(to.email?.trim())
  const phone = whatsappConnected && Boolean(to.phone?.replace(/\D/g, ''))
  if (channel === 'email') return email ? 'email' : null
  if (channel === 'whatsapp') return phone ? 'whatsapp' : null
  if (email && phone) return 'both'
  return email ? 'email' : phone ? 'whatsapp' : null
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
 * The merchant's "Send payment reminder": email, WhatsApp (when set up) or both,
 * linking the QR and bank details. One conditional update both enforces the
 * 6-hour limit and records the send, so two quick clicks send one.
 */
export async function sendManualPaymentReminder(
  ctx: StoreContext,
  orderId: string,
  opts: {
    author?: string | undefined
    now?: Date | undefined
    /** The merchant's edited subject and note from the "Review email" dialog. */
    custom?: CustomMessage | undefined
    /** Email, WhatsApp or both (the default: every channel the store has). */
    channel?: ReminderChannel | undefined
    /** The store has a WhatsApp channel set up. Defaults to true; delivery skips what is missing. */
    whatsapp?: boolean | undefined
  } = {},
): Promise<{ sentAt: Date }> {
  const now = opts.now ?? new Date()
  const [contact] = await ctx.tx
    .select({ email: order.email, phone: order.phone })
    .from(order)
    .where(stillWaiting(orderId))
  if (!contact) throw new PaymentNotPending(orderId, ctx.storeId)
  const chosen = opts.channel ?? 'both'
  const channel = reminderChannelFor(chosen, contact, opts.whatsapp ?? true)
  if (!channel) throw new ReminderNoRecipient(chosen, ctx.storeId)
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
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.payment_reminder', {
    orderId,
    custom: opts.custom,
    requires: reminderRequires(channel),
  })
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: REMINDER_NOTE(channel),
    author: opts.author ?? 'system',
  })
  return { sentAt: now }
}

/**
 * The merchant opened the reminder in their own WhatsApp (a wa.me chat link, for a store
 * without a WhatsApp channel) to send it by hand: only the timeline line, nothing is sent from
 * here and the 6-hour limit is untouched. False when the order no longer waits for a transfer.
 */
export async function noteChatPaymentReminder(
  ctx: StoreContext,
  orderId: string,
  opts: { author?: string | undefined } = {},
): Promise<boolean> {
  const [o] = await ctx.tx.select({ id: order.id }).from(order).where(stillWaiting(orderId))
  if (!o) return false
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: CHAT_REMINDER_NOTE,
    author: opts.author ?? 'system',
  })
  return true
}

const CHAT_REMINDER_NOTE = 'Payment reminder opened in WhatsApp to send from your own number.'

const REMINDER_BY: Record<ReminderChannel, string> = {
  email: 'by email',
  whatsapp: 'on WhatsApp',
  both: 'by email and WhatsApp',
}

/** The order timeline line for a reminder; `automatic` for the store's daily reminder workflow. */
export const REMINDER_NOTE = (channel: ReminderChannel, automatic = false) =>
  `${automatic ? 'Automatic payment' : 'Payment'} reminder sent to the customer ${REMINDER_BY[channel]}.`

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

/** When the order will be cancelled: its window, but never sooner than the notice period after the notice. */
export function manualCancelAt(hours: number, o: ManualCandidate): Date {
  const byWindow = o.placedAt.getTime() + hours * HOUR_MS
  const byNotice = o.cancelNoticeAt
    ? o.cancelNoticeAt.getTime() + cancelNoticeHours(hours) * HOUR_MS
    : 0
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
    const noticeAt =
      o.placedAt.getTime() + (cancelAfterHours - cancelNoticeHours(cancelAfterHours)) * HOUR_MS
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
  // The dedicated `unpaid_cancelled` message below already tells the shopper why.
  await cancelOrder(ctx, orderId, { notifyCustomer: false })
  await ctx.tx
    .update(payment)
    .set({ status: 'cancelled', error: 'Transfer not received in time' })
    .where(
      and(
        eq(payment.orderId, orderId),
        inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
        notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS]),
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

/** One store's auto-cancel run. On unless the store turned it off. */
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
    const hours = manualCancelHoursOf(parsePaymentSettings(s?.payments))
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
