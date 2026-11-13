import {
  applyPaymentStatus,
  balanceOwed,
  type FulfilOrderInput,
  fulfilOrderLines,
  type ManualCollection,
  OPEN_ATTEMPT_STATUSES,
  OrderNotFound,
  recomputeOrderStatuses,
  recordBalancePaid,
  withManualCollection,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { customer, order, payment, refund } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { and, asc, count, desc, eq, gt, inArray, lt, lte, ne, sum } from 'drizzle-orm'

/** The orders either side of this one by number, for the header's arrows. */
export async function orderNeighbours(tx: StoreTx, id: string) {
  const [current] = await tx.select({ number: order.number }).from(order).where(eq(order.id, id))
  if (!current) return { previous: null, next: null }
  const [previous] = await tx
    .select({ id: order.id, number: order.number })
    .from(order)
    .where(lt(order.number, current.number))
    .orderBy(desc(order.number))
    .limit(1)
  const [next] = await tx
    .select({ id: order.id, number: order.number })
    .from(order)
    .where(gt(order.number, current.number))
    .orderBy(asc(order.number))
    .limit(1)
  return { previous: previous ?? null, next: next ?? null }
}

/** How many orders this customer has placed, so the detail page can say "3rd order". */
export async function customerOrderCount(tx: StoreTx, customerId: string | null): Promise<number> {
  if (!customerId) return 0
  const [row] = await tx
    .select({ total: count() })
    .from(order)
    .where(and(eq(order.customerId, customerId), ne(order.status, 'cancelled')))
  return row?.total ?? 0
}

/** Which order this one is in that customer's history (1 = their first). */
export async function customerOrderIndex(
  tx: StoreTx,
  customerId: string | null,
  placedAt: Date,
): Promise<number> {
  if (!customerId) return 0
  const [row] = await tx
    .select({ total: count() })
    .from(order)
    .where(
      and(
        eq(order.customerId, customerId),
        ne(order.status, 'cancelled'),
        lte(order.placedAt, placedAt),
      ),
    )
  return row?.total ?? 0
}

export async function fulfilOrder(tx: StoreTx, storeId: string, input: FulfilOrderInput) {
  return fulfilOrderLines({ tx, storeId }, input)
}

export type OrderBalance = {
  /** Sum of payments the gateway has actually taken. */
  capturedPaise: number
  /** Taken but not yet captured (a gateway hold, or cash still to collect). */
  pendingPaise: number
  refundedPaise: number
  /** What the shopper still owes: total minus captured, plus anything returned. */
  balancePaise: number
}

/** The money summary under the totals: paid by customer, and what is left. */
/**
 * What the customer still owes (positive) or is owed back (negative). A refund settles an
 * overpayment (an edit that lowered the total) but never puts the customer back in debt: money
 * sent back from the Refund button, without changing the order, leaves nothing to collect.
 */
export function balanceOf(totalPaise: number, capturedPaise: number, refundedPaise: number) {
  const due = totalPaise - capturedPaise
  return due >= 0 ? due : Math.min(0, due + refundedPaise)
}

export async function orderBalance(
  tx: StoreTx,
  orderId: string,
  totalPaise: number,
): Promise<OrderBalance> {
  const rows = await tx.select().from(payment).where(eq(payment.orderId, orderId))
  // A payment refunded in full is `refunded`, but it was taken: it still counts as received
  // (the refund is `refundedPaise`), or a cancelled, refunded order reads as owing its total.
  const capturedPaise = rows
    .filter((p) => p.status === 'captured' || p.status === 'refunded')
    .reduce((sum, p) => sum + p.amountPaise, 0)
  const pendingPaise = rows
    .filter((p) => p.status === 'pending')
    .reduce((sum, p) => sum + p.amountPaise, 0)
  // Every payment's refunds in one query (the same rows `refundedPaise` adds up per payment).
  const ids = rows.map((p) => p.id)
  const [refunded] = ids.length
    ? await tx
        .select({ total: sum(refund.amountPaise) })
        .from(refund)
        .where(and(inArray(refund.paymentId, ids), ne(refund.status, 'failed')))
    : []
  const back = Number(refunded?.total ?? 0)
  return {
    capturedPaise,
    pendingPaise,
    refundedPaise: back,
    balancePaise: balanceOf(totalPaise, capturedPaise, back),
  }
}

/**
 * Record money the merchant collected outside a gateway (cash on delivery, a
 * bank transfer they matched by hand). The pending payment row is captured so
 * the order and the payment never disagree; without one, a payment row is
 * created so the history still shows where the money came from. How it was
 * paid (method, UTR, day) is kept on the captured row (`checkout_session.collected`).
 */
export async function collectOrderPayment(
  tx: StoreTx,
  storeId: string,
  input: {
    orderId: string
    amountPaise: number
    method?: string | undefined
    collected?: ManualCollection | undefined
  },
) {
  const [current] = await tx.select().from(order).where(eq(order.id, input.orderId))
  // RLS hides other stores' orders; without this a payment row would be written against one.
  if (!current) throw new OrderNotFound(input.orderId, storeId)
  const ctx = { storeId, tx }
  // A deposit pre-order whose deposit is in: what is owed is the balance, settled as one.
  if (current.checkoutPaidAt && balanceOwed(current) > 0) {
    await recordBalancePaid(ctx, input.orderId, { method: input.method })
    await stampCollection(tx, input, 'balance')
    const [o] = await tx.select().from(order).where(eq(order.id, input.orderId))
    return { order: o ?? null, balance: true }
  }
  const pending = await tx
    .select()
    .from(payment)
    .where(
      and(
        eq(payment.orderId, input.orderId),
        eq(payment.purpose, 'order'),
        inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
        // Cash on a COD order never captures the "pay online" gateway attempt left open beside it.
        current.paymentMethod === 'cod' ? eq(payment.provider, 'cod') : undefined,
      ),
    )
    .orderBy(desc(payment.attempt))
  const first = pending[0]
  if (first) {
    // Through the one capture path, so a capture on a cancelled order is flagged, not kept.
    await applyPaymentStatus(ctx, {
      paymentId: first.id,
      status: 'captured',
      providerPaymentId: null,
    })
    await stampCollection(tx, input, 'order', first.id)
  } else {
    // Never more than is still owed: an over-recorded order reads as paid twice over.
    const { balancePaise } = await orderBalance(tx, input.orderId, current.totalPaise)
    if (input.amountPaise > balancePaise) {
      throw new ORPCError('BAD_REQUEST', {
        message: 'That is more than is left to pay on this order.',
      })
    }
    await tx.insert(payment).values({
      storeId,
      orderId: input.orderId,
      provider: input.method ?? 'manual',
      providerRef: `manual_${input.orderId}_${Date.now()}`,
      status: 'captured',
      amountPaise: input.amountPaise,
      checkoutSession: input.collected ? withManualCollection(null, input.collected) : null,
    })
    await recomputeOrderStatuses(ctx, input.orderId)
  }
  const [o] = await tx.select().from(order).where(eq(order.id, input.orderId))
  return { order: o ?? null, balance: false }
}

/** Write how the merchant was paid onto the payment row that was just captured. */
async function stampCollection(
  tx: StoreTx,
  input: { orderId: string; collected?: ManualCollection | undefined },
  purpose: 'order' | 'balance',
  paymentId?: string,
) {
  if (!input.collected) return
  const [row] = await tx
    .select({ id: payment.id, checkoutSession: payment.checkoutSession })
    .from(payment)
    .where(
      paymentId
        ? eq(payment.id, paymentId)
        : and(
            eq(payment.orderId, input.orderId),
            eq(payment.purpose, purpose),
            eq(payment.status, 'captured'),
          ),
    )
    .orderBy(desc(payment.createdAt))
    .limit(1)
  if (!row) return
  await tx
    .update(payment)
    .set({ checkoutSession: withManualCollection(row.checkoutSession, input.collected) })
    .where(eq(payment.id, row.id))
}

/** Customer name for the header, without pulling the whole record. */
export async function customerName(tx: StoreTx, customerId: string | null) {
  if (!customerId) return null
  const [row] = await tx
    .select({ name: customer.name })
    .from(customer)
    .where(eq(customer.id, customerId))
  return row?.name ?? null
}
