/** SOURCE OF TRUTH: checkout drafts — WHAT: the shopper's open unpaid checkout draft (#D57) found again for the same items, cleared for a fresh try, converted in place into a numbered order when paid, and expired after 7 days without activity / WHY: an unpaid online or UPI checkout used to burn an order number and clutter Orders (docs/design/unpaid-checkouts-as-drafts.md) */
import { discount, discountUsage, order, orderLine, orderNote, payment } from '@commerce/db'
import { and, desc, eq, gte, inArray, isNull, lt, notInArray, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { CHECKOUT_DRAFT_EXPIRY_DAYS } from '../payments/checkout-drafts'
import { type CheckoutContactKeys, orderContactMatch } from '../payments/manual-unpaid'
import { SPLIT_TENDER_PROVIDERS } from '../payments/split-tender'
import { paysOnlineAtCheckout } from './aggregate-status'
import { routeAndBillDraft } from './draft-place'
import { releaseDraftHold } from './draft-reserve'
import { itemsKey } from './duplicate-checkout'
import { takeOrderNumber } from './order-number'

const HOUR_MS = 3_600_000
const DAY_MS = 86_400_000

/** Timeline note when the shopper checks the same items out again on their open draft. */
export const CHECKED_OUT_AGAIN_NOTE = 'Shopper checked out again'

/** A shopper's unpaid checkout, kept as a draft until its money arrives. */
export const isCheckoutDraft = (o: { status: string; draftSource: string | null }): boolean =>
  o.status === 'draft' && o.draftSource === 'checkout'

/** Still waiting for payment: a checkout draft that has not expired. */
export const isOpenCheckoutDraft = (o: {
  status: string
  draftSource: string | null
  draftExpiredAt: Date | null
}): boolean => isCheckoutDraft(o) && o.draftExpiredAt === null

/** SQL for an open checkout draft (a draft from checkout that has not expired). */
export const openCheckoutDraftWhere = () =>
  and(eq(order.status, 'draft'), eq(order.draftSource, 'checkout'), isNull(order.draftExpiredAt))

/**
 * The shopper's open checkout draft with exactly these items (variant ids and quantities),
 * last active within `windowHours`, matched by email OR phone. Locked, so two submits wait for
 * each other. Null when there is none, the window is 0, or there is no contact to match by.
 */
export async function findSameItemsDraft(
  ctx: StoreContext,
  input: {
    contact: CheckoutContactKeys
    lines: readonly { variantId: string; quantity: number }[]
    windowHours: number
    now?: Date | undefined
  },
): Promise<{ id: string; draftNumber: number | null } | null> {
  const match = orderContactMatch(input.contact)
  if (!match || input.windowHours <= 0 || input.lines.length === 0) return null
  const now = input.now ?? new Date()
  const since = new Date(now.getTime() - input.windowHours * HOUR_MS)
  const rows = await ctx.tx
    .select({ id: order.id, draftNumber: order.draftNumber })
    .from(order)
    .where(and(openCheckoutDraftWhere(), gte(order.lastActivityAt, since), match))
    .orderBy(desc(order.lastActivityAt))
    .limit(20)
  if (rows.length === 0) return null
  const lines = await ctx.tx
    .select({
      orderId: orderLine.orderId,
      variantId: orderLine.variantId,
      quantity: orderLine.quantity,
    })
    .from(orderLine)
    .where(
      inArray(
        orderLine.orderId,
        rows.map((r) => r.id),
      ),
    )
  const want = itemsKey(input.lines)
  const same = rows.find((r) => itemsKey(lines.filter((l) => l.orderId === r.id)) === want)
  if (!same) return null
  const [locked] = await ctx.tx
    .select({ id: order.id, draftNumber: order.draftNumber })
    .from(order)
    .where(and(eq(order.id, same.id), openCheckoutDraftWhere()))
    .for('update')
  return locked ?? null
}

/** Give back the discount uses an order counted, so a fresh try counts its own. */
export async function releaseOrderDiscountUses(ctx: StoreContext, orderId: string): Promise<void> {
  const uses = await ctx.tx
    .delete(discountUsage)
    .where(eq(discountUsage.orderId, orderId))
    .returning({ discountId: discountUsage.discountId })
  for (const u of uses) {
    await ctx.tx
      .update(discount)
      .set({ usedCount: sql`greatest(${discount.usedCount} - 1, 0)` })
      .where(eq(discount.id, u.discountId))
  }
}

/** Mark the draft's open gateway attempts cancelled: a new try (or the expiry) replaces them. */
export async function cancelOpenAttempts(ctx: StoreContext, orderId: string, why: string) {
  await ctx.tx
    .update(payment)
    .set({ status: 'cancelled', error: why })
    .where(
      and(
        eq(payment.orderId, orderId),
        inArray(payment.status, ['created', 'pending']),
        notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS]),
      ),
    )
}

/**
 * Empty an open checkout draft for the shopper's new try at the same items: its hold, discount
 * uses, lines and unanswered attempts go, so the checkout writes them again at today's prices,
 * method and address. The row, its id and its #D number stay. Runs in the checkout's
 * transaction: a refusal later puts everything back.
 */
export async function clearDraftForRetry(ctx: StoreContext, id: string): Promise<void> {
  const [o] = await ctx.tx
    .select({ id: order.id, draftReserved: order.draftReserved })
    .from(order)
    .where(eq(order.id, id))
    .for('update')
  if (!o) return
  await releaseDraftHold(ctx, o)
  await releaseOrderDiscountUses(ctx, id)
  await cancelOpenAttempts(ctx, id, 'Replaced: the shopper checked out again')
  await ctx.tx.delete(orderLine).where(eq(orderLine.orderId, id))
}

/**
 * Turn a paid (or, for a manual-capture store, authorised) checkout draft into a numbered order,
 * in place: same id, the next order number, its stock routed and held again (the hold may have
 * lapsed) and its parcels written. The caller holds the order row lock. Throws `OutOfStock`
 * when the goods are gone; run it in a savepoint and flag the money refund-needed then.
 * Returns the order number, or null when the row is not a checkout draft (nothing done).
 */
export async function convertCheckoutDraft(
  ctx: StoreContext,
  id: string,
  now = new Date(),
): Promise<number | null> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, id)).for('update')
  if (!o || !isCheckoutDraft(o)) return null
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, id))
  // Its hold is given back first, so the stock below is held once, for the order.
  await releaseDraftHold(ctx, o)
  await routeAndBillDraft(ctx, o, lines)
  const number = await takeOrderNumber(ctx.tx, ctx.storeId)
  await ctx.tx
    .update(order)
    .set({ number, status: 'open', placedAt: now, draftExpiredAt: null })
    .where(eq(order.id, id))
  // A gateway checkout announces itself when the money is recorded (recompute); a transfer or
  // a merchant's "Convert to order (unpaid)" has no such moment, so it is placed here.
  if (!paysOnlineAtCheckout(o)) {
    await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.placed', { orderId: id })
  }
  return number
}

/**
 * The worker's sweep: open checkout drafts with no activity for 7 days stop waiting for payment.
 * Their hold and discount uses are given back and their unanswered attempts cancelled. They stay
 * (a late capture still converts one when stock allows). Drafts with money in are left alone.
 */
export async function expireCheckoutDrafts(ctx: StoreContext, now = new Date()): Promise<number> {
  const cutoff = new Date(now.getTime() - CHECKOUT_DRAFT_EXPIRY_DAYS * DAY_MS)
  const rows = await ctx.tx
    .select({ id: order.id, draftReserved: order.draftReserved })
    .from(order)
    .where(
      and(
        openCheckoutDraftWhere(),
        lt(order.lastActivityAt, cutoff),
        sql`not exists (
          select 1 from payment p where p.order_id = "order"."id"
          and p.status in ('authorized', 'captured')
        )`,
      ),
    )
    .limit(50)
    .for('update')
  for (const r of rows) {
    await retireCheckoutDraft(ctx, r, {
      now,
      why: 'Draft expired unpaid',
      note: `Expired: no payment within ${CHECKOUT_DRAFT_EXPIRY_DAYS} days. Held stock was released.`,
    })
  }
  return rows.length
}

/** Timeline note when the shopper ordered the draft's items by cash on delivery instead. */
export const ORDERED_INSTEAD_NOTE =
  'Closed: the shopper ordered these items again with cash on delivery. Held stock was released.'

/**
 * Stop a checkout draft waiting for payment: hold and discount uses back, unanswered attempts
 * cancelled, `draft_expired_at` set and a note on its timeline. The row stays.
 */
export async function retireCheckoutDraft(
  ctx: StoreContext,
  draft: {
    id: string
    draftReserved: { variantId: string; locationId: string; quantity: number }[] | null
  },
  opts: { now?: Date | undefined; why: string; note: string },
): Promise<void> {
  await releaseDraftHold(ctx, draft)
  await releaseOrderDiscountUses(ctx, draft.id)
  await cancelOpenAttempts(ctx, draft.id, opts.why)
  await ctx.tx
    .update(order)
    .set({ draftExpiredAt: opts.now ?? new Date() })
    .where(eq(order.id, draft.id))
  await ctx.tx
    .insert(orderNote)
    .values({ storeId: ctx.storeId, orderId: draft.id, body: opts.note, author: 'system' })
}

/** The longest UTR / bank reference a shopper may type with "I've paid". */
const UTR_MAX = 40

/** Timeline note when the shopper says they paid a transfer. */
export const shopperPaidNote = (utr: string | null): string =>
  utr
    ? `Shopper says they paid by UPI or bank transfer. UTR / reference: ${utr}`
    : 'Shopper says they paid by UPI or bank transfer (no reference given).'

/**
 * "I've paid" on a transfer checkout's page: the shopper's word, not money. Kept on the open
 * transfer attempt (`checkout_session.shopperPaid`: UTR and time) and on the draft's timeline,
 * so the merchant can match it and mark the draft paid. Once per attempt; false when the draft
 * is not an open transfer checkout or the shopper already said so.
 */
export async function recordShopperPaid(
  ctx: StoreContext,
  orderId: string,
  utrInput: string | null | undefined,
  now = new Date(),
): Promise<boolean> {
  const utr = utrInput?.replace(/[^0-9A-Za-z-]/g, '').slice(0, UTR_MAX) || null
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o || !isOpenCheckoutDraft(o) || o.paymentMethod !== 'manual') return false
  const [p] = await ctx.tx
    .select({ id: payment.id, checkoutSession: payment.checkoutSession })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.provider, 'manual'),
        inArray(payment.status, ['created', 'pending']),
      ),
    )
    .orderBy(desc(payment.attempt))
    .limit(1)
  if (!p) return false
  const session = (p.checkoutSession ?? {}) as Record<string, unknown>
  if (session.shopperPaid) return false
  await ctx.tx
    .update(payment)
    .set({ checkoutSession: { ...session, shopperPaid: { utr, at: now.toISOString() } } })
    .where(eq(payment.id, p.id))
  await ctx.tx.update(order).set({ lastActivityAt: now }).where(eq(order.id, orderId))
  await ctx.tx
    .insert(orderNote)
    .values({ storeId: ctx.storeId, orderId, body: shopperPaidNote(utr), author: 'system' })
  return true
}
