import { order, orderNote, payment } from '@commerce/db'
import type { ClientConfirmation, PaymentProvider, PaymentStatus } from '@commerce/payments'
import { and, eq, isNull, ne, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { captureHeldStoreCredit } from '../customers/store-credit-checkout'
import { OutOfStock } from '../errors'
import { convertCheckoutDraft, isCheckoutDraft } from '../order/checkout-draft'
import { recomputeOrderStatuses } from '../order/recompute'
import { insertOutboxEvent } from '../outbox/write'
import { isSplitTender, SPLIT_TENDER_PROVIDERS } from './split-tender'
import { nextPaymentStatus } from './transitions'

export type AppliedPayment = {
  payment: typeof payment.$inferSelect
  /** True only on the call that moved the payment into `captured` for a live order; drives the payment_received notification. */
  becameCaptured: boolean
  /** True when money was captured that the order cannot keep (cancelled order, already paid). */
  refundNeeded: boolean
  /**
   * Set when a caller supplied a gateway-reported amount that did not cover the
   * attempt: the capture was refused and the attempt row left untouched. Only a
   * gateway path (`capturedAmountPaise` given) can produce this.
   */
  rejected?: 'underpaid'
}

/** A second balance capture, or one after the balance was recorded by hand, is money to send back. */
async function balanceAlreadySettled(
  ctx: StoreContext,
  p: typeof payment.$inferSelect,
  o: { balancePaidAt: Date | null },
): Promise<boolean> {
  if (o.balancePaidAt) return true
  const [other] = await ctx.tx
    .select({ id: payment.id })
    .from(payment)
    .where(
      and(
        eq(payment.orderId, p.orderId),
        ne(payment.id, p.id),
        eq(payment.purpose, 'balance'),
        eq(payment.status, 'captured'),
        eq(payment.refundNeeded, false),
      ),
    )
    .limit(1)
  return !!other
}

/**
 * The balance arrived: nothing is owed and fulfilment unblocks. Only the call
 * that sets `balance_paid_at` writes `order.balance_paid`, so a duplicate
 * webhook or a racing browser confirmation never announces it twice.
 */
async function settleBalance(ctx: StoreContext, orderId: string): Promise<void> {
  const [settled] = await ctx.tx
    .update(order)
    .set({ balancePaidAt: new Date(), balanceDuePaise: 0 })
    .where(and(eq(order.id, orderId), isNull(order.balancePaidAt)))
    .returning({ id: order.id })
  if (settled) await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.balance_paid', { orderId })
}

type PaymentRef =
  | { providerRef: string; idempotencyKey?: string | null | undefined }
  | { paymentId: string }

/** The attempt a gateway reference (or its idempotency key) names, or a payment id as given. */
export async function findPaymentId(ctx: StoreContext, ref: PaymentRef): Promise<string | null> {
  if ('paymentId' in ref) return ref.paymentId
  const [byRef] = await ctx.tx
    .select({ id: payment.id })
    .from(payment)
    .where(eq(payment.providerRef, ref.providerRef))
  if (byRef) return byRef.id
  // The gateway call succeeded but recording its reference did not: the key the
  // adapter stored on the gateway object still finds the attempt.
  if (!ref.idempotencyKey) return null
  const [byKey] = await ctx.tx
    .select({ id: payment.id })
    .from(payment)
    .where(eq(payment.idempotencyKey, ref.idempotencyKey))
  return byKey?.id ?? null
}

/**
 * True when a gateway reports less money than the attempt was for. A signed event is
 * genuine, but it may be for a different payment than the one it names (a shopper can
 * pay ₹1 on the store's public key and copy an attempt's notes onto it), so the amount
 * must cover the attempt before it counts. More than asked (gateway fees) is fine.
 */
export function gatewayPaidTooLittle(expectedPaise: number, reportedPaise: number): boolean {
  return !Number.isFinite(reportedPaise) || reportedPaise < expectedPaise
}

/**
 * Apply a gateway status to one payment attempt and its order. Idempotent and
 * forward-only (`nextPaymentStatus`): a duplicate capture is a no-op and a late
 * failure after a capture is ignored.
 *
 * Locks the order, then the payment, in that order everywhere, so concurrent
 * webhooks, the browser confirmation and a cancel serialise instead of
 * deadlocking. A capture on an order that was cancelled, or that another
 * attempt already paid, is kept as `captured` but flagged `refund_needed`
 * instead of reviving the order.
 */
export async function applyPaymentStatus(
  ctx: StoreContext,
  input: PaymentRef & {
    status: PaymentStatus
    providerPaymentId: string | null
    /**
     * The amount a gateway reported for this event, in paise. Supplied only by
     * the webhook (and any future gateway path): when present and the attempt
     * would move to authorized/captured, it must cover the attempt amount or the
     * move is refused (`rejected: 'underpaid'`). Omit it on manual, COD, balance
     * and reconciliation captures — there is no gateway amount to check.
     */
    capturedAmountPaise?: number | null
    /** Why a failure happened, in the gateway's words; stored on the attempt when it fails. */
    error?: string | null | undefined
  },
): Promise<AppliedPayment | null> {
  const id = await findPaymentId(ctx, input)
  if (!id) return null
  const [head] = await ctx.tx
    .select({ orderId: payment.orderId })
    .from(payment)
    .where(eq(payment.id, id))
  if (!head) return null
  const [o] = await ctx.tx
    .select({
      id: order.id,
      status: order.status,
      draftSource: order.draftSource,
      balancePaidAt: order.balancePaidAt,
    })
    .from(order)
    .where(eq(order.id, head.orderId))
    .for('update')
  const [p] = await ctx.tx.select().from(payment).where(eq(payment.id, id)).for('update')
  if (!p || !o) return null

  const next = nextPaymentStatus(p.status, input.status)
  const providerRef = 'providerRef' in input ? input.providerRef : p.providerRef
  if (!next) {
    return { payment: p, becameCaptured: false, refundNeeded: p.refundNeeded }
  }

  // The one place every capture path shares the amount invariant: a signed
  // gateway event can name an attempt it did not pay for (pay ₹1 on the store's
  // public key, copy an attempt's notes onto it), so a reported amount that does
  // not cover the attempt never moves it to authorized/captured. The attempt row
  // is left untouched; the caller (webhook) records why. Paths with no gateway
  // amount (manual, COD, balance, reconcile) pass nothing and skip the check.
  if (
    input.capturedAmountPaise != null &&
    (next === 'captured' || next === 'authorized') &&
    gatewayPaidTooLittle(p.amountPaise, input.capturedAmountPaise)
  ) {
    return {
      payment: p,
      becameCaptured: false,
      refundNeeded: p.refundNeeded,
      rejected: 'underpaid',
    }
  }

  let refundNeeded = p.refundNeeded
  if (next === 'captured' && p.purpose === 'balance') {
    refundNeeded = o.status === 'cancelled' || (await balanceAlreadySettled(ctx, p, o))
  } else if (next === 'captured') {
    const [other] = await ctx.tx
      .select({ id: payment.id })
      .from(payment)
      .where(
        and(
          eq(payment.orderId, p.orderId),
          ne(payment.id, p.id),
          eq(payment.status, 'captured'),
          notInArray(payment.provider, [...SPLIT_TENDER_PROVIDERS]),
          eq(payment.multiCapture, false),
          eq(payment.refundNeeded, false),
        ),
      )
      .limit(1)
    refundNeeded = o.status === 'cancelled' || !!other
  }

  // Unpaid checkouts as drafts: the money (or, on a manual-capture store, the authorisation) is
  // what turns the shopper's draft into a numbered order, here, under the order lock, so a
  // duplicate webhook finds it already converted. Goods gone since the hold lapsed: the money
  // is kept but flagged to refund, and the draft stays for the merchant to see (owner, Q3).
  if (
    (next === 'captured' || next === 'authorized') &&
    p.purpose === 'order' &&
    !refundNeeded &&
    isCheckoutDraft(o)
  ) {
    refundNeeded = !(await convertInSavepoint(ctx, p.orderId))
  }

  const [updated] = await ctx.tx
    .update(payment)
    .set({
      status: next,
      providerRef,
      providerPaymentId: input.providerPaymentId ?? p.providerPaymentId,
      refundNeeded,
      ...(next === 'failed' && input.error ? { error: input.error } : {}),
    })
    .where(eq(payment.id, p.id))
    .returning()
  if (!updated) return null
  if (next === 'captured' && !refundNeeded && p.purpose === 'balance') {
    await settleBalance(ctx, p.orderId)
  }
  // The rest arrived: store credit held for this checkout is now the order's money too.
  if (next === 'captured' && !refundNeeded && p.purpose === 'order' && !isSplitTender(p.provider)) {
    await captureHeldStoreCredit(ctx, p.orderId)
  }
  // The single choke point every capture path (webhook, gateway
  // create-payment, client confirm) goes through. The recompute writes
  // order.paid, once, on the call that sees the checkout amount arrive.
  await recomputeOrderStatuses(ctx, p.orderId)
  return {
    payment: updated,
    becameCaptured: next === 'captured' && !refundNeeded,
    refundNeeded,
  }
}

export const LATE_CAPTURE_NOTE =
  'Payment arrived after the held items were released, and they are now out of stock. The draft was not placed: refund the payment to the shopper.'

/** Convert the checkout draft; false when its goods are out of stock (nothing changed then). */
async function convertInSavepoint(ctx: StoreContext, orderId: string): Promise<boolean> {
  try {
    await ctx.tx.transaction((sp) =>
      convertCheckoutDraft({ storeId: ctx.storeId, tx: sp }, orderId),
    )
    return true
  } catch (err) {
    if (!(err instanceof OutOfStock)) throw err
    // The Drafts list shows it as "Refund needed"; the note says why on the draft's timeline.
    await ctx.tx.insert(orderNote).values({
      storeId: ctx.storeId,
      orderId,
      body: LATE_CAPTURE_NOTE,
      author: 'system',
    })
    return false
  }
}

/** Browser came back from a client-side checkout: verify with the adapter, then record. */
export async function confirmClientPayment(
  ctx: StoreContext,
  provider: PaymentProvider,
  providerRef: string,
  confirmation: ClientConfirmation,
) {
  const r = await provider.confirm(providerRef, confirmation)
  return applyPaymentStatus(ctx, {
    providerRef,
    status: r.status,
    providerPaymentId: r.providerPaymentId,
  })
}
