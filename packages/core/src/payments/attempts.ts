import { address, type Db, order, orderLine, payment, store, withStore } from '@commerce/db'
import {
  type CheckoutSession,
  type CreatePaymentInput,
  type PaymentProvider,
  readableError,
} from '@commerce/payments'
import { and, desc, eq, isNull, ne } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { GIFT_CARD_PROVIDER } from '../gift-cards/service'
import { captureModeFor } from './capture'
import { applyPaymentStatus } from './confirm'
import { type FallbackTry, runWithFallbacks } from './fallback'
import { isGatewayProvider, type OnlineMethodId } from './methods'
import { methodsForGateway } from './routing'
import { parsePaymentSettings } from './settings'
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
async function claimAttempt(
  ctx: StoreContext,
  attemptId: string,
  methodsOverride?: OnlineMethodId[] | undefined,
) {
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
  // A gateway's window offers only the methods the merchant turned on and routed to it, in
  // their order; a fallback try offers what the gateway that failed was going to.
  const gateway = isGatewayProvider(claimed.provider)
    ? await gatewayOptions(ctx, claimed.provider)
    : null
  const methods = methodsOverride ?? gateway?.methods
  // Payment capture (#150): an order's checkout payment only authorises when the store chose
  // manual capture for this gateway; a pre-order balance is always captured at once.
  const capture =
    gateway?.capture === 'manual' && claimed.purpose !== 'balance' ? 'manual' : undefined
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
    merchantName: gateway?.merchantName,
    methods,
    ...(capture ? { capture } : {}),
  }
  return { attempt: claimed, request }
}

/**
 * Online methods on for this store and routed to this gateway (undefined for stores that never
 * saved the method row: the gateway then shows everything it has), and its capture mode.
 */
async function gatewayOptions(ctx: StoreContext, gatewayId: string) {
  const [s] = await ctx.tx
    .select({ name: store.name, payments: store.payments })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const settings = parsePaymentSettings(s?.payments)
  const on = methodsForGateway(settings, gatewayId)
  return {
    merchantName: s?.name,
    methods: on?.length ? on : undefined,
    capture: captureModeFor(settings, gatewayId),
  }
}

export const sessionOf = (p: PaymentAttempt): CheckoutSession | null =>
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

/** Gateway SDKs reject with plain objects; `String()` stored those as "[object Object]". */
const message = readableError

/** Rejects when the gateway has not answered in `ms`; no limit when `ms` is undefined. */
function withTimeout<T>(work: Promise<T>, ms: number | undefined, gatewayId: string): Promise<T> {
  if (!ms) return work
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${gatewayId} did not answer in ${Math.round(ms / 1000)}s`)),
      ms,
    )
  })
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer))
}

export type StartOptions = {
  /** What the gateway's window offers instead of the store's routing (a fallback try). */
  methods?: OnlineMethodId[] | undefined
  /** Give up on a gateway that has not opened the payment in this long. */
  timeoutMs?: number | undefined
}

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
  options: StartOptions = {},
): Promise<StartedPayment> {
  const claim = await withStore(db, storeId, (tx) =>
    claimAttempt({ storeId, tx }, attemptId, options.methods),
  )
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
    result = await withTimeout(
      provider.createPayment(claim.request),
      options.timeoutMs,
      provider.id,
    )
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
      await provider.refund(result.providerRef, claim.attempt.amountPaise, undefined, {
        providerRef: result.providerRef,
      })
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
 * A failed attempt's next try on another gateway: same order, amount and
 * purpose, a new attempt number and idempotency key. Null when the order was
 * paid, cancelled or retried meanwhile (the order row is locked meanwhile).
 */
async function reopenOnGateway(
  db: Db,
  storeId: string,
  failedAttemptId: string,
  providerId: string,
): Promise<string | null> {
  return withStore(db, storeId, async (tx) => {
    const [failed] = await tx.select().from(payment).where(eq(payment.id, failedAttemptId))
    if (failed?.status !== 'failed') return null
    const [o] = await tx.select().from(order).where(eq(order.id, failed.orderId)).for('update')
    if (o?.status !== 'open' || o.checkoutPaidAt) return null
    const [latest] = await paymentAttempts({ storeId, tx }, failed.orderId)
    if (latest?.id !== failed.id) return null
    const next = await createPaymentAttempt(
      { storeId, tx },
      {
        orderId: failed.orderId,
        provider: providerId,
        amountPaise: failed.amountPaise,
        purpose: failed.purpose === 'balance' ? 'balance' : 'order',
      },
    )
    return next.id
  })
}

/**
 * `startPaymentAttempt`, and when the gateway cannot open the payment (an
 * error or no answer in `timeoutMs`), the next active gateway in the
 * merchant's fallback order on a fresh attempt (audit #150). Every try is its
 * own `payment` row with its own gateway, idempotency key and webhook route.
 */
export async function startPaymentWithFallback(
  db: Db,
  storeId: string,
  attemptId: string,
  provider: PaymentProvider,
  fallbacks: FallbackTry<PaymentProvider>[],
  options: { timeoutMs?: number | undefined } = {},
  log: Pick<Console, 'error'> = console,
): Promise<StartedPayment> {
  return runWithFallbacks({ attemptId, provider }, fallbacks, {
    start: (id, p, methods) =>
      startPaymentAttempt(db, storeId, id, p, log, { methods, timeoutMs: options.timeoutMs }),
    reopen: (failedId, p) => reopenOnGateway(db, storeId, failedId, p.id),
  })
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
  if (o.status !== 'open') throw new PaymentNotRetryable(orderId, o.status, ctx.storeId)
  if (o.checkoutPaidAt) throw new PaymentNotRetryable(orderId, 'already paid', ctx.storeId)
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
