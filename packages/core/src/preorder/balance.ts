import { type Db, order, orderNote, payment, withStore } from '@commerce/db'
import { formatMoney } from '@commerce/money'
import type { PaymentProvider } from '@commerce/payments'
import { and, desc, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { insertOutboxEvent } from '../outbox/write'
import {
  attemptSnapshot,
  createPaymentAttempt,
  type PaymentAttempt,
  type StartedPayment,
  startPaymentAttempt,
} from '../payments/attempts'
import { applyPaymentStatus } from '../payments/confirm'
import { OPEN_ATTEMPT_STATUSES } from '../payments/transitions'

/*
 * Collecting a deposit pre-order's balance. The balance is its own payment
 * attempt (`purpose = 'balance'`) on the same order, through the same attempt
 * flow as checkout: recorded in a short transaction under the order's row
 * lock, the gateway asked only after commit, and the capture applied by
 * `applyPaymentStatus`, which sets `balance_paid_at` and writes
 * `order.balance_paid` exactly once. Pattern from Saleor's TransactionItem
 * (BSD-3): one row per attempt, charged amounts only ever added.
 */

export class BalanceNotPayable extends CommerceError {
  constructor(orderId: string, reason: string, storeId?: string) {
    super('BALANCE_NOT_PAYABLE', `Order ${orderId} has no balance to pay: ${reason}`, { storeId })
  }
}

type BalanceFields = {
  status: string
  balanceDuePaise: number | null
  balancePaidAt: Date | null
}

/** Paise still owed on a deposit pre-order; 0 when paid, cancelled, or never a deposit order. */
export function balanceOwed(o: BalanceFields): number {
  if (o.status === 'cancelled' || o.status === 'draft' || o.balancePaidAt) return 0
  return Math.max(0, o.balanceDuePaise ?? 0)
}

const OFFLINE = new Set(['cod', 'gift_card'])

/**
 * Which enabled provider collects the balance: the one that took the
 * deposit when it is still enabled, else the first online one. COD cannot
 * collect a balance before dispatch, so it never qualifies.
 */
export function balanceProvider(
  providers: readonly PaymentProvider[],
  depositProvider: string | null,
): PaymentProvider | null {
  const usable = providers.filter((p) => !OFFLINE.has(p.id))
  return usable.find((p) => p.id === depositProvider) ?? usable[0] ?? null
}

/** Lock the order and check it has a balance that can be paid now. */
async function lockOwingOrder(ctx: StoreContext, orderId: string) {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o) throw new BalanceNotPayable(orderId, 'not found', ctx.storeId)
  if (o.importedFrom) throw new BalanceNotPayable(orderId, 'imported order', ctx.storeId)
  const owed = balanceOwed(o)
  if (owed <= 0) {
    const reason = o.balancePaidAt
      ? 'already paid'
      : o.status === 'cancelled'
        ? 'cancelled'
        : 'none due'
    throw new BalanceNotPayable(orderId, reason, ctx.storeId)
  }
  // The balance follows the deposit: an order still waiting on its first payment is not asked twice.
  if (!o.checkoutPaidAt) throw new BalanceNotPayable(orderId, 'deposit not paid yet', ctx.storeId)
  return { o, owed }
}

export const BALANCE_REQUESTED_NOTE = (owedPaise: number, automatic: boolean) =>
  `${automatic ? 'Balance requested automatically' : 'Balance requested'}: ${formatMoney(owedPaise, 'INR', { showZeroDecimals: true })} due.`

/**
 * Ask the shopper for the balance. Writes `order.balance_requested` (the
 * notification with the pay link) every time, so the merchant can resend;
 * `balance_requested_at` keeps the first request, which reminders and the
 * unpaid-balance rule count from.
 */
export async function requestBalance(
  ctx: StoreContext,
  orderId: string,
  opts: { now?: Date | undefined; author?: string | undefined } = {},
): Promise<{ firstRequest: boolean; owedPaise: number; requestedAt: Date }> {
  const { o, owed } = await lockOwingOrder(ctx, orderId)
  const requestedAt = o.balanceRequestedAt ?? opts.now ?? new Date()
  if (!o.balanceRequestedAt) {
    await ctx.tx.update(order).set({ balanceRequestedAt: requestedAt }).where(eq(order.id, orderId))
  }
  await insertOutboxEvent(ctx.tx, ctx.storeId, 'order.balance_requested', { orderId })
  const automatic = !opts.author || opts.author === 'system'
  await ctx.tx.insert(orderNote).values({
    storeId: ctx.storeId,
    orderId,
    body: BALANCE_REQUESTED_NOTE(owed, automatic),
    author: opts.author ?? 'system',
  })
  return { firstRequest: !o.balanceRequestedAt, owedPaise: owed, requestedAt }
}

/** Balance attempts on an order, newest first. */
export async function balanceAttempts(ctx: StoreContext, orderId: string) {
  return ctx.tx
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), eq(payment.purpose, 'balance')))
    .orderBy(desc(payment.attempt), desc(payment.id))
}

/**
 * The balance attempt to pay with: the open one when there is one (two taps
 * on "Pay balance" get the same attempt; the partial unique index backs this
 * up), else a new one for what is owed. Runs under the order's row lock.
 */
export async function openBalanceAttempt(
  ctx: StoreContext,
  orderId: string,
  providerId: string,
): Promise<{ attempt: PaymentAttempt; created: boolean }> {
  const { owed } = await lockOwingOrder(ctx, orderId)
  const attempts = await balanceAttempts(ctx, orderId)
  if (attempts.some((a) => a.status === 'captured' && !a.refundNeeded)) {
    throw new BalanceNotPayable(orderId, 'already paid', ctx.storeId)
  }
  const open = attempts.find((a) => (OPEN_ATTEMPT_STATUSES as readonly string[]).includes(a.status))
  if (open) return { attempt: open, created: false }
  const attempt = await createPaymentAttempt(ctx, {
    orderId,
    provider: providerId,
    amountPaise: owed,
    purpose: 'balance',
  })
  return { attempt, created: true }
}

/**
 * "Pay balance": record (or reuse) the balance attempt and commit, then ask
 * the gateway outside that transaction. Same guarantees as checkout's
 * attempts: one gateway call per attempt, a failed call leaves a failed
 * attempt the shopper can replace.
 */
export async function startBalancePayment(
  db: Db,
  storeId: string,
  orderId: string,
  provider: PaymentProvider,
): Promise<StartedPayment> {
  const { attempt } = await withStore(db, storeId, (tx) =>
    openBalanceAttempt({ storeId, tx }, orderId, provider.id),
  )
  if (attempt.status !== 'created') return attemptSnapshot(attempt)
  return startPaymentAttempt(db, storeId, attempt.id, provider)
}

/**
 * The merchant took the balance outside the gateway (cash, a transfer they
 * matched). Captures the open balance attempt, or records one, through
 * `applyPaymentStatus` so fulfilment unblocks and `order.balance_paid` is
 * written the same way as for a gateway capture.
 */
export async function recordBalancePaid(
  ctx: StoreContext,
  orderId: string,
  opts: { method?: string | undefined } = {},
) {
  const { attempt } = await openBalanceAttempt(ctx, orderId, opts.method ?? 'manual')
  return applyPaymentStatus(ctx, {
    paymentId: attempt.id,
    status: 'captured',
    providerPaymentId: null,
  })
}
