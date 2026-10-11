import { order, payment } from '@commerce/db'
import type { ClientConfirmation, PaymentProvider, PaymentStatus } from '@commerce/payments'
import { and, eq, isNull, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { recomputeOrderStatuses } from '../order/recompute'
import { insertOutboxEvent } from '../outbox/write'
import { nextPaymentStatus } from './transitions'

export type AppliedPayment = {
  payment: typeof payment.$inferSelect
  /** True only on the call that moved the payment into `captured` for a live order; drives the payment_received notification. */
  becameCaptured: boolean
  /** True when money was captured that the order cannot keep (cancelled order, already paid). */
  refundNeeded: boolean
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

/** The amount of the attempt a gateway event points at, or null when it names none. */
export async function paymentAmountFor(
  ctx: StoreContext,
  ref: { providerRef: string; idempotencyKey?: string | null | undefined },
): Promise<number | null> {
  const id = await findPaymentId(ctx, ref)
  if (!id) return null
  const [row] = await ctx.tx
    .select({ amountPaise: payment.amountPaise })
    .from(payment)
    .where(eq(payment.id, id))
  return row?.amountPaise ?? null
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
  input: PaymentRef & { status: PaymentStatus; providerPaymentId: string | null },
): Promise<AppliedPayment | null> {
  const id = await findPaymentId(ctx, input)
  if (!id) return null
  const [head] = await ctx.tx
    .select({ orderId: payment.orderId })
    .from(payment)
    .where(eq(payment.id, id))
  if (!head) return null
  const [o] = await ctx.tx
    .select({ id: order.id, status: order.status, balancePaidAt: order.balancePaidAt })
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
          ne(payment.provider, 'gift_card'),
          eq(payment.multiCapture, false),
          eq(payment.refundNeeded, false),
        ),
      )
      .limit(1)
    refundNeeded = o.status === 'cancelled' || !!other
  }

  const [updated] = await ctx.tx
    .update(payment)
    .set({
      status: next,
      providerRef,
      providerPaymentId: input.providerPaymentId ?? p.providerPaymentId,
      refundNeeded,
    })
    .where(eq(payment.id, p.id))
    .returning()
  if (!updated) return null
  if (next === 'captured' && !refundNeeded && p.purpose === 'balance') {
    await settleBalance(ctx, p.orderId)
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
