/** SOURCE OF TRUTH: settleEditMoney — WHAT: the money side of an order edit: ask the customer for more through the balance pay link, or send the store's excess back / WHY: an edited paid order must end with the books balanced, reusing the pre-order balance flow and the refund routes */
import { order, payment } from '@commerce/db'
import type { PaymentProvider } from '@commerce/payments'
import { and, eq, inArray, notInArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { SPLIT_TENDER_PROVIDERS } from '../payments/split-tender'
import { OPEN_ATTEMPT_STATUSES } from '../payments/transitions'
import { requestBalance } from '../preorder/balance'
import type { EditPlan } from './edit-plan'
import { type RefundRoute, refundOrderAmount } from './refund-routes'

/** The refund reason an edit's refunds carry; the affiliate commission skips these (it is recomputed). */
export const ORDER_EDIT_REFUND_REASON = 'Order edited'

export type EditSettlement =
  /** Nothing to settle: the total did not move against what was paid, or nothing was paid yet. */
  | { kind: 'none'; amountPaise: 0 }
  /** The customer owes more; the balance is open (collect it, or send the link later). */
  | { kind: 'owed'; amountPaise: number }
  /** The customer owes more and was asked for it (balance request with the pay link). */
  | { kind: 'requested'; amountPaise: number; emailed: boolean }
  | {
      kind: 'refunded'
      amountPaise: number
      route: Exclude<RefundRoute, 'none'>
      refundIds: string[]
    }
  /** The store owes money back and chose not to refund it now. */
  | { kind: 'kept'; amountPaise: number }

/** Balance attempts still in flight were for the old amount: they are withdrawn. */
async function withdrawOpenBalance(ctx: StoreContext, orderId: string) {
  await ctx.tx
    .update(payment)
    .set({ status: 'cancelled', error: 'Order edited: amount changed' })
    .where(
      and(
        eq(payment.orderId, orderId),
        eq(payment.purpose, 'balance'),
        inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
      ),
    )
}

/**
 * Settle what the edit changed. On an order paid at checkout:
 * - The customer owes more: the order gets a balance of exactly that (`balance_due_paise`, the
 *   pre-order balance ledger), so "Collect payment" records it by hand and the balance link pays
 *   it online. An earlier balance capture is re-filed as order money first (one balance capture
 *   per order), and stale balance attempts are withdrawn. With `requestPayment` the customer is
 *   emailed the link at once (`requestBalance`); otherwise staff can send it from the order.
 * - The store owes money: refunded the chosen way (`refund-routes.ts`), each refund tagged
 *   `ORDER_EDIT_REFUND_REASON`; `none` keeps it and says so.
 * An unpaid order (cash on delivery, a transfer not in yet) settles nothing: its offline payment
 * waiting to be collected is moved to the new total, so the courier collects the right amount.
 */
export async function settleEditMoney(
  ctx: StoreContext,
  input: {
    order: typeof order.$inferSelect
    plan: EditPlan
    route: RefundRoute
    requestPayment: boolean
    author: string
    providers: readonly PaymentProvider[]
  },
): Promise<EditSettlement> {
  const o = input.order
  if (!o.checkoutPaidAt) {
    await ctx.tx
      .update(payment)
      .set({ amountPaise: input.plan.after.totalPaise })
      .where(
        and(
          eq(payment.orderId, o.id),
          eq(payment.purpose, 'order'),
          inArray(payment.provider, ['cod', 'manual']),
          inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
        ),
      )
    // A COD shopper asked to pay online: the gateway attempt was for the old amount. The next
    // "Pay online now" opens one for the new total (`payOnlineInstead`).
    if (o.paymentMethod === 'cod') {
      await ctx.tx
        .update(payment)
        .set({ status: 'cancelled', error: 'Order edited: amount changed' })
        .where(
          and(
            eq(payment.orderId, o.id),
            eq(payment.purpose, 'order'),
            notInArray(payment.provider, ['cod', 'manual', ...SPLIT_TENDER_PROVIDERS]),
            inArray(payment.status, [...OPEN_ATTEMPT_STATUSES]),
          ),
        )
    }
    return { kind: 'none', amountPaise: 0 }
  }
  const diff = input.plan.differencePaise
  await withdrawOpenBalance(ctx, o.id)
  if (diff > 0) {
    await ctx.tx
      .update(payment)
      .set({ purpose: 'order' })
      .where(
        and(
          eq(payment.orderId, o.id),
          eq(payment.purpose, 'balance'),
          eq(payment.status, 'captured'),
        ),
      )
    await ctx.tx
      .update(order)
      .set({
        balanceDuePaise: diff,
        balancePaidAt: null,
        balanceRequestedAt: null,
        balanceRemindersSent: 0,
      })
      .where(eq(order.id, o.id))
    if (!input.requestPayment) return { kind: 'owed', amountPaise: diff }
    await requestBalance(ctx, o.id, { author: input.author })
    return { kind: 'requested', amountPaise: diff, emailed: Boolean(o.email) }
  }
  // Nothing more is owed: an open balance (a pre-order's, or an earlier edit's) is closed.
  if ((o.balanceDuePaise ?? 0) > 0 && !o.balancePaidAt) {
    await ctx.tx.update(order).set({ balanceDuePaise: 0 }).where(eq(order.id, o.id))
  }
  if (diff === 0) return { kind: 'none', amountPaise: 0 }
  const owedBack = -diff
  if (input.route === 'none') return { kind: 'kept', amountPaise: owedBack }
  const refundIds = await refundOrderAmount(ctx, {
    orderId: o.id,
    amountPaise: owedBack,
    route: input.route,
    reason: ORDER_EDIT_REFUND_REASON,
    providers: input.providers,
  })
  return { kind: 'refunded', amountPaise: owedBack, route: input.route, refundIds }
}
