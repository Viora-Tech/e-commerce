import { order, payment } from '@commerce/db'
import type { ClientConfirmation, PaymentProvider, PaymentStatus } from '@commerce/payments'
import { and, eq, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { insertOutboxEvent } from '../outbox/write'
import { nextPaymentStatus } from './transitions'

export type AppliedPayment = {
  payment: typeof payment.$inferSelect
  /** True only on the call that moved the payment into `captured` for a live order; drives the payment_received notification. */
  becameCaptured: boolean
  /** True when money was captured that the order cannot keep (cancelled order, already paid). */
  refundNeeded: boolean
}

type PaymentRef =
  | { providerRef: string; idempotencyKey?: string | null | undefined }
  | { paymentId: string }

async function findPaymentId(ctx: StoreContext, ref: PaymentRef): Promise<string | null> {
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
    .select({ id: order.id, status: order.status })
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
  if (next === 'captured') {
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
  if (next === 'captured' && !refundNeeded) {
    const [movedToPaid] = await ctx.tx
      .update(order)
      .set({ status: 'paid' })
      .where(and(eq(order.id, p.orderId), eq(order.status, 'placed')))
      .returning({ id: order.id })
    // Only on the row that actually moved placed -> paid: the single choke
    // point every capture path (webhook, gateway create-payment, client
    // confirm) goes through, so this is the one place order.paid is written.
    if (movedToPaid) {
      await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.paid', { orderId: p.orderId })
    }
  }
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
