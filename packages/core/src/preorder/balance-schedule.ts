import { type Db, order, orderLine, orderNote, payment, store, withStore } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, asc, eq, gt, inArray, isNotNull, isNull, notInArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { RefundNotAllowed, refundedPaise, refundPayment } from '../order/refund'
import { cancelOrder } from '../order/status'
import { insertOutboxEvent } from '../outbox/write'
import { applyPaymentStatus } from '../payments/confirm'
import { OPEN_ATTEMPT_STATUSES } from '../payments/transitions'
import { balanceAttempts, balanceOwed, requestBalance } from './balance'
import { type PreorderStoreSettings, parsePreorderStoreSettings } from './store-settings'

/*
 * The balance job, once a minute per store with balances owed: ask for the
 * balance ahead of the ship date when the store automates it, send up to two
 * reminders, and apply the store's unpaid-balance rule. Every step is a
 * conditional update under the order's row lock, so an overlapping run, a
 * payment landing mid-run or a merchant cancel never double-sends or
 * double-refunds. Payment or cancellation ends the schedule: those orders no
 * longer owe anything and drop out of the query.
 */

const DAY_MS = 86_400_000
const BATCH = 100

export type BalanceStep = 'request' | 'remind' | 'expire' | null

export type BalanceCandidate = {
  requestedAt: Date | null
  remindersSent: number
  /** Earliest expected ship date among the order's pre-order lines. */
  shipDate: Date | null
}

/** What the job does next for one order, if anything. Pure, so the schedule is unit-tested. */
export function nextBalanceStep(
  s: PreorderStoreSettings,
  o: BalanceCandidate,
  now: Date,
): BalanceStep {
  const t = now.getTime()
  if (!o.requestedAt) {
    if (s.autoRequestDaysBeforeShip === null || !o.shipDate) return null
    return t >= o.shipDate.getTime() - s.autoRequestDaysBeforeShip * DAY_MS ? 'request' : null
  }
  const since = t - o.requestedAt.getTime()
  if (s.unpaidAction !== 'none' && since >= s.payWithinDays * DAY_MS) return 'expire'
  const nextReminder = s.reminderDays[o.remindersSent]
  if (nextReminder !== undefined && since >= nextReminder * DAY_MS) return 'remind'
  return null
}

export const BALANCE_CANCELLED_NOTE = (days: number, kept: boolean) =>
  `Cancelled automatically: balance not paid within ${days} days of the request. ${
    kept ? 'Deposit kept (non-refundable, per the store policy).' : 'Deposit refunded.'
  } Reserved stock was released.`

export const BALANCE_REFUND_BY_HAND_NOTE = (reason: string) =>
  `The deposit could not be refunded automatically (${reason}). Refund it from the payment card.`

/** Live orders with a balance owed, oldest first, with their earliest ship date. */
export async function balanceCandidates(ctx: StoreContext) {
  // Spelled out with an alias: inside a select list drizzle drops table
  // prefixes, which would correlate order_line.order_id with order_line.id.
  const shipDate = sql<Date | null>`(
    select min(ol.preorder_ship_date) from ${orderLine} ol
    where ol.order_id = "order"."id" and ol.preorder
  )`.mapWith((v: string | Date | null) => (v ? new Date(v) : null))
  return ctx.tx
    .select({
      id: order.id,
      requestedAt: order.balanceRequestedAt,
      remindersSent: order.balanceRemindersSent,
      shipDate,
    })
    .from(order)
    .where(
      and(
        gt(order.balanceDuePaise, 0),
        isNull(order.balancePaidAt),
        isNull(order.importedFrom),
        notInArray(order.status, ['cancelled', 'draft']),
        // The balance follows the deposit: nothing is asked before it is paid.
        isNotNull(order.checkoutPaidAt),
        // Deposit pre-orders only: a balance an order edit left is the merchant's to chase,
        // never reminded or cancelled by the pre-order rules (order/edit-settle.ts).
        isNotNull(order.depositPaise),
      ),
    )
    .orderBy(asc(order.placedAt))
    .limit(BATCH)
}

/**
 * Reminder number `sent + 1`, once: the update only matches while the count
 * is still `sent` and the balance still owed, so a racing run or a payment
 * that just landed makes it a no-op.
 */
export async function sendBalanceReminder(
  ctx: StoreContext,
  orderId: string,
  sent: number,
): Promise<boolean> {
  const [moved] = await ctx.tx
    .update(order)
    .set({ balanceRemindersSent: sent + 1 })
    .where(
      and(
        eq(order.id, orderId),
        eq(order.balanceRemindersSent, sent),
        isNull(order.balancePaidAt),
        gt(order.balanceDuePaise, 0),
        notInArray(order.status, ['cancelled', 'draft']),
      ),
    )
    .returning({ id: order.id })
  if (!moved) return false
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.balance_reminder', { orderId })
  return true
}

export type BalanceOutcome = {
  orderId: string
  result: 'requested' | 'reminded' | 'cancelled' | 'paid' | 'skipped'
  reason?: string | undefined
}

/**
 * Apply the unpaid-balance rule to one order. Open balance attempts are
 * checked with the gateway first (outside any transaction), so a balance
 * whose webhook is merely late settles the order instead of cancelling it.
 * Then, under the order lock: open balance attempts are cancelled, the order
 * is cancelled (committed stock released through `cancelOrder`), and with
 * `cancel_refund` every deposit payment still held is refunded through the
 * normal refund path, each refund writing `refund.created` (the GST app's
 * refund voucher). `cancel_keep` refunds nothing, gift card part included.
 */
export async function expireUnpaidBalance(
  db: Db,
  storeId: string,
  orderId: string,
  providers: readonly PaymentProvider[],
  settings: PreorderStoreSettings,
  now: Date = new Date(),
): Promise<BalanceOutcome> {
  const attempts = await withStore(db, storeId, (tx) => balanceAttempts({ storeId, tx }, orderId))
  for (const a of attempts) {
    if (!(OPEN_ATTEMPT_STATUSES as readonly string[]).includes(a.status) || !a.checkoutSession) {
      continue
    }
    const provider = providers.find((p) => p.id === a.provider)
    if (!provider) continue
    let truth: Awaited<ReturnType<PaymentProvider['fetchStatus']>>
    try {
      truth = await provider.fetchStatus(a.providerRef)
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      return { orderId, result: 'skipped', reason: `gateway check failed: ${reason}` }
    }
    if (truth.status === 'captured') {
      await withStore(db, storeId, (tx) =>
        applyPaymentStatus(
          { storeId, tx },
          { paymentId: a.id, status: 'captured', providerPaymentId: truth.providerPaymentId },
        ),
      )
      return { orderId, result: 'paid' }
    }
    if (truth.status === 'authorized') {
      return { orderId, result: 'skipped', reason: 'authorised, capture pending' }
    }
  }

  return withStore(db, storeId, async (tx) => {
    const ctx = { storeId, tx }
    const [o] = await tx.select().from(order).where(eq(order.id, orderId)).for('update')
    if (!o || balanceOwed(o) <= 0 || !o.balanceRequestedAt) {
      return { orderId, result: 'skipped' as const, reason: 'nothing owed' }
    }
    const since = now.getTime() - o.balanceRequestedAt.getTime()
    if (settings.unpaidAction === 'none' || since < settings.payWithinDays * DAY_MS) {
      return { orderId, result: 'skipped' as const, reason: 'not due' }
    }
    const keep = settings.unpaidAction === 'cancel_keep'
    await tx
      .update(payment)
      .set({ status: 'cancelled', error: 'Balance not paid in time' })
      .where(
        and(
          eq(payment.orderId, orderId),
          eq(payment.purpose, 'balance'),
          inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
        ),
      )
    await cancelOrder(ctx, orderId, { returnGiftCards: !keep })
    await insertOutboxEvent(tx, storeId, 'order.cancelled', { orderId })
    const notes = [BALANCE_CANCELLED_NOTE(settings.payWithinDays, keep)]
    if (!keep) notes.push(...(await refundDeposit(ctx, orderId, providers)))
    await tx
      .insert(orderNote)
      .values(notes.map((body) => ({ storeId, orderId, body, author: 'system' })))
    return { orderId, result: 'cancelled' as const }
  })
}

/**
 * Refund what the deposit payments still hold. Gift cards were already put
 * back by `cancelOrder`. A refund the gateway or the platform refuses leaves
 * a note for the merchant instead of undoing the cancel.
 */
async function refundDeposit(
  ctx: StoreContext,
  orderId: string,
  providers: readonly PaymentProvider[],
): Promise<string[]> {
  const held = await ctx.tx
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.purpose, 'order'),
        eq(payment.status, 'captured'),
        eq(payment.refundNeeded, false),
      ),
    )
  const notes: string[] = []
  for (const p of held) {
    if (p.provider === GIFT_CARD_PROVIDER) continue
    const left = p.amountPaise - (await refundedPaise(ctx, p.id))
    if (left <= 0) continue
    try {
      const r = await refundPayment(ctx, providers.find((x) => x.id === p.provider) ?? null, {
        paymentId: p.id,
        amountPaise: left,
        reason: 'Pre-order cancelled: balance not paid in time',
      })
      if (r && r.status !== 'failed') {
        await insertOutboxEvent(ctx.tx, ctx.storeId, 'refund.created', {
          orderId,
          refundId: r.id,
        })
      }
    } catch (err) {
      if (!(err instanceof RefundNotAllowed)) throw err
      notes.push(BALANCE_REFUND_BY_HAND_NOTE(err.message))
    }
  }
  return notes
}

/** One store's run. One order failing never stops the rest; the next run retries it. */
export async function runBalanceSchedule(
  db: Db,
  storeId: string,
  providers: readonly PaymentProvider[],
  now: Date = new Date(),
): Promise<BalanceOutcome[]> {
  const { settings, candidates } = await withStore(db, storeId, async (tx) => {
    const [s] = await tx
      .select({ preorder: store.preorder })
      .from(store)
      .where(eq(store.id, storeId))
    return {
      settings: parsePreorderStoreSettings(s?.preorder),
      candidates: await balanceCandidates({ storeId, tx }),
    }
  })
  const out: BalanceOutcome[] = []
  for (const c of candidates) {
    const step = nextBalanceStep(settings, c, now)
    if (!step) continue
    try {
      if (step === 'request') {
        await withStore(db, storeId, (tx) => requestBalance({ storeId, tx }, c.id, { now }))
        out.push({ orderId: c.id, result: 'requested' })
      } else if (step === 'remind') {
        const sent = await withStore(db, storeId, (tx) =>
          sendBalanceReminder({ storeId, tx }, c.id, c.remindersSent),
        )
        out.push({ orderId: c.id, result: sent ? 'reminded' : 'skipped' })
      } else {
        out.push(await expireUnpaidBalance(db, storeId, c.id, providers, settings, now))
      }
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
