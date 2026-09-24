import { address, type Db, order, orderLine, payment, withStore } from '@commerce/db'
import type { CheckoutSession, CreatePaymentInput, PaymentProvider } from '@commerce/payments'
import { and, desc, eq, isNull, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { applyPaymentStatus } from './confirm'
import { OPEN_ATTEMPT_STATUSES, type PaymentRowStatus } from './transitions'

/*
 * Payment attempts. Each try at paying an order is its own `payment` row with
 * its own idempotency key; a failed try stays as history and a retry adds a
 * row. The gateway is only ever called after the transaction that reserved
 * stock has committed, so a slow gateway never holds inventory row locks.
 *
 * Pattern from Saleor's TransactionItem (BSD-3), one row per attempt with an
 * idempotency key, and Medusa's payment session `idempotency_key` (MIT).
 */

export type PaymentAttempt = typeof payment.$inferSelect

export type StartedPayment = {
  attemptId: string
  status: PaymentRowStatus
  /** How the storefront continues; null when the gateway could not be reached. */
  session: CheckoutSession | null
  /** True when this call captured the money (providers that capture at creation). */
  becameCaptured: boolean
  error: string | null
}

export class PaymentNotRetryable extends CommerceError {
  constructor(orderId: string, reason: string, storeId?: string) {
    super('PAYMENT_NOT_RETRYABLE', `Order ${orderId} cannot take a new payment: ${reason}`, {
      storeId,
    })
  }
}

/** `<orderId>:<attempt>`: unique per store, so one attempt can never be recorded twice. */
export const attemptKey = (orderId: string, attempt: number): string => `${orderId}:${attempt}`

/** Until the gateway answers, the reference is our own placeholder. */
const placeholderRef = (key: string): string => `attempt_${key}`

/** The gateway attempts on an order, newest first. Gift card payments are not attempts. */
export async function paymentAttempts(ctx: StoreContext, orderId: string) {
  return ctx.tx
    .select()
    .from(payment)
    .where(and(eq(payment.orderId, orderId), ne(payment.provider, GIFT_CARD_PROVIDER)))
    .orderBy(desc(payment.attempt), desc(payment.id))
}

/** Record a new attempt as `created`. The caller starts it with `startPaymentAttempt` after commit. */
export async function createPaymentAttempt(
  ctx: StoreContext,
  input: {
    orderId: string
    provider: string
    amountPaise: number
    /** `balance` collects a deposit pre-order's balance; it sits beside the deposit's capture. */
    purpose?: 'order' | 'balance' | undefined
  },
): Promise<PaymentAttempt> {
  const [latest] = await paymentAttempts(ctx, input.orderId)
  const attempt = (latest?.attempt ?? 0) + 1
  const key = attemptKey(input.orderId, attempt)
  const [row] = await ctx.tx
    .insert(payment)
    .values({
      storeId: ctx.storeId,
      orderId: input.orderId,
      provider: input.provider,
      providerRef: placeholderRef(key),
      status: 'created',
      amountPaise: input.amountPaise,
      attempt,
      idempotencyKey: key,
      purpose: input.purpose ?? 'order',
      multiCapture: input.purpose === 'balance',
    })
    .returning()
  if (!row) throw new Error('payment attempt insert returned nothing')
  return row
}

/**
 * Claim the attempt (only one caller gets to ask the gateway), and gather what
 * the gateway needs from the order. Null when someone else already claimed it.
 */
async function claimAttempt(ctx: StoreContext, attemptId: string) {
  const [claimed] = await ctx.tx
    .update(payment)
    .set({ gatewayRequestedAt: new Date() })
    .where(
      and(
        eq(payment.id, attemptId),
        eq(payment.status, 'created'),
        isNull(payment.gatewayRequestedAt),
      ),
    )
    .returning()
  if (!claimed) return null
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, claimed.orderId))
  if (!o) throw new Error(`order ${claimed.orderId} missing for payment ${attemptId}`)
  const lines = await ctx.tx.select().from(orderLine).where(eq(orderLine.orderId, o.id))
  const [ship] = o.shippingAddressId
    ? await ctx.tx.select().from(address).where(eq(address.id, o.shippingAddressId))
    : []
  const request: CreatePaymentInput = {
    orderId: o.id,
    orderNumber: o.number,
    amountPaise: claimed.amountPaise,
    currency: 'INR',
    idempotencyKey: claimed.idempotencyKey ?? attemptKey(o.id, claimed.attempt),
    customer: {
      email: o.email ?? undefined,
      phone: o.phone ?? undefined,
      name: ship?.name,
    },
    shipping: ship
      ? {
          name: ship.name,
          line1: ship.line1,
          line2: ship.line2 ?? undefined,
          city: ship.city,
          state: ship.stateCode,
          postalCode: ship.pincode,
          country: ship.country,
        }
      : undefined,
    lines: lines.map((l) => ({
      title:
        l.variantTitle && l.variantTitle !== 'Default'
          ? `${l.title ?? ''} / ${l.variantTitle}`
          : (l.title ?? ''),
      quantity: l.quantity,
      unitPricePaise: l.unitPricePaise,
    })),
  }
  return { attempt: claimed, request }
}

const sessionOf = (p: PaymentAttempt): CheckoutSession | null =>
  (p.checkoutSession as CheckoutSession | null) ?? null

/** What is recorded for an attempt, without asking the gateway. */
export function attemptSnapshot(p: PaymentAttempt): StartedPayment {
  return {
    attemptId: p.id,
    status: p.status,
    session: sessionOf(p),
    becameCaptured: false,
    error: p.error,
  }
}

async function markFailed(db: Db, storeId: string, attemptId: string, error: string) {
  return withStore(db, storeId, async (tx) => {
    const [row] = await tx
      .update(payment)
      .set({ status: 'failed', error })
      .where(and(eq(payment.id, attemptId), eq(payment.status, 'created')))
      .returning()
    return row ?? (await tx.select().from(payment).where(eq(payment.id, attemptId)))[0] ?? null
  })
}

const message = (err: unknown): string => (err instanceof Error ? err.message : String(err))

/**
 * Ask the gateway for this attempt, outside any transaction that holds stock
 * locks, then record the answer in a short transaction of its own.
 *
 * - Someone else already started it: returns what is recorded, calls nothing.
 * - The gateway throws: the attempt becomes `failed` with the error; the order
 *   stays placed with its stock held, and the shopper can retry.
 * - Recording the answer fails: money a capture-at-creation provider took is
 *   refunded, and the attempt is marked failed.
 */
export async function startPaymentAttempt(
  db: Db,
  storeId: string,
  attemptId: string,
  provider: PaymentProvider,
  log: Pick<Console, 'error'> = console,
): Promise<StartedPayment> {
  const claim = await withStore(db, storeId, (tx) => claimAttempt({ storeId, tx }, attemptId))
  if (!claim) {
    const current = await withStore(
      db,
      storeId,
      async (tx) => (await tx.select().from(payment).where(eq(payment.id, attemptId)))[0],
    )
    if (!current) throw new Error(`payment attempt ${attemptId} not found`)
    return attemptSnapshot(current)
  }

  let result: Awaited<ReturnType<PaymentProvider['createPayment']>>
  try {
    result = await provider.createPayment(claim.request)
  } catch (err) {
    const failed = await markFailed(db, storeId, attemptId, message(err))
    return {
      attemptId,
      status: failed?.status ?? 'failed',
      session: null,
      becameCaptured: false,
      error: message(err),
    }
  }

  try {
    return await withStore(db, storeId, async (tx) => {
      const ctx = { storeId, tx }
      // Reference and session first, then the status through the one forward-only path.
      await tx
        .update(payment)
        .set({
          providerRef: result.providerRef,
          checkoutSession: result.session,
          providerPaymentId: result.status === 'captured' ? result.providerRef : null,
        })
        .where(eq(payment.id, attemptId))
      const applied = await applyPaymentStatus(ctx, {
        paymentId: attemptId,
        status: result.status,
        providerPaymentId: result.status === 'captured' ? result.providerRef : null,
      })
      if (!applied) throw new Error(`payment attempt ${attemptId} vanished`)
      return {
        attemptId,
        status: applied.payment.status,
        session: result.session,
        becameCaptured: applied.becameCaptured,
        error: null,
      }
    })
  } catch (err) {
    log.error('[payments] could not record gateway answer', err)
    // Only money actually taken needs returning; providerRef doubles as the
    // payment id for providers that capture at creation.
    if (result.status !== 'pending' && result.status !== 'failed') {
      await provider.refund(result.providerRef, claim.attempt.amountPaise)
    }
    await markFailed(db, storeId, attemptId, message(err))
    return {
      attemptId,
      status: 'failed',
      session: null,
      becameCaptured: false,
      error: message(err),
    }
  }
}

/**
 * Open a new attempt on an order whose latest attempt failed or was cancelled.
 * The order row is locked, so two taps on "Retry payment" make one attempt:
 * the second finds the first one open and gets it back.
 */
export async function retryPayment(
  ctx: StoreContext,
  orderId: string,
): Promise<{ attempt: PaymentAttempt; created: boolean }> {
  const [o] = await ctx.tx.select().from(order).where(eq(order.id, orderId)).for('update')
  if (!o) throw new PaymentNotRetryable(orderId, 'not found', ctx.storeId)
  if (o.status !== 'placed') throw new PaymentNotRetryable(orderId, o.status, ctx.storeId)
  // Balance attempts on a pre-order are a separate collection, never retried from here.
  const attempts = (await paymentAttempts(ctx, orderId)).filter((a) => a.purpose === 'order')
  const latest = attempts[0]
  if (!latest) throw new PaymentNotRetryable(orderId, 'no payment to retry', ctx.storeId)
  if (attempts.some((a) => a.status === 'captured' && !a.refundNeeded)) {
    throw new PaymentNotRetryable(orderId, 'already paid', ctx.storeId)
  }
  if ((OPEN_ATTEMPT_STATUSES as readonly string[]).includes(latest.status)) {
    return { attempt: latest, created: false }
  }
  const attempt = await createPaymentAttempt(ctx, {
    orderId,
    provider: latest.provider,
    amountPaise: latest.amountPaise,
  })
  return { attempt, created: true }
}

/** `retryPayment`, committed, then the new attempt started with the gateway. */
export async function retryAndStartPayment(
  db: Db,
  storeId: string,
  orderId: string,
  provider: PaymentProvider,
): Promise<StartedPayment> {
  const { attempt } = await withStore(db, storeId, (tx) => retryPayment({ storeId, tx }, orderId))
  if (attempt.status !== 'created') return attemptSnapshot(attempt)
  return startPaymentAttempt(db, storeId, attempt.id, provider)
}
